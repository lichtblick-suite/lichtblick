// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { captureException } from "@sentry/core";
import { isEqual, uniq } from "lodash";
import memoizeWeak from "memoize-weak";
import shallowequal from "shallowequal";
import { v4 as uuidv4 } from "uuid";

import { Condvar, MutexLocked } from "@foxglove/den/async";
import Log from "@foxglove/log";
import { Time, compare } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import getPrettifiedCode from "@foxglove/studio-base/panels/NodePlayground/getPrettifiedCode";
import { MemoizedLibGenerator } from "@foxglove/studio-base/players/UserNodePlayer/MemoizedLibGenerator";
import { generateTypesLib } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/generateTypesLib";
import { TransformArgs } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/types";
import {
  Diagnostic,
  DiagnosticSeverity,
  ErrorCodes,
  NodeData,
  NodeRegistration,
  ProcessMessageOutput,
  RegistrationOutput,
  Sources,
  UserNodeLog,
} from "@foxglove/studio-base/players/UserNodePlayer/types";
import { hasTransformerErrors } from "@foxglove/studio-base/players/UserNodePlayer/utils";
import {
  AdvertiseOptions,
  Player,
  PlayerState,
  PlayerStateActiveData,
  PublishPayload,
  SubscribePayload,
  Topic,
  MessageEvent,
  PlayerProblem,
  MessageBlock,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { UserNode, UserNodes } from "@foxglove/studio-base/types/panels";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { basicDatatypes } from "@foxglove/studio-base/util/basicDatatypes";

const log = Log.getLogger(__filename);

// TypeScript's built-in lib only accepts strings for the scriptURL. However, webpack only
// understands `new URL()` to properly build the worker entry point:
// https://github.com/webpack/webpack/issues/13043
declare let SharedWorker: {
  prototype: SharedWorker;
  new (scriptURL: URL, options?: string | WorkerOptions): SharedWorker;
};

type UserNodeActions = {
  setUserNodeDiagnostics: (nodeId: string, diagnostics: readonly Diagnostic[]) => void;
  addUserNodeLogs: (nodeId: string, logs: readonly UserNodeLog[]) => void;
  setUserNodeRosLib: (rosLib: string) => void;
  setUserNodeTypesLib: (lib: string) => void;
};

type NodeRegistrationCacheItem = {
  nodeId: string;
  userNode: UserNode;
  result: NodeRegistration;
};

function maybePlainObject(rawVal: unknown) {
  if (typeof rawVal === "object" && rawVal && "toJSON" in rawVal) {
    return (rawVal as { toJSON: () => unknown }).toJSON();
  }
  return rawVal;
}

/** Mutable state protected by a mutex lock */
type ProtectedState = {
  nodeRegistrationCache: NodeRegistrationCacheItem[];
  nodeRegistrations: readonly NodeRegistration[];
  lastPlayerStateActiveData?: PlayerStateActiveData;
  userNodes: UserNodes;

  /**
   * Map of output topics to input topics. To produce an output we need to know the input topics
   * that a script requires. When subscribers subscribe to the output topic, the user node player
   * subscribes to the underlying input topics.
   */
  inputsByOutputTopic: Map<string, readonly string[]>;
};

export default class UserNodePlayer implements Player {
  private _player: Player;

  // Datatypes and topics are derived from nodeRegistrations, but memoized so they only change when needed
  private _memoizedNodeDatatypes: readonly RosDatatypes[] = [];
  private _memoizedNodeTopics: readonly Topic[] = [];

  private _subscriptions: SubscribePayload[] = [];
  private _nodeSubscriptions: Record<string, SubscribePayload> = {};

  // listener for state updates
  private _listener?: (arg0: PlayerState) => Promise<void>;

  // Not sure if there is perf issue with unused workers (may just go idle) - requires more research
  private _unusedNodeRuntimeWorkers: Rpc[] = [];
  private _setUserNodeDiagnostics: (nodeId: string, diagnostics: readonly Diagnostic[]) => void;
  private _addUserNodeLogs: (nodeId: string, logs: UserNodeLog[]) => void;
  private _nodeTransformRpc?: Rpc;
  private _globalVariables: GlobalVariables = {};
  private _userNodeActions: UserNodeActions;
  private _rosLibGenerator: MemoizedLibGenerator;
  private _typesLibGenerator: MemoizedLibGenerator;

  // Player state changes when the child player invokes our player state listener
  // we may also emit state changes on internal errors
  private _playerState?: PlayerState;

  // The store tracks problems for individual userspace nodes
  // a node may set its own problem or clear its problem
  private _problemStore = new Map<string, PlayerProblem>();

  private _protectedState = new MutexLocked<ProtectedState>({
    userNodes: {},
    nodeRegistrations: [],
    nodeRegistrationCache: [],
    lastPlayerStateActiveData: undefined,
    inputsByOutputTopic: new Map(),
  });

  // exposed as a static to allow testing to mock/replace
  private static CreateNodeTransformWorker = (): SharedWorker => {
    return new SharedWorker(new URL("./nodeTransformerWorker/index", import.meta.url), {
      // Although we are using SharedWorkers, we do not actually want to share worker instances
      // between tabs. We achieve this by passing in a unique name.
      name: uuidv4(),
    });
  };

  // exposed as a static to allow testing to mock/replace
  private static CreateNodeRuntimeWorker = (): SharedWorker => {
    return new SharedWorker(new URL("./nodeRuntimeWorker/index", import.meta.url), {
      // Although we are using SharedWorkers, we do not actually want to share worker instances
      // between tabs. We achieve this by passing in a unique name.
      name: uuidv4(),
    });
  };

  public constructor(player: Player, userNodeActions: UserNodeActions) {
    this._player = player;
    this._userNodeActions = userNodeActions;
    const { setUserNodeDiagnostics, addUserNodeLogs } = userNodeActions;

    this._setUserNodeDiagnostics = (nodeId: string, diagnostics: readonly Diagnostic[]) => {
      setUserNodeDiagnostics(nodeId, diagnostics);
    };
    this._addUserNodeLogs = (nodeId: string, logs: UserNodeLog[]) => {
      if (logs.length > 0) {
        addUserNodeLogs(nodeId, logs);
      }
    };

    this._typesLibGenerator = new MemoizedLibGenerator(async (args) => {
      const lib = generateTypesLib({
        topics: args.topics,
        datatypes: new Map([...basicDatatypes, ...args.datatypes]),
      });

      return await getPrettifiedCode(lib);
    });

    this._rosLibGenerator = new MemoizedLibGenerator(async (args) => {
      const transformWorker = this._getTransformWorker();
      return await transformWorker.send("generateRosLib", {
        topics: args.topics,
        // Include basic datatypes along with any custom datatypes.
        // Custom datatypes appear as the second array items to override any basicDatatype items
        datatypes: new Map([...basicDatatypes, ...args.datatypes]),
      });
    });
  }

  private _getTopics = memoizeWeak(
    (topics: readonly Topic[], nodeTopics: readonly Topic[]): Topic[] => [...topics, ...nodeTopics],
  );

  private _getDatatypes = memoizeWeak(
    (datatypes: RosDatatypes, nodeDatatypes: readonly RosDatatypes[]): RosDatatypes => {
      return nodeDatatypes.reduce(
        (allDatatypes, userNodeDatatypes) => new Map([...allDatatypes, ...userNodeDatatypes]),
        new Map([...datatypes, ...basicDatatypes]),
      );
    },
  );

  private _lastBlockRequest: {
    input?: {
      blocks: readonly (MessageBlock | undefined)[];
      globalVariables: GlobalVariables;
      nodeRegistrations: readonly NodeRegistration[];
    };
    result: (MessageBlock | undefined)[];
  } = { result: [] };

  // Basic memoization by remembering the last values passed to getMessages
  private _lastGetMessagesInput: {
    parsedMessages: readonly MessageEvent<unknown>[];
    globalVariables: GlobalVariables;
    nodeRegistrations: readonly NodeRegistration[];
  } = { parsedMessages: [], globalVariables: {}, nodeRegistrations: [] };
  private _lastGetMessagesResult: { parsedMessages: readonly MessageEvent<unknown>[] } = {
    parsedMessages: [],
  };

  // When updating nodes while paused, we seek to the current time
  // (i.e. invoke _getMessages with an empty array) to refresh messages
  private async _getMessages(
    parsedMessages: readonly MessageEvent<unknown>[],
    globalVariables: GlobalVariables,
    nodeRegistrations: readonly NodeRegistration[],
  ): Promise<{
    parsedMessages: readonly MessageEvent<unknown>[];
  }> {
    if (
      shallowequal(this._lastGetMessagesInput, {
        parsedMessages,
        globalVariables,
        nodeRegistrations,
      })
    ) {
      return this._lastGetMessagesResult;
    }
    const parsedMessagesPromises: Promise<MessageEvent<unknown> | undefined>[] = [];
    for (const message of parsedMessages) {
      const messagePromises = [];
      for (const nodeRegistration of nodeRegistrations) {
        if (
          this._nodeSubscriptions[nodeRegistration.output.name] &&
          nodeRegistration.inputs.includes(message.topic)
        ) {
          const messagePromise = nodeRegistration.processMessage(message, globalVariables);
          messagePromises.push(messagePromise);
          parsedMessagesPromises.push(messagePromise);
        }
      }
      await Promise.all(messagePromises);
    }

    const nodeParsedMessages = (await Promise.all(parsedMessagesPromises)).filter(
      (value): value is MessageEvent<unknown> => value != undefined,
    );

    const result = {
      parsedMessages: parsedMessages
        .concat(nodeParsedMessages)
        .sort((a, b) => compare(a.receiveTime, b.receiveTime)),
    };
    this._lastGetMessagesInput = { parsedMessages, globalVariables, nodeRegistrations };
    this._lastGetMessagesResult = result;
    return result;
  }

  private async _getBlocks(
    blocks: readonly (MessageBlock | undefined)[],
    globalVariables: GlobalVariables,
    nodeRegistrations: readonly NodeRegistration[],
  ): Promise<readonly (MessageBlock | undefined)[]> {
    if (
      shallowequal(this._lastBlockRequest.input, {
        blocks,
        globalVariables,
        nodeRegistrations,
      })
    ) {
      return this._lastBlockRequest.result;
    }

    // If no downstream subscriptions want blocks for our output topics we can just pass through
    // the blocks from the underlying player.
    const fullRegistrations = nodeRegistrations.filter(
      (reg) => this._nodeSubscriptions[reg.output.name]?.preloadType === "full",
    );
    if (fullRegistrations.length === 0) {
      return blocks;
    }

    const allInputTopics = uniq(fullRegistrations.flatMap((reg) => reg.inputs));

    const outputBlocks: (MessageBlock | undefined)[] = [];
    for (const block of blocks) {
      if (!block) {
        outputBlocks.push(block);
        continue;
      }

      // Flatten and re-sort block messages so that nodes see them in the same order
      // as the non-block nodes.
      const messagesByTopic = { ...block.messagesByTopic };
      const blockMessages = allInputTopics
        .flatMap((topic) => messagesByTopic[topic] ?? [])
        .sort((a, b) => compare(a.receiveTime, b.receiveTime));
      for (const nodeRegistration of fullRegistrations) {
        const outTopic = nodeRegistration.output.name;
        for (const message of blockMessages) {
          if (nodeRegistration.inputs.includes(message.topic)) {
            const outputMessage = await nodeRegistration.processMessage(message, globalVariables);
            if (outputMessage) {
              messagesByTopic[outTopic] ??= [];
              messagesByTopic[outTopic]?.push(outputMessage);
            }
          }
        }
      }

      // Note that this size doesn't include the new processed messqges. We may need
      // to recalculate this if it turns out to be important for good cache eviction
      // behavior.
      outputBlocks.push({
        messagesByTopic,
        sizeInBytes: block.sizeInBytes,
      });
    }

    this._lastBlockRequest = {
      input: { blocks, globalVariables, nodeRegistrations },
      result: outputBlocks,
    };

    return outputBlocks;
  }

  public setGlobalVariables(globalVariables: GlobalVariables): void {
    this._globalVariables = globalVariables;
  }

  // Called when userNode state is updated.
  public async setUserNodes(userNodes: UserNodes): Promise<void> {
    await this._protectedState.runExclusive(async (state) => {
      state.userNodes = userNodes;

      // Prune the node registration cache so it doesn't grow forever.
      // We add one to the count so we don't have to recompile nodes if users undo/redo node changes.
      const maxNodeRegistrationCacheCount = Object.keys(userNodes).length + 1;
      state.nodeRegistrationCache.splice(maxNodeRegistrationCacheCount);
      // This code causes us to reset workers twice because the seeking resets the workers too
      await this._resetWorkersUnlocked(state);
      this._setSubscriptionsUnlocked(this._subscriptions, state);
      const { currentTime, isPlaying = false } = state.lastPlayerStateActiveData ?? {};
      if (currentTime && !isPlaying) {
        this._player.seekPlayback?.(currentTime);
      }
    });
  }

  // Defines the inputs/outputs and worker interface of a user node.
  private async _createNodeRegistration(
    nodeId: string,
    userNode: UserNode,
    state: ProtectedState,
  ): Promise<NodeRegistration> {
    for (const cacheEntry of state.nodeRegistrationCache) {
      if (nodeId === cacheEntry.nodeId && isEqual(userNode, cacheEntry.userNode)) {
        return cacheEntry.result;
      }
    }
    // Pass all the nodes a set of basic datatypes that we know how to render.
    // These could be overwritten later by bag datatypes, but these datatype definitions should be very stable.
    const { topics = [], datatypes = new Map() } = state.lastPlayerStateActiveData ?? {};
    const nodeDatatypes: RosDatatypes = new Map([...basicDatatypes, ...datatypes]);

    const rosLib = await this._getRosLib(state);
    const typesLib = await this._getTypesLib(state);
    const { name, sourceCode } = userNode;
    const transformMessage: TransformArgs = {
      name,
      sourceCode,
      topics,
      rosLib,
      typesLib,
      datatypes: nodeDatatypes,
    };
    const transformWorker = this._getTransformWorker();
    const nodeData = await transformWorker.send<NodeData>("transform", transformMessage);
    const { inputTopics, outputTopic, transpiledCode, projectCode, outputDatatype } = nodeData;

    let rpc: Rpc | undefined;
    const terminateCondvar = new Condvar();

    // problemKey is a unique identifier for each userspace node so we can manage problems from
    // a specific node. A node may have a problem that may later clear. Using the key we can add/remove
    // problems for specific userspace nodes independently of other userspace nodes.
    const problemKey = `node-id-${nodeId}`;

    const buildMessageProcessor = (): NodeRegistration["processMessage"] => {
      return async (msgEvent: MessageEvent<unknown>, globalVariables: GlobalVariables) => {
        const terminateSignal = terminateCondvar.wait();

        // Register the node within a web worker to be executed.
        if (!rpc) {
          rpc = this._unusedNodeRuntimeWorkers.pop();

          // initialize a new worker since no unused one is available
          if (!rpc) {
            const worker = UserNodePlayer.CreateNodeRuntimeWorker();

            worker.onerror = (event) => {
              log.error(event);

              this._problemStore.set(problemKey, {
                message: `User script runtime error: ${event.message}`,
                severity: "error",
              });

              // trigger listener updates
              void this._emitState();
            };

            const port: MessagePort = worker.port;
            port.onmessageerror = (event) => {
              log.error(event);

              this._problemStore.set(problemKey, {
                severity: "error",
                message: `User script runtime error: ${String(event.data)}`,
              });

              void this._emitState();
            };
            port.start();
            rpc = new Rpc(port);

            rpc.receive("error", (msg) => {
              log.error(msg);

              this._problemStore.set(problemKey, {
                severity: "error",
                message: `User script runtime error: ${msg}`,
              });

              void this._emitState();
            });
          }

          const { error, userNodeDiagnostics, userNodeLogs } = await rpc.send<RegistrationOutput>(
            "registerNode",
            {
              projectCode,
              nodeCode: transpiledCode,
            },
          );
          if (error != undefined) {
            this._setUserNodeDiagnostics(nodeId, [
              ...userNodeDiagnostics,
              {
                source: Sources.Runtime,
                severity: DiagnosticSeverity.Error,
                message: error,
                code: ErrorCodes.RUNTIME,
              },
            ]);
            return;
          }
          this._addUserNodeLogs(nodeId, userNodeLogs);
        }

        // To send the message over RPC we invoke maybePlainObject which calls toJSON on the message
        // and builds a plain js object of the entire message. This is expensive so a future enhancement
        // would be to send the underlying message array and build a lazy message reader
        const result = await Promise.race([
          rpc.send<ProcessMessageOutput>("processMessage", {
            message: {
              topic: msgEvent.topic,
              receiveTime: msgEvent.receiveTime,
              message: maybePlainObject(msgEvent.message),
              datatype: msgEvent.schemaName,
            },
            globalVariables,
          }),
          terminateSignal,
        ]);

        if (!result) {
          this._problemStore.set(problemKey, {
            message: `User Script ${nodeId} timed out`,
            severity: "warn",
          });
          return;
        }

        const allDiagnostics = result.userNodeDiagnostics;
        if (result.error) {
          allDiagnostics.push({
            source: Sources.Runtime,
            severity: DiagnosticSeverity.Error,
            message: result.error,
            code: ErrorCodes.RUNTIME,
          });
        }

        this._addUserNodeLogs(nodeId, result.userNodeLogs);

        if (allDiagnostics.length > 0) {
          this._problemStore.set(problemKey, {
            severity: "error",
            message: `User Script ${nodeId} encountered an error.`,
            tip: "Open the User Scripts panel and check the Problems tab for errors.",
          });

          this._setUserNodeDiagnostics(nodeId, allDiagnostics);
          return;
        }

        if (!result.message) {
          this._problemStore.set(problemKey, {
            severity: "warn",
            message: `User Script ${nodeId} did not produce a message.`,
            tip: "Check that all code paths in the user script return a message.",
          });
          return;
        }

        // At this point we've received a message successfully from the userspace node, therefore
        // we clear any previous problem from this node.
        this._problemStore.delete(problemKey);

        return {
          topic: outputTopic,
          receiveTime: msgEvent.receiveTime,
          message: result.message,
          sizeInBytes: msgEvent.sizeInBytes,
          schemaName: outputDatatype,
        };
      };
    };

    const terminate = () => {
      this._problemStore.delete(problemKey);
      terminateCondvar.notifyAll();
      if (rpc) {
        this._unusedNodeRuntimeWorkers.push(rpc);
        rpc = undefined;
      }
    };

    const result = {
      nodeId,
      nodeData,
      inputs: inputTopics,
      output: { name: outputTopic, datatype: outputDatatype },
      processMessage: buildMessageProcessor(),
      processBlockMessage: buildMessageProcessor(),
      terminate,
    };
    state.nodeRegistrationCache.push({ nodeId, userNode, result });
    return result;
  }

  private _getTransformWorker(): Rpc {
    if (!this._nodeTransformRpc) {
      const worker = UserNodePlayer.CreateNodeTransformWorker();

      // The errors below persist for the lifetime of the player.
      // They are not cleared because they are irrecoverable.

      worker.onerror = (event) => {
        log.error(event);

        this._problemStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${event.message}`,
        });

        void this._emitState();
      };

      const port: MessagePort = worker.port;
      port.onmessageerror = (event) => {
        log.error(event);

        this._problemStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${String(event.data)}`,
        });

        void this._emitState();
      };
      port.start();
      const rpc = new Rpc(port);

      rpc.receive("error", (msg) => {
        log.error(msg);

        this._problemStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${msg}`,
        });

        void this._emitState();
      });

      this._nodeTransformRpc = rpc;
    }
    return this._nodeTransformRpc;
  }

  // We need to reset workers in a variety of circumstances:
  // - When a user node is updated, added or deleted
  // - When we seek (in order to reset state)
  // - When a new child player is added
  private async _resetWorkersUnlocked(state: ProtectedState): Promise<void> {
    if (!state.lastPlayerStateActiveData) {
      return;
    }

    // This early return is an optimization measure so that the
    // `nodeRegistrations` array is not re-defined, which will invalidate
    // downstream caches. (i.e. `this._getTopics`)
    if (state.nodeRegistrations.length === 0 && Object.entries(state.userNodes).length === 0) {
      return;
    }

    for (const nodeRegistration of state.nodeRegistrations) {
      nodeRegistration.terminate();
    }

    const allNodeRegistrations = await Promise.all(
      Object.entries(state.userNodes).map(
        async ([nodeId, userNode]) => await this._createNodeRegistration(nodeId, userNode, state),
      ),
    );

    const validNodeRegistrations: NodeRegistration[] = [];
    const playerTopics = new Set(state.lastPlayerStateActiveData.topics.map((topic) => topic.name));
    const allNodeOutputs = new Set(
      allNodeRegistrations.map(({ nodeData }) => nodeData.outputTopic),
    );

    // Clear the output -> input map and re-populate it again with with all the node registrations
    state.inputsByOutputTopic.clear();

    for (const nodeRegistration of allNodeRegistrations) {
      const { nodeData, nodeId } = nodeRegistration;

      if (!nodeData.outputTopic) {
        this._setUserNodeDiagnostics(nodeId, [
          ...nodeData.diagnostics,
          {
            severity: DiagnosticSeverity.Error,
            message: `Output topic cannot be an empty string.`,
            source: Sources.OutputTopicChecker,
            code: ErrorCodes.OutputTopicChecker.NOT_UNIQUE,
          },
        ]);
        continue;
      }

      // Create diagnostic errors if more than one node outputs to the same topic
      if (state.inputsByOutputTopic.has(nodeData.outputTopic)) {
        this._setUserNodeDiagnostics(nodeId, [
          ...nodeData.diagnostics,
          {
            severity: DiagnosticSeverity.Error,
            message: `Output "${nodeData.outputTopic}" must be unique`,
            source: Sources.OutputTopicChecker,
            code: ErrorCodes.OutputTopicChecker.NOT_UNIQUE,
          },
        ]);
        continue;
      }

      // Record the required input topics to service this output topic
      state.inputsByOutputTopic.set(nodeData.outputTopic, nodeData.inputTopics);

      // Create diagnostic errors if node outputs overlap with real topics
      if (playerTopics.has(nodeData.outputTopic)) {
        this._setUserNodeDiagnostics(nodeId, [
          ...nodeData.diagnostics,
          {
            severity: DiagnosticSeverity.Error,
            message: `Output topic "${nodeData.outputTopic}" is already present in the data source`,
            source: Sources.OutputTopicChecker,
            code: ErrorCodes.OutputTopicChecker.EXISTING_TOPIC,
          },
        ]);
        continue;
      }

      // Filter out nodes with compilation errors
      if (hasTransformerErrors(nodeData)) {
        this._setUserNodeDiagnostics(nodeId, nodeData.diagnostics);
        continue;
      }

      // Throw if nodes use other nodes' outputs as inputs. We should never get here because we
      // already prevent outputs from being the same as real topics in the data source, and we
      // already filter out input topics that aren't present in the data source.
      for (const input of nodeData.inputTopics) {
        if (allNodeOutputs.has(input)) {
          throw new Error(`Input "${input}" cannot equal another node's output`);
        }
      }

      validNodeRegistrations.push(nodeRegistration);
    }

    state.nodeRegistrations = validNodeRegistrations;
    const nodeTopics = state.nodeRegistrations.map(({ output }) => output);
    if (!isEqual(nodeTopics, this._memoizedNodeTopics)) {
      this._memoizedNodeTopics = nodeTopics;
    }
    const nodeDatatypes = state.nodeRegistrations.map(({ nodeData: { datatypes } }) => datatypes);
    if (!isEqual(nodeDatatypes, this._memoizedNodeDatatypes)) {
      this._memoizedNodeDatatypes = nodeDatatypes;
    }

    for (const nodeRegistration of state.nodeRegistrations) {
      this._setUserNodeDiagnostics(nodeRegistration.nodeId, []);
    }
  }

  private async _getRosLib(state: ProtectedState): Promise<string> {
    if (!state.lastPlayerStateActiveData) {
      throw new Error("_getRosLib was called before `_lastPlayerStateActiveData` set");
    }

    const { topics, datatypes } = state.lastPlayerStateActiveData;
    const { didUpdate, lib } = await this._rosLibGenerator.update({ topics, datatypes });
    if (didUpdate) {
      this._userNodeActions.setUserNodeRosLib(lib);
    }

    return lib;
  }

  private async _getTypesLib(state: ProtectedState): Promise<string> {
    if (!state.lastPlayerStateActiveData) {
      throw new Error("_getTypesLib was called before `_lastPlayerStateActiveData` set");
    }

    const { topics, datatypes } = state.lastPlayerStateActiveData;
    const { didUpdate, lib } = await this._typesLibGenerator.update({ topics, datatypes });
    if (didUpdate) {
      this._userNodeActions.setUserNodeTypesLib(lib);
    }

    return lib;
  }

  // invoked when our child player state changes
  private async _onPlayerState(playerState: PlayerState) {
    try {
      const globalVariables = this._globalVariables;
      const { activeData } = playerState;
      if (!activeData) {
        this._playerState = playerState;
        await this._emitState();
        return;
      }

      const { messages, topics, datatypes } = activeData;

      // If we do not have active player data from a previous call, then our
      // player just spun up, meaning we should re-run our user nodes in case
      // they have inputs that now exist in the current player context.
      const newPlayerState = await this._protectedState.runExclusive(async (state) => {
        if (!state.lastPlayerStateActiveData) {
          state.lastPlayerStateActiveData = activeData;
          await this._resetWorkersUnlocked(state);
          this._setSubscriptionsUnlocked(this._subscriptions, state);
        } else {
          // Reset node state after seeking
          let shouldReset =
            activeData.lastSeekTime !== state.lastPlayerStateActiveData.lastSeekTime;

          // When topics or datatypes change we also need to re-build the nodes so we clear the cache
          if (
            activeData.topics !== state.lastPlayerStateActiveData.topics ||
            activeData.datatypes !== state.lastPlayerStateActiveData.datatypes
          ) {
            shouldReset = true;
            state.nodeRegistrationCache = [];
          }

          state.lastPlayerStateActiveData = activeData;
          if (shouldReset) {
            await this._resetWorkersUnlocked(state);
          }
        }

        const allDatatypes = this._getDatatypes(datatypes, this._memoizedNodeDatatypes);

        const { parsedMessages } = await this._getMessages(
          messages,
          globalVariables,
          state.nodeRegistrations,
        );

        const playerProgress = {
          ...playerState.progress,
        };

        if (playerProgress.messageCache) {
          const newBlocks = await this._getBlocks(
            playerProgress.messageCache.blocks,
            globalVariables,
            state.nodeRegistrations,
          );

          playerProgress.messageCache = {
            startTime: playerProgress.messageCache.startTime,
            blocks: newBlocks,
          };
        }

        return {
          ...playerState,
          progress: playerProgress,
          activeData: {
            ...activeData,
            messages: parsedMessages,
            topics: this._getTopics(topics, this._memoizedNodeTopics),
            datatypes: allDatatypes,
          },
        };
      });

      this._playerState = newPlayerState;

      // clear any previous problem we had from making a new player state
      this._problemStore.delete("player-state-update");
    } catch (err) {
      this._problemStore.set("player-state-update", {
        severity: "error",
        message: err.message,
        error: err,
      });

      this._playerState = playerState;
    } finally {
      await this._emitState();
    }
  }

  private async _emitState() {
    if (!this._playerState) {
      return;
    }

    // only augment child problems if we have our own problems
    // if neither child or parent have problems we do nothing
    let problems = this._playerState.problems;
    if (this._problemStore.size > 0) {
      problems = (problems ?? []).concat(Array.from(this._problemStore.values()));
    }

    const playerState: PlayerState = {
      ...this._playerState,
      problems,
    };

    if (this._listener) {
      await this._listener(playerState);
    }
  }

  public setListener(listener: NonNullable<UserNodePlayer["_listener"]>): void {
    this._listener = listener;

    // Delay _player.setListener until our setListener is called because setListener in some cases
    // triggers initialization logic and remote requests. This is an unfortunate API behavior and
    // naming choice, but it's better for us not to do trigger this logic in the constructor.
    this._player.setListener(async (state) => await this._onPlayerState(state));
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._subscriptions = subscriptions;
    this._protectedState
      .runExclusive(async (state) => {
        this._setSubscriptionsUnlocked(subscriptions, state);
      })
      .catch((err) => {
        log.error(err);
        captureException(err);
      });
  }

  private _setSubscriptionsUnlocked(
    subscriptions: SubscribePayload[],
    state: ProtectedState,
  ): void {
    const nodeSubscriptions: Record<string, SubscribePayload> = {};
    const realTopicSubscriptions: SubscribePayload[] = [];

    // For each subscription, identify required input topics by looking up the subscribed topic in
    // the map of output topics -> inputs. Add these required input topics to the set of topic
    // subscriptions to the underlying player.
    for (const subscription of subscriptions) {
      const inputs = state.inputsByOutputTopic.get(subscription.topic);
      if (!inputs) {
        nodeSubscriptions[subscription.topic] = subscription;
        realTopicSubscriptions.push(subscription);
        continue;
      }

      // If the inputs array is empty then we don't have anything to subscribe to for this output
      if (inputs.length === 0) {
        continue;
      }

      nodeSubscriptions[subscription.topic] = subscription;
      for (const inputTopic of inputs) {
        realTopicSubscriptions.push({
          topic: inputTopic,
          preloadType: subscription.preloadType ?? "partial",
        });
      }
    }

    this._nodeSubscriptions = nodeSubscriptions;
    this._player.setSubscriptions(realTopicSubscriptions);
  }

  public close = (): void => {
    void this._protectedState.runExclusive(async (state) => {
      for (const nodeRegistration of state.nodeRegistrations) {
        nodeRegistration.terminate();
      }
    });
    this._player.close();
    if (this._nodeTransformRpc) {
      void this._nodeTransformRpc.send("close");
    }
  };

  public setPublishers(publishers: AdvertiseOptions[]): void {
    this._player.setPublishers(publishers);
  }

  public setParameter(key: string, value: ParameterValue): void {
    this._player.setParameter(key, value);
  }

  public publish(request: PublishPayload): void {
    this._player.publish(request);
  }

  public async callService(service: string, request: unknown): Promise<unknown> {
    return await this._player.callService(service, request);
  }

  public startPlayback(): void {
    this._player.startPlayback?.();
  }

  public pausePlayback(): void {
    this._player.pausePlayback?.();
  }

  public playUntil(time: Time): void {
    if (this._player.playUntil) {
      this._player.playUntil(time);
      return;
    }
    this._player.seekPlayback?.(time);
  }

  public setPlaybackSpeed(speed: number): void {
    this._player.setPlaybackSpeed?.(speed);
  }

  public seekPlayback(time: Time, backfillDuration?: Time): void {
    this._player.seekPlayback?.(time, backfillDuration);
  }
}
