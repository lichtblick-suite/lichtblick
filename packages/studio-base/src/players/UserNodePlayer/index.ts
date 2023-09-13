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

import { Mutex } from "async-mutex";
import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";
import * as R from "ramda";
import ReactDOM from "react-dom";
import shallowequal from "shallowequal";
import { v4 as uuidv4 } from "uuid";

import { MutexLocked } from "@foxglove/den/async";
import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import { Time, compare } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import { mergeSubscriptions } from "@foxglove/studio-base/components/MessagePipeline/subscriptions";
import { Asset } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
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
import { reportError } from "@foxglove/studio-base/reportError";
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
  #player: Player;

  // Datatypes and topics are derived from nodeRegistrations, but memoized so they only change when needed
  #memoizedNodeDatatypes: readonly RosDatatypes[] = [];
  #memoizedNodeTopics: readonly Topic[] = [];

  #subscriptions: SubscribePayload[] = [];
  #nodeSubscriptions: Record<string, SubscribePayload> = {};

  // listener for state updates
  #listener?: (arg0: PlayerState) => Promise<void>;

  // Not sure if there is perf issue with unused workers (may just go idle) - requires more research
  #unusedNodeRuntimeWorkers: Rpc[] = [];
  #setUserNodeDiagnostics: (nodeId: string, diagnostics: readonly Diagnostic[]) => void;
  #addUserNodeLogs: (nodeId: string, logs: UserNodeLog[]) => void;
  #nodeTransformRpc?: Rpc;
  #globalVariables: GlobalVariables = {};
  #userNodeActions: UserNodeActions;
  #rosLibGenerator: MemoizedLibGenerator;
  #typesLibGenerator: MemoizedLibGenerator;

  // Player state changes when the child player invokes our player state listener
  // we may also emit state changes on internal errors
  #playerState?: PlayerState;

  // The store tracks problems for individual userspace nodes
  // a node may set its own problem or clear its problem
  #problemStore = new Map<string, PlayerProblem>();

  // keep track of last message on all topics to recompute output topic messages when user nodes change
  #lastMessageByInputTopic = new Map<string, MessageEvent>();
  #userNodeIdsNeedUpdate = new Set<string>();

  #protectedState = new MutexLocked<ProtectedState>({
    userNodes: {},
    nodeRegistrations: [],
    nodeRegistrationCache: [],
    lastPlayerStateActiveData: undefined,
    inputsByOutputTopic: new Map(),
  });

  readonly #emitLock = new Mutex();

  // exposed as a static to allow testing to mock/replace
  public static CreateNodeTransformWorker = (): SharedWorker => {
    // foxglove-depcheck-used: babel-plugin-transform-import-meta
    return new SharedWorker(new URL("./nodeTransformerWorker/index", import.meta.url), {
      // Although we are using SharedWorkers, we do not actually want to share worker instances
      // between tabs. We achieve this by passing in a unique name.
      name: uuidv4(),
    });
  };

  // exposed as a static to allow testing to mock/replace
  public static CreateNodeRuntimeWorker = (): SharedWorker => {
    // foxglove-depcheck-used: babel-plugin-transform-import-meta
    return new SharedWorker(new URL("./nodeRuntimeWorker/index", import.meta.url), {
      // Although we are using SharedWorkers, we do not actually want to share worker instances
      // between tabs. We achieve this by passing in a unique name.
      name: uuidv4(),
    });
  };

  public constructor(player: Player, userNodeActions: UserNodeActions) {
    this.#player = player;
    this.#userNodeActions = userNodeActions;
    const { setUserNodeDiagnostics, addUserNodeLogs } = userNodeActions;

    this.#setUserNodeDiagnostics = (nodeId: string, diagnostics: readonly Diagnostic[]) => {
      setUserNodeDiagnostics(nodeId, diagnostics);
    };
    this.#addUserNodeLogs = (nodeId: string, logs: UserNodeLog[]) => {
      if (logs.length > 0) {
        addUserNodeLogs(nodeId, logs);
      }
    };

    this.#typesLibGenerator = new MemoizedLibGenerator(async (args) => {
      const lib = generateTypesLib({
        topics: args.topics,
        datatypes: new Map([...basicDatatypes, ...args.datatypes]),
      });

      // Do not prettify the types library as it can cause severe performance
      // degradations. This is OK because the generated types library is
      // read-only and should be rarely read by a human. Further, the
      // not-prettified code is not that bad either. It just lacks the
      // appropriate indentations.
      return lib;
    });

    this.#rosLibGenerator = new MemoizedLibGenerator(async (args) => {
      const transformWorker = this.#getTransformWorker();
      return await transformWorker.send("generateRosLib", {
        topics: args.topics,
        // Include basic datatypes along with any custom datatypes.
        // Custom datatypes appear as the second array items to override any basicDatatype items
        datatypes: new Map([...basicDatatypes, ...args.datatypes]),
      });
    });
  }

  #getTopics = memoizeWeak((topics: readonly Topic[], nodeTopics: readonly Topic[]): Topic[] => [
    ...topics,
    ...nodeTopics,
  ]);

  #getDatatypes = memoizeWeak(
    (datatypes: RosDatatypes, nodeDatatypes: readonly RosDatatypes[]): RosDatatypes => {
      return nodeDatatypes.reduce(
        (allDatatypes, userNodeDatatypes) => new Map([...allDatatypes, ...userNodeDatatypes]),
        new Map([...basicDatatypes, ...datatypes]),
      );
    },
  );

  #lastBlockRequest: {
    input?: {
      blocks: readonly (MessageBlock | undefined)[];
      globalVariables: GlobalVariables;
      nodeRegistrations: readonly NodeRegistration[];
    };
    result: (MessageBlock | undefined)[];
  } = { result: [] };

  // Processes input messages through nodes to create messages on output topics
  async #getMessages(
    inputMessages: readonly MessageEvent[],
    globalVariables: GlobalVariables,
    nodeRegistrations: readonly NodeRegistration[],
  ): Promise<readonly MessageEvent[]> {
    // fast-track if there's no input and return empty output
    if (inputMessages.length === 0) {
      return [];
    }

    const identity = <T>(item: T) => item;

    const outputMessages: MessageEvent[] = [];
    for (const message of inputMessages) {
      const messagePromises = [];
      for (const nodeRegistration of nodeRegistrations) {
        if (
          this.#nodeSubscriptions[nodeRegistration.output.name] &&
          nodeRegistration.inputs.includes(message.topic)
        ) {
          const messagePromise = nodeRegistration.processMessage(message, globalVariables);
          messagePromises.push(messagePromise);
        }
      }
      const output = await Promise.all(messagePromises);
      outputMessages.push(...filterMap(output, identity));
    }

    return outputMessages;
  }

  async #getBlocks(
    blocks: readonly (MessageBlock | undefined)[],
    globalVariables: GlobalVariables,
    nodeRegistrations: readonly NodeRegistration[],
  ): Promise<readonly (MessageBlock | undefined)[]> {
    if (
      shallowequal(this.#lastBlockRequest.input, {
        blocks,
        globalVariables,
        nodeRegistrations,
      })
    ) {
      return this.#lastBlockRequest.result;
    }

    // If no downstream subscriptions want blocks for our output topics we can just pass through
    // the blocks from the underlying player.
    const fullRegistrations = nodeRegistrations.filter(
      (reg) => this.#nodeSubscriptions[reg.output.name]?.preloadType === "full",
    );
    if (fullRegistrations.length === 0) {
      return blocks;
    }

    const allInputTopics = _.uniq(fullRegistrations.flatMap((reg) => reg.inputs));

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
        // Clear out any previously processed messages that were previously in the output topic.
        // otherwise it will contain duplicates.
        if (messagesByTopic[outTopic] != undefined) {
          messagesByTopic[outTopic] = [];
        }

        for (const message of blockMessages) {
          if (nodeRegistration.inputs.includes(message.topic)) {
            const outputMessage = await nodeRegistration.processBlockMessage(
              message,
              globalVariables,
            );
            if (outputMessage) {
              // https://github.com/typescript-eslint/typescript-eslint/issues/6632
              if (!messagesByTopic[outTopic]) {
                messagesByTopic[outTopic] = [];
              }
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
        needTopics: block.needTopics,
        sizeInBytes: block.sizeInBytes,
      });
    }

    this.#lastBlockRequest = {
      input: { blocks, globalVariables, nodeRegistrations },
      result: outputBlocks,
    };

    return outputBlocks;
  }

  public setGlobalVariables(globalVariables: GlobalVariables): void {
    this.#globalVariables = globalVariables;
  }

  // Called when userNode state is updated (i.e. scripts are saved)
  public async setUserNodes(userNodes: UserNodes): Promise<void> {
    const newPlayerState = await this.#protectedState.runExclusive(async (state) => {
      for (const nodeId of Object.keys(userNodes)) {
        const prevNode = state.userNodes[nodeId];
        const newNode = userNodes[nodeId];
        if (prevNode && newNode && prevNode.sourceCode !== newNode.sourceCode) {
          // if source code of a userNode changed then we need to mark it for re-processing input messages
          this.#userNodeIdsNeedUpdate.add(nodeId);
        }
      }
      state.userNodes = userNodes;

      // Prune the node registration cache so it doesn't grow forever.
      // We add one to the count so we don't have to recompile nodes if users undo/redo node changes.
      const maxNodeRegistrationCacheCount = Object.keys(userNodes).length + 1;
      state.nodeRegistrationCache.splice(maxNodeRegistrationCacheCount);
      // This code causes us to reset workers twice because the seeking resets the workers too
      await this.#resetWorkersUnlocked(state);
      this.#setSubscriptionsUnlocked(this.#subscriptions, state);

      const playerState = this.#playerState;
      const lastActive = state.lastPlayerStateActiveData;
      // If we have previous player state and are paused, then we re-emit the last active data so
      // any panels that want our output topic get the updated message.
      //
      // Note: Until we learn otherwise, we assume that if a player is playing, it will emit new
      // player state that will output new messages so we don't emit here while playing.
      if (playerState && lastActive?.isPlaying === false) {
        return {
          ...playerState,
          activeData: {
            ...lastActive,
            // We want to avoid re-emitting upstream data source messages into panels to maintain
            // the invariant that the player emits a data-source message into "currentFrame" only once.
            //
            // Using an empty messages array will make user node player only emit the script output
            // messages as a result of the updated script.
            messages: [],
          },
        };
      }

      return undefined;
    });

    if (newPlayerState) {
      await this.#onPlayerState(newPlayerState);
    }
  }

  // Defines the inputs/outputs and worker interface of a user node.
  async #createNodeRegistration(
    nodeId: string,
    userNode: UserNode,
    state: ProtectedState,
    rosLib: string,
    typesLib: string,
  ): Promise<NodeRegistration> {
    for (const cacheEntry of state.nodeRegistrationCache) {
      if (nodeId === cacheEntry.nodeId && _.isEqual(userNode, cacheEntry.userNode)) {
        return cacheEntry.result;
      }
    }
    // Pass all the nodes a set of basic datatypes that we know how to render.
    // These could be overwritten later by bag datatypes, but these datatype definitions should be very stable.
    const { topics = [], datatypes = new Map() } = state.lastPlayerStateActiveData ?? {};
    const nodeDatatypes: RosDatatypes = new Map([...basicDatatypes, ...datatypes]);

    const { name, sourceCode } = userNode;
    const transformMessage: TransformArgs = {
      name,
      sourceCode,
      topics,
      rosLib,
      typesLib,
      datatypes: nodeDatatypes,
    };
    const transformWorker = this.#getTransformWorker();
    const nodeData = await transformWorker.send<NodeData>("transform", transformMessage);
    const { inputTopics, outputTopic, transpiledCode, projectCode, outputDatatype } = nodeData;

    // problemKey is a unique identifier for each userspace node so we can manage problems from
    // a specific node. A node may have a problem that may later clear. Using the key we can add/remove
    // problems for specific userspace nodes independently of other userspace nodes.
    const problemKey = `node-id-${nodeId}`;
    const buildMessageProcessor = (): {
      registration: NodeRegistration["processMessage"];
      terminate: () => void;
    } => {
      // rpc channel for this processor. Lazily created on each message if an unused
      // channel isn't available.
      let rpc: undefined | Rpc;

      const registration = async (msgEvent: MessageEvent, globalVariables: GlobalVariables) => {
        // Register the node within a web worker to be executed.
        if (!rpc) {
          rpc = this.#unusedNodeRuntimeWorkers.pop();

          // initialize a new worker since no unused one is available
          if (!rpc) {
            const worker = UserNodePlayer.CreateNodeRuntimeWorker();

            worker.onerror = (event) => {
              log.error(event);

              this.#problemStore.set(problemKey, {
                message: `User script runtime error: ${event.message}`,
                severity: "error",
              });

              // trigger listener updates
              void this.#queueEmitState();
            };

            const port: MessagePort = worker.port;
            port.onmessageerror = (event) => {
              log.error(event);

              this.#problemStore.set(problemKey, {
                severity: "error",
                message: `User script runtime error: ${String(event.data)}`,
              });

              void this.#queueEmitState();
            };
            port.start();
            rpc = new Rpc(port);

            rpc.receive("error", (msg) => {
              log.error(msg);

              this.#problemStore.set(problemKey, {
                severity: "error",
                message: `User script runtime error: ${msg}`,
              });

              void this.#queueEmitState();
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
            this.#setUserNodeDiagnostics(nodeId, [
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
          this.#addUserNodeLogs(nodeId, userNodeLogs);
        }

        // To send the message over RPC we need to send a plain JS object. We invoke
        // maybePlainObject which calls toJSON on the message and builds a plain js object of the
        // entire message.
        const result = await rpc.send<ProcessMessageOutput>("processMessage", {
          message: {
            topic: msgEvent.topic,
            receiveTime: msgEvent.receiveTime,
            message: maybePlainObject(msgEvent.message),
            datatype: msgEvent.schemaName,
          },
          globalVariables,
        });

        const allDiagnostics = result.userNodeDiagnostics;
        if (result.error) {
          allDiagnostics.push({
            source: Sources.Runtime,
            severity: DiagnosticSeverity.Error,
            message: result.error,
            code: ErrorCodes.RUNTIME,
          });
        }

        this.#addUserNodeLogs(nodeId, result.userNodeLogs);

        if (allDiagnostics.length > 0) {
          this.#problemStore.set(problemKey, {
            severity: "error",
            message: `User Script ${nodeId} encountered an error.`,
            tip: "Open the User Scripts panel and check the Problems tab for errors.",
          });

          this.#setUserNodeDiagnostics(nodeId, allDiagnostics);
          return;
        }

        if (!result.message) {
          this.#problemStore.set(problemKey, {
            severity: "warn",
            message: `User Script ${nodeId} did not produce a message.`,
            tip: "Check that all code paths in the user script return a message.",
          });
          return;
        }

        // At this point we've received a message successfully from the userspace node, therefore
        // we clear any previous problem from this node.
        this.#problemStore.delete(problemKey);

        return {
          topic: outputTopic,
          receiveTime: msgEvent.receiveTime,
          message: result.message,
          sizeInBytes: msgEvent.sizeInBytes,
          schemaName: outputDatatype,
        };
      };

      const terminate = () => {
        this.#problemStore.delete(problemKey);

        if (rpc) {
          this.#unusedNodeRuntimeWorkers.push(rpc);
          rpc = undefined;
        }
      };

      return { registration, terminate };
    };

    const messageProcessor = buildMessageProcessor();
    const blockProcessor = buildMessageProcessor();

    const result: NodeRegistration = {
      nodeId,
      nodeData,
      inputs: inputTopics,
      output: { name: outputTopic, schemaName: outputDatatype },
      processMessage: messageProcessor.registration,
      processBlockMessage: blockProcessor.registration,
      terminate: () => {
        messageProcessor.terminate();
        blockProcessor.terminate();
      },
    };
    state.nodeRegistrationCache.push({ nodeId, userNode, result });
    return result;
  }

  #getTransformWorker(): Rpc {
    if (!this.#nodeTransformRpc) {
      const worker = UserNodePlayer.CreateNodeTransformWorker();

      // The errors below persist for the lifetime of the player.
      // They are not cleared because they are irrecoverable.

      worker.onerror = (event) => {
        log.error(event);

        this.#problemStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${event.message}`,
        });

        void this.#queueEmitState();
      };

      const port: MessagePort = worker.port;
      port.onmessageerror = (event) => {
        log.error(event);

        this.#problemStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${String(event.data)}`,
        });

        void this.#queueEmitState();
      };
      port.start();
      const rpc = new Rpc(port);

      rpc.receive("error", (msg) => {
        log.error(msg);

        this.#problemStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${msg}`,
        });

        void this.#queueEmitState();
      });

      this.#nodeTransformRpc = rpc;
    }
    return this.#nodeTransformRpc;
  }

  // We need to reset workers in a variety of circumstances:
  // - When a user node is updated, added or deleted
  // - When we seek (in order to reset state)
  // - When a new child player is added
  async #resetWorkersUnlocked(state: ProtectedState): Promise<void> {
    if (!state.lastPlayerStateActiveData) {
      return;
    }

    // This early return is an optimization measure so that the
    // `nodeRegistrations` array is not re-defined, which will invalidate
    // downstream caches. (i.e. `this._getTopics`)
    if (state.nodeRegistrations.length === 0 && Object.entries(state.userNodes).length === 0) {
      return;
    }

    // teardown and cleanup any existing node registrations
    for (const nodeRegistration of state.nodeRegistrations) {
      nodeRegistration.terminate();
    }
    state.nodeRegistrations = [];

    const rosLib = await this.#getRosLib(state);
    const typesLib = await this.#getTypesLib(state);

    const allNodeRegistrations = await Promise.all(
      Object.entries(state.userNodes).map(
        async ([nodeId, userNode]) =>
          await this.#createNodeRegistration(nodeId, userNode, state, rosLib, typesLib),
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
        this.#setUserNodeDiagnostics(nodeId, [
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
        this.#setUserNodeDiagnostics(nodeId, [
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
        this.#setUserNodeDiagnostics(nodeId, [
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
        this.#setUserNodeDiagnostics(nodeId, nodeData.diagnostics);
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

    let changedTopicsRequireEmitState = false;
    state.nodeRegistrations = validNodeRegistrations;
    const nodeTopics = state.nodeRegistrations.map(({ output }) => output);
    if (!_.isEqual(nodeTopics, this.#memoizedNodeTopics)) {
      this.#memoizedNodeTopics = nodeTopics;
      changedTopicsRequireEmitState = true;
    }
    const nodeDatatypes = state.nodeRegistrations.map(({ nodeData: { datatypes } }) => datatypes);
    if (!_.isEqual(nodeDatatypes, this.#memoizedNodeDatatypes)) {
      this.#memoizedNodeDatatypes = nodeDatatypes;
      changedTopicsRequireEmitState = true;
    }

    // We need to set the user node diagnostics, which is a react set state
    // function. This is called once per user script. Since this is in an async
    // function, the state updates will not be batched below React 18 and React
    // will update components synchronously during the set state. In a complex
    // layout, each of the following _setUserNodeDiagnostics call result in
    // ~100ms of latency. With many scripts, this can turn into a multi-second
    // stall during layout switching.
    //
    // By batching the state update, unnecessary component updates are avoided
    // and performance is improved for layout switching and initial loading.
    //
    // Moving to React 18 should remove the need for this call.
    ReactDOM.unstable_batchedUpdates(() => {
      for (const nodeRegistration of state.nodeRegistrations) {
        this.#setUserNodeDiagnostics(nodeRegistration.nodeId, []);
      }
    });

    // If we have new topics after processing the node registrations we need to emit a new
    // state to let downstream clients subscribe to newly available topics. This is
    // necessary because we won't emit a new state otherwise if there are no other active
    // subscriptions.
    if (changedTopicsRequireEmitState && this.#playerState?.activeData) {
      const newTopics = _.unionBy(
        this.#playerState.activeData.topics,
        this.#memoizedNodeTopics,
        (top) => top.name,
      );
      const newDatatypes = this.#getDatatypes(
        this.#playerState.activeData.datatypes,
        this.#memoizedNodeDatatypes,
      );
      this.#playerState = {
        ...this.#playerState,
        activeData: {
          ...this.#playerState.activeData,
          datatypes: newDatatypes,
          topics: newTopics,
        },
      };
      await this.#queueEmitState();
    }
  }

  async #getRosLib(state: ProtectedState): Promise<string> {
    if (!state.lastPlayerStateActiveData) {
      throw new Error("_getRosLib was called before `_lastPlayerStateActiveData` set");
    }

    const { topics, datatypes } = state.lastPlayerStateActiveData;
    const { didUpdate, lib } = await this.#rosLibGenerator.update({ topics, datatypes });
    if (didUpdate) {
      this.#userNodeActions.setUserNodeRosLib(lib);
    }

    return lib;
  }

  async #getTypesLib(state: ProtectedState): Promise<string> {
    if (!state.lastPlayerStateActiveData) {
      throw new Error("_getTypesLib was called before `_lastPlayerStateActiveData` set");
    }

    const { topics, datatypes } = state.lastPlayerStateActiveData;
    const { didUpdate, lib } = await this.#typesLibGenerator.update({ topics, datatypes });
    if (didUpdate) {
      this.#userNodeActions.setUserNodeTypesLib(lib);
    }

    return lib;
  }

  // invoked when our child player state changes
  async #onPlayerState(playerState: PlayerState) {
    try {
      const globalVariables = this.#globalVariables;
      const { activeData } = playerState;
      if (!activeData) {
        this.#playerState = playerState;
        await this.#queueEmitState();
        return;
      }

      const { messages, topics, datatypes } = activeData;

      // If we do not have active player data from a previous call, then our
      // player just spun up, meaning we should re-run our user nodes in case
      // they have inputs that now exist in the current player context.
      const newPlayerState = await this.#protectedState.runExclusive(async (state) => {
        if (!state.lastPlayerStateActiveData) {
          state.lastPlayerStateActiveData = activeData;
          await this.#resetWorkersUnlocked(state);
          this.#setSubscriptionsUnlocked(this.#subscriptions, state);
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
            await this.#resetWorkersUnlocked(state);
          }
        }

        const allDatatypes = this.#getDatatypes(datatypes, this.#memoizedNodeDatatypes);

        /**
         * if nodes have been updated we need to add their previous input messages
         * to our list of messages to be parsed so that subscribers can refresh with
         * the new output topic messages
         */
        const inputTopicsForRecompute = new Set<string>();

        for (const userNodeId of this.#userNodeIdsNeedUpdate) {
          const nodeRegistration = state.nodeRegistrations.find(
            ({ nodeId }) => nodeId === userNodeId,
          );
          if (!nodeRegistration) {
            continue;
          }
          const inputTopics = nodeRegistration.inputs;

          for (const topic of inputTopics) {
            inputTopicsForRecompute.add(topic);
          }
        }

        // remove topics that already have messages in state, because we won't need to take their last message to process
        // this also removes possible duplicate messages to be parsed
        for (const message of messages) {
          inputTopicsForRecompute.delete(message.topic);
        }

        const messagesForRecompute: MessageEvent[] = [];
        for (const topic of inputTopicsForRecompute) {
          const messageForRecompute = this.#lastMessageByInputTopic.get(topic);
          if (messageForRecompute) {
            messagesForRecompute.push(messageForRecompute);
          }
        }

        this.#userNodeIdsNeedUpdate.clear();

        for (const message of messages) {
          this.#lastMessageByInputTopic.set(message.topic, message);
        }

        // These are new messages generated from input messages
        const computed = await this.#getMessages(
          messages,
          globalVariables,
          state.nodeRegistrations,
        );

        // These are messages generated from previously saved messages on input topics
        const recomputed = await this.#getMessages(
          messagesForRecompute,
          globalVariables,
          state.nodeRegistrations,
        );

        // The current frame messages are the input messages + recomputed + computed sorted by
        // receive time
        const currentFrameMessages = messages
          .concat(recomputed)
          .concat(computed)
          .sort((a, b) => compare(a.receiveTime, b.receiveTime));

        const playerProgress = {
          ...playerState.progress,
        };

        if (playerProgress.messageCache) {
          const newBlocks = await this.#getBlocks(
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
            messages: currentFrameMessages,
            topics: this.#getTopics(topics, this.#memoizedNodeTopics),
            datatypes: allDatatypes,
          },
        };
      });

      this.#playerState = newPlayerState;

      // clear any previous problem we had from making a new player state
      this.#problemStore.delete("player-state-update");
    } catch (err) {
      this.#problemStore.set("player-state-update", {
        severity: "error",
        message: err.message,
        error: err,
      });

      this.#playerState = playerState;
    } finally {
      await this.#queueEmitState();
    }
  }

  async #queueEmitState() {
    // Wrap in mutex in case the emitState triggered by changed node registrations happens
    // to run at the same time as an emitstate triggered by the underlying player.
    await this.#emitLock.runExclusive(async () => {
      if (!this.#playerState) {
        return;
      }

      // only augment child problems if we have our own problems
      // if neither child or parent have problems we do nothing
      let problems = this.#playerState.problems;
      if (this.#problemStore.size > 0) {
        problems = (problems ?? []).concat(Array.from(this.#problemStore.values()));
      }

      const playerState: PlayerState = {
        ...this.#playerState,
        problems,
      };

      if (this.#listener) {
        await this.#listener(playerState);
      }
    });
  }

  public setListener(listener: (_: PlayerState) => Promise<void>): void {
    this.#listener = listener;

    // Delay _player.setListener until our setListener is called because setListener in some cases
    // triggers initialization logic and remote requests. This is an unfortunate API behavior and
    // naming choice, but it's better for us not to do trigger this logic in the constructor.
    this.#player.setListener(async (state) => {
      await this.#onPlayerState(state);
    });
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.#subscriptions = subscriptions;
    this.#protectedState
      .runExclusive(async (state) => {
        this.#setSubscriptionsUnlocked(subscriptions, state);
      })
      .catch((err) => {
        log.error(err);
        reportError(err as Error);
      });
  }

  #setSubscriptionsUnlocked(subscriptions: SubscribePayload[], state: ProtectedState): void {
    // A mapping from the subscription to the input topics needed to satisfy
    // that request.
    type SubscriberInputs = [SubscribePayload, readonly string[] | undefined];

    // Pair all subscriptions with their user script input topics (if any)
    const payloadInputsPairs = R.pipe(
      R.map((v: SubscribePayload): SubscriberInputs => [v, state.inputsByOutputTopic.get(v.topic)]),
      R.filter(([, topics]: SubscriberInputs) => topics?.length !== 0),
    )(subscriptions);

    // An array of all of the input topics used by the user nodes referenced by
    // `subscriptions`
    const neededInputTopics = R.pipe(
      R.chain(([, v]: SubscriberInputs): readonly string[] => v ?? []),
      R.uniq,
    )(payloadInputsPairs);

    // #nodeSubscriptions is a mapping from topic name to a SubscribePayload
    // that contains the resolved preloadType--in other words, the kind of data
    // (current or block) that this subscription needs
    this.#nodeSubscriptions = R.pipe(
      R.map(([subscription]: SubscriberInputs) => subscription),
      // Gather all of the payloads into subscriptions for the same topic
      R.groupBy((v: SubscribePayload) => v.topic),
      // Consolidate subscriptions to the same topic down to a single payload
      // and ignore `fields`
      R.mapObjIndexed((payloads: SubscribePayload[] | undefined, topic): SubscribePayload => {
        // If at least one preloadType is explicitly "full", we need "full",
        // but default to "partial"
        const hasFull = R.any((v: SubscribePayload) => v.preloadType === "full", payloads ?? []);

        return {
          topic,
          preloadType: hasFull ? "full" : "partial",
        };
      }),
    )(payloadInputsPairs);

    const resolvedSubscriptions = R.pipe(
      R.chain(([subscription, topics]: SubscriberInputs): SubscribePayload[] => {
        const preloadType = subscription.preloadType ?? "partial";

        // Leave the subscription unmodified if it is not a user script topic
        if (topics == undefined) {
          // If this is an input to a user script, we need to upgrade it to a
          // subscription of all the fields
          if (neededInputTopics.includes(subscription.topic)) {
            return [
              {
                topic: subscription.topic,
                preloadType,
              },
            ];
          }

          return [subscription];
        }

        // Subscribe to all fields for all topics used by this user script
        // because we can't know what fields the user script actually uses
        // (for now)
        return topics.map((v) => ({
          topic: v,
          preloadType,
        }));
      }),
      mergeSubscriptions,
    )(payloadInputsPairs);

    // Merge subscriptions we pass on to the underlying player.
    this.#player.setSubscriptions(resolvedSubscriptions);
  }

  public close = (): void => {
    void this.#protectedState.runExclusive(async (state) => {
      for (const nodeRegistration of state.nodeRegistrations) {
        nodeRegistration.terminate();
      }
    });
    this.#player.close();
    if (this.#nodeTransformRpc) {
      void this.#nodeTransformRpc.send("close");
    }
  };

  public setPublishers(publishers: AdvertiseOptions[]): void {
    this.#player.setPublishers(publishers);
  }

  public setParameter(key: string, value: ParameterValue): void {
    this.#player.setParameter(key, value);
  }

  public publish(request: PublishPayload): void {
    this.#player.publish(request);
  }

  public async callService(service: string, request: unknown): Promise<unknown> {
    return await this.#player.callService(service, request);
  }

  public async fetchAsset(uri: string): Promise<Asset> {
    if (this.#player.fetchAsset) {
      return await this.#player.fetchAsset(uri);
    }
    throw Error("Player does not support fetching assets");
  }

  public startPlayback(): void {
    this.#player.startPlayback?.();
  }

  public pausePlayback(): void {
    this.#player.pausePlayback?.();
  }

  public playUntil(time: Time): void {
    if (this.#player.playUntil) {
      this.#player.playUntil(time);
      return;
    }
    this.#player.seekPlayback?.(time);
  }

  public setPlaybackSpeed(speed: number): void {
    this.#player.setPlaybackSpeed?.(speed);
  }

  public seekPlayback(time: Time): void {
    this.#player.seekPlayback?.(time);
  }
}
