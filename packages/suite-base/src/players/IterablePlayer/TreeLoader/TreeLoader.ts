// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";
import { v4 as uuidv4 } from "uuid";

import Log from "@lichtblick/log";
import {
  Time,
  compare as compareTime,
  subtract as subtractTime,
  add as addTime,
} from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";
import { MessageBlock, Progress, TopicSelection } from "@lichtblick/suite-base/players/types";
import { Range } from "@lichtblick/suite-base/util/ranges";

import PlayerAlertManager from "../../PlayerAlertManager";
import { MEMORY_INFO_PRELOADED_MSGS } from "../BlockLoader";
import { IDeserializedIterableSource } from "../IIterableSource";

const log = Log.getLogger(__filename);

interface BlockCache {
  blocks: MessageBlock[];
  startTime: Time;
}

// Constants for future use in adaptive features
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_NODE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB per leaf node
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MIN_NODE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB minimum before merging
const MAX_TREE_DEPTH = 8; // Maximum tree depth to prevent excessive subdivision
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MERGE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes since last access
const LRU_CACHE_SIZE = 200; // Maximum number of loaded nodes in memory

type BlockLoaderArgs = {
  cacheSizeBytes: number;
  source: IDeserializedIterableSource;
  start: Time;
  end: Time;
  maxBlocks: number;
  minBlockDurationNs: number;
  alertManager: PlayerAlertManager;
};

type LoadArgs = {
  startTime: Time;
  endTime: Time;
  progress?: (progress: Progress) => void;
};

interface TimeRange {
  start: Time;
  end: Time;
}

interface PlayerProblem {
  severity: "error" | "warn";
  message: string;
  error?: unknown;
}

interface TreeNode {
  // Temporal bounds
  timeRange: TimeRange;
  level: number; // 0=leaf, 1=parent, 2=grandparent, etc.

  // Data (only in leaf nodes)
  messagesByTopic?: Record<string, MessageEvent[]>;
  needTopics?: TopicSelection;
  sizeInBytes: number;

  // Tree structure
  parent?: TreeNode;
  children: TreeNode[];

  // Metadata for aggregation
  aggregatedStats: {
    totalMessages: number;
    totalSizeInBytes: number;
    topicsPresent: Set<string>;
    fullyLoadedTopics: Set<string>;
  };

  // Cache management
  lastAccessed: number;
  isLoaded: boolean;
  id: string;
  // Flag to prevent eviction for allFrames consistency
  preserveForAllFrames: boolean;
}

export class TreeLoader {
  readonly #args: BlockLoaderArgs;
  #root: TreeNode;
  #loadedNodes = new Map<string, TreeNode>();
  #loadingPromises = new Map<string, Promise<void>>();
  #currentTopics?: TopicSelection;
  #abortController?: AbortController;
  #problems: PlayerProblem[] = [];

  public constructor(args: BlockLoaderArgs) {
    this.#args = args;
    this.#root = this.#createInitialTree();
  }

  // Creates the initial tree structure based on data source time bounds
  #createInitialTree(): TreeNode {
    const start = this.#args.start;
    const end = this.#args.end;

    const root: TreeNode = {
      timeRange: { start, end },
      level: 0,
      children: [],
      sizeInBytes: 0,
      aggregatedStats: {
        totalMessages: 0,
        totalSizeInBytes: 0,
        topicsPresent: new Set(),
        fullyLoadedTopics: new Set(),
      },
      lastAccessed: Date.now(),
      isLoaded: false,
      id: uuidv4(),
      preserveForAllFrames: false,
    };

    // Build initial tree structure
    this.#subdivideNode(root, MAX_TREE_DEPTH);

    return root;
  }

  // Recursively subdivide a node into children
  #subdivideNode(node: TreeNode, maxDepth: number): void {
    if (maxDepth <= 0) {
      return; // This becomes a leaf node
    }

    const duration = subtractTime(node.timeRange.end, node.timeRange.start);

    // Don't subdivide if duration is too small (less than 1 second)
    if (compareTime(duration, { sec: 1, nsec: 0 }) < 0) {
      return;
    }

    // Create two children (binary tree for simplicity)
    const midTime = addTime(node.timeRange.start, {
      sec: Math.floor(duration.sec / 2),
      nsec: Math.floor(duration.nsec / 2),
    });

    const leftChild: TreeNode = {
      timeRange: { start: node.timeRange.start, end: midTime },
      level: node.level + 1,
      parent: node,
      children: [],
      sizeInBytes: 0,
      aggregatedStats: {
        totalMessages: 0,
        totalSizeInBytes: 0,
        topicsPresent: new Set(),
        fullyLoadedTopics: new Set(),
      },
      lastAccessed: Date.now(),
      isLoaded: false,
      id: uuidv4(),
      preserveForAllFrames: false,
    };

    const rightChild: TreeNode = {
      timeRange: { start: midTime, end: node.timeRange.end },
      level: node.level + 1,
      parent: node,
      children: [],
      sizeInBytes: 0,
      aggregatedStats: {
        totalMessages: 0,
        totalSizeInBytes: 0,
        topicsPresent: new Set(),
        fullyLoadedTopics: new Set(),
      },
      lastAccessed: Date.now(),
      isLoaded: false,
      id: uuidv4(),
      preserveForAllFrames: false,
    };

    node.children = [leftChild, rightChild];

    // Recursively subdivide children
    this.#subdivideNode(leftChild, maxDepth - 1);
    this.#subdivideNode(rightChild, maxDepth - 1);
  }

  // Find leaf nodes that overlap with the given time range
  #findLeafNodesByTimeRange(range: TimeRange): TreeNode[] {
    const result: TreeNode[] = [];

    const traverse = (node: TreeNode): void => {
      // Check if node overlaps with query range
      if (!this.#rangesOverlap(node.timeRange, range)) {
        return;
      }

      // Update last accessed time
      node.lastAccessed = Date.now();

      // If leaf node, add to result
      if (node.children.length === 0) {
        result.push(node);
        return;
      }

      // Recursively search children
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(this.#root);
    return result;
  }

  // Check if two time ranges overlap
  #rangesOverlap(range1: TimeRange, range2: TimeRange): boolean {
    return compareTime(range1.start, range2.end) < 0 && compareTime(range2.start, range1.end) < 0;
  }

  // Load data for a specific node
  async #loadNode(node: TreeNode, topics: TopicSelection): Promise<void> {
    if (node.isLoaded || this.#loadingPromises.has(node.id)) {
      await (this.#loadingPromises.get(node.id) ?? Promise.resolve());
      return;
    }

    const loadPromise = this.#doLoadNode(node, topics);
    this.#loadingPromises.set(node.id, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.#loadingPromises.delete(node.id);
    }
  }

  async #doLoadNode(node: TreeNode, topics: TopicSelection): Promise<void> {
    if (node.children.length > 0) {
      throw new Error("Cannot load data for non-leaf node");
    }

    try {
      // Use messageIterator to load messages for this time range
      const messageIterator = this.#args.source.messageIterator({
        topics,
        start: node.timeRange.start,
        end: node.timeRange.end,
      });

      // Collect messages from the iterator
      const messagesByTopic: Record<string, MessageEvent[]> = {};
      let totalSize = 0;

      for await (const result of messageIterator) {
        if (result.type === "alert") {
          this.#problems.push({
            severity: "error",
            message: `Alert during loading: ${result.alert.message}`,
            error: result.alert,
          });
          continue;
        }

        if (result.type === "stamp") {
          continue;
        }

        // result.type === "message-event"
        const { msgEvent } = result;
        const topic = msgEvent.topic;

        if (!messagesByTopic[topic]) {
          messagesByTopic[topic] = [];
        }

        messagesByTopic[topic]!.push(msgEvent);
        totalSize += typeof msgEvent.sizeInBytes === "number" ? msgEvent.sizeInBytes : 0;
      }

      // Update node with loaded data
      node.messagesByTopic = messagesByTopic;
      node.needTopics = topics;
      node.sizeInBytes = totalSize;
      node.isLoaded = true;
      node.lastAccessed = Date.now();

      // Update aggregated stats
      node.aggregatedStats.totalMessages = Object.values(messagesByTopic).reduce(
        (sum, msgs) => sum + msgs.length,
        0,
      );
      node.aggregatedStats.totalSizeInBytes = totalSize;
      node.aggregatedStats.topicsPresent = new Set(Object.keys(messagesByTopic));
      node.aggregatedStats.fullyLoadedTopics = new Set(
        Object.keys(messagesByTopic).filter((topic) => topics.has(topic)),
      );

      // Add to loaded nodes cache
      this.#loadedNodes.set(node.id, node);

      // Update parent aggregations
      this.#updateAggregations(node);

      // Evict nodes if we exceed cache size
      this.#evictNodesIfNeeded();
    } catch (error) {
      this.#problems.push({
        severity: "error",
        message: `Failed to load node ${node.id}: ${error}`,
        error,
      });
    }
  }

  // Update aggregated statistics up the tree
  #updateAggregations(node: TreeNode): void {
    let current = node.parent;

    while (current) {
      // Recalculate aggregated stats from children
      let totalMessages = 0;
      let totalSizeInBytes = 0;
      const allTopics = new Set<string>();
      const fullyLoadedTopics = new Set<string>();

      for (const child of current.children) {
        totalMessages += child.aggregatedStats.totalMessages;
        totalSizeInBytes += child.aggregatedStats.totalSizeInBytes;

        for (const topic of child.aggregatedStats.topicsPresent) {
          allTopics.add(topic);
        }

        for (const topic of child.aggregatedStats.fullyLoadedTopics) {
          fullyLoadedTopics.add(topic);
        }
      }

      current.aggregatedStats.totalMessages = totalMessages;
      current.aggregatedStats.totalSizeInBytes = totalSizeInBytes;
      current.aggregatedStats.topicsPresent = allTopics;
      current.aggregatedStats.fullyLoadedTopics = fullyLoadedTopics;

      current = current.parent;
    }
  }

  // Evict least recently used nodes to stay within memory limits
  #evictNodesIfNeeded(): void {
    if (this.#loadedNodes.size <= LRU_CACHE_SIZE) {
      return;
    }

    // Sort nodes by last accessed time (LRU first)
    const sortedNodes = Array.from(this.#loadedNodes.values()).sort(
      (a, b) => a.lastAccessed - b.lastAccessed,
    );

    // Only evict nodes that are not preserved for allFrames
    const evictableNodes = sortedNodes.filter((node) => !node.preserveForAllFrames);

    // Remove oldest nodes until we're under the limit
    const nodesToRemove = evictableNodes.slice(0, Math.max(0, this.#loadedNodes.size - LRU_CACHE_SIZE));

    for (const node of nodesToRemove) {
      this.#evictNode(node);
    }
  }

  #evictNode(node: TreeNode): void {
    // Clear node data but keep structure
    node.messagesByTopic = undefined;
    node.needTopics = undefined;
    node.sizeInBytes = 0;
    node.isLoaded = false;

    // Remove from loaded nodes cache
    this.#loadedNodes.delete(node.id);

    // Update aggregations
    this.#updateAggregations(node);
  }

  // Build BlockCache view for compatibility with existing code (active/loaded blocks only)
  #buildBlockCacheView(): BlockCache {
    // Convert tree structure to virtual blocks
    const leafNodes = this.#getAllLeafNodes();

    // Sort leaf nodes by start time to create linear block array
    leafNodes.sort((a, b) => compareTime(a.timeRange.start, b.timeRange.start));

    // Only include blocks that have actual message data (non-empty blocks)
    const nonEmptyLeafNodes = leafNodes.filter((node): node is TreeNode => 
      node.isLoaded && 
      node.messagesByTopic != undefined && 
      Object.keys(node.messagesByTopic).length > 0 &&
      node.sizeInBytes > 0
    );

    // Mark these nodes as preserved for allFrames since they're being accessed
    for (const node of nonEmptyLeafNodes) {
      node.preserveForAllFrames = true;
    }

    const blocks: MessageBlock[] = nonEmptyLeafNodes.map((node) => ({
      messagesByTopic: node.messagesByTopic!,
      needTopics: node.needTopics ?? new Map(),
      ageOfOldestMessage: undefined, // Calculate if needed
      sizeInBytes: node.sizeInBytes,
    }));

    log.info("[TREE LOADER] buildBlockCacheView (active):", {
      totalLeafNodesCount: leafNodes.length,
      nonEmptyLeafNodesCount: nonEmptyLeafNodes.length,
      blocksCount: blocks.length,
      loadedNodesCount: this.#loadedNodes.size,
      preservedNodesCount: Array.from(this.#loadedNodes.values()).filter(n => n.preserveForAllFrames).length,
      // Log details about each block's messages
      blockDetails: blocks.map((block, index) => ({
        index,
        topics: Object.keys(block.messagesByTopic),
        messageCountPerTopic: _.mapValues(block.messagesByTopic, (messages) => messages.length),
        totalMessages: Object.values(block.messagesByTopic).reduce((sum, msgs) => sum + msgs.length, 0),
        sizeInBytes: block.sizeInBytes,
      })),
    });

    return {
      blocks,
      startTime: this.#root.timeRange.start,
    };
  }

  #getAllLeafNodes(): TreeNode[] {
    const leafNodes: TreeNode[] = [];

    const traverse = (node: TreeNode): void => {
      if (node.children.length === 0) {
        leafNodes.push(node);
      } else {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.#root);
    return leafNodes;
  }

  // Calculate progress for UI updates
  #calculateProgress(): Progress {
    if (!this.#currentTopics) {
      return {
        fullyLoadedFractionRanges: [],
        messageCache: this.#buildBlockCacheView(),
        memoryInfo: { [MEMORY_INFO_PRELOADED_MSGS]: 0 },
      };
    }

    const leafNodes = this.#getAllLeafNodes();
    const ranges: Range[] = [];

    for (const node of leafNodes) {
      if (node.isLoaded && node.needTopics) {
        // Check if all requested topics are loaded
        const allTopicsLoaded = Array.from(this.#currentTopics.keys()).every((topic) =>
          node.aggregatedStats.fullyLoadedTopics.has(topic),
        );

        if (allTopicsLoaded) {
          const startSec = node.timeRange.start.sec + node.timeRange.start.nsec / 1e9;
          const endSec = node.timeRange.end.sec + node.timeRange.end.nsec / 1e9;
          ranges.push({ start: startSec, end: endSec });
        }
      }
    }

    return {
      fullyLoadedFractionRanges: ranges,
      messageCache: this.#buildBlockCacheView(),
      memoryInfo: {
        [MEMORY_INFO_PRELOADED_MSGS]: this.#root.aggregatedStats.totalSizeInBytes,
      },
    };
  }

  // Public interface methods (identical to BlockLoader)

  public setTopics(topics: TopicSelection): void {
    log.info("[TREE LOADER] setTopics called with:", {
      topicsSize: topics.size,
      topicsArray: Array.from(topics.keys()),
      currentTopicsSize: this.#currentTopics?.size ?? 0,
      currentTopicsArray: this.#currentTopics ? Array.from(this.#currentTopics.keys()) : [],
    });

    // Check if topics actually changed
    if (this.#currentTopics && _.isEqual(this.#currentTopics, topics)) {
      log.info("[TREE LOADER] Topics unchanged, returning early");
      return;
    }

    this.#currentTopics = topics;

    // Clear existing loaded data that doesn't match new topics
    for (const node of this.#loadedNodes.values()) {
      if (node.needTopics && !_.isEqual(node.needTopics, topics)) {
        this.#evictNode(node);
      }
    }
  }

  public async startLoading(args: LoadArgs): Promise<void> {
    this.#abortController?.abort();
    this.#abortController = new AbortController();

    log.info("[TREE LOADER] startLoading called with:", {
      startTime: args.startTime,
      endTime: args.endTime,
      hasProgressCallback: !!args.progress,
      currentTopicsSize: this.#currentTopics?.size ?? 0,
    });

    if (!this.#currentTopics || this.#currentTopics.size === 0) {
      log.info("[TREE LOADER] No topics to load, providing empty progress");
      
      // Still provide progress callback with empty messageCache so renderState gets updated
      const emptyProgress = {
        fullyLoadedFractionRanges: [],
        messageCache: { blocks: [], startTime: this.#root.timeRange.start },
        memoryInfo: { [MEMORY_INFO_PRELOADED_MSGS]: 0 },
      };
      
      if (args.progress != undefined) {
        args.progress(emptyProgress);
        log.info("[TREE LOADER] Empty progress callback called");
      }
      
      return;
    }

    try {
      // Find nodes that overlap with the requested time range
      const targetNodes = this.#findLeafNodesByTimeRange({
        start: args.startTime,
        end: args.endTime,
      });

      log.info("[TREE LOADER] Found target nodes:", targetNodes.length);

      // Load all target nodes in parallel
      const loadPromises = targetNodes.map(async (node) => {
        if (this.#currentTopics) {
          await this.#loadNode(node, this.#currentTopics);
        }
      });

      await Promise.all(loadPromises);

      // Emit progress update using the callback from args
      const progress = this.#calculateProgress();
      log.info("[TREE LOADER] Calculated progress:", {
        fullyLoadedRangesCount: progress.fullyLoadedFractionRanges?.length ?? 0,
        hasMessageCache: !!progress.messageCache,
        blocksCount: progress.messageCache?.blocks.length ?? 0,
      });

      if (args.progress != undefined) {
        args.progress(progress);
        log.info("[TREE LOADER] Progress callback called");
      }
    } catch (error) {
      if (!this.#abortController.signal.aborted) {
        this.#problems.push({
          severity: "error",
          message: `TreeLoader startLoading failed: ${error}`,
          error,
        });
      }
    }
  }

  public async stopLoading(): Promise<void> {
    this.#abortController?.abort();
    this.#abortController = undefined;

    // Wait for any pending loading operations to complete
    await Promise.all(this.#loadingPromises.values());
  }

  // Additional methods that might be needed for compatibility
  public getProblems(): PlayerProblem[] {
    return [...this.#problems];
  }

  public getProgress(): Progress {
    return this.#calculateProgress();
  }
}
