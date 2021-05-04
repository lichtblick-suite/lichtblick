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
import { isEqual, groupBy, partition } from "lodash";
import microMemoize from "micro-memoize";
import { TimeUtil, Time } from "rosbag";

import {
  SetUserNodeDiagnostics,
  AddUserNodeLogs,
  SetUserNodeRosLib,
} from "@foxglove-studio/app/actions/userNodes";
import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import {
  Diagnostic,
  DiagnosticSeverity,
  ErrorCodes,
  NodeData,
  NodeRegistration,
  RegistrationOutput,
  Sources,
  UserNodeLog,
} from "@foxglove-studio/app/players/UserNodePlayer/types";
import { hasTransformerErrors } from "@foxglove-studio/app/players/UserNodePlayer/utils";
import {
  AdvertisePayload,
  Player,
  PlayerState,
  PlayerStateActiveData,
  PublishPayload,
  SubscribePayload,
  Topic,
  ParameterValue,
  MessageEvent,
  PlayerProblem,
} from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { UserNode, UserNodes } from "@foxglove-studio/app/types/panels";
import Rpc from "@foxglove-studio/app/util/Rpc";
import { basicDatatypes } from "@foxglove-studio/app/util/datatypes";
import { DEFAULT_STUDIO_NODE_PREFIX } from "@foxglove-studio/app/util/globalConstants";
import signal from "@foxglove-studio/app/util/signal";
import Log from "@foxglove/log";

const log = Log.getLogger(__filename);

// TypeScript's built-in lib only accepts strings for the scriptURL. However, webpack only
// understands `new URL()` to properly build the worker entry point:
// https://github.com/webpack/webpack/issues/13043
declare let SharedWorker: {
  prototype: SharedWorker;
  new (scriptURL: URL, options?: string | WorkerOptions): SharedWorker;
};

type UserNodeActions = {
  setUserNodeDiagnostics: SetUserNodeDiagnostics;
  addUserNodeLogs: AddUserNodeLogs;
  setUserNodeRosLib: SetUserNodeRosLib;
};

// TODO: FUTURE - Performance tests
// TODO: FUTURE - Consider how to incorporate with existing hardcoded nodes (esp re: stories/testing)
// 1 - Do we convert them all over to the new node format / Typescript? What about imported libraries?
// 2 - Do we keep them in the old format for a while and support both formats?
export default class UserNodePlayer implements Player {
  private _player: Player;
  private _nodeRegistrations: NodeRegistration[] = [];
  private _subscriptions: SubscribePayload[] = [];
  private _validTopics = new Set<string>();
  private _userNodes: UserNodes = {};

  // listener for state updates
  private _listener?: (arg0: PlayerState) => Promise<void>;

  // TODO: FUTURE - Terminate unused workers (some sort of timeout, for whole array or per rpc)
  // Not sure if there is perf issue with unused workers (may just go idle) - requires more research
  private _unusedNodeRuntimeWorkers: Rpc[] = [];
  private _lastPlayerStateActiveData?: PlayerStateActiveData;
  private _setUserNodeDiagnostics: (nodeId: string, diagnostics: readonly Diagnostic[]) => void;
  private _addUserNodeLogs: (nodeId: string, logs: UserNodeLog[]) => void;
  private _setRosLib: (rosLib: string, datatypes: RosDatatypes) => void;
  private _nodeTransformRpc?: Rpc;
  private _rosLib?: string;
  private _rosLibDatatypes?: RosDatatypes; // the datatypes we last used to generate rosLib -- regenerate if they change
  private _globalVariables: GlobalVariables = {};
  private _pendingResetWorkers?: Promise<void>;

  // Player state changes when the child player invokes our player state listener
  // we may also emit state changes on internal errors
  private _playerState?: PlayerState;

  // The store tracks problems for individual userspace nodes
  // a node may set its own problem or clear its problem
  private _problemStore = new Map<string, PlayerProblem>();

  // exposed as a static to allow testing to mock/replace
  static CreateNodeTransformWorker = (): SharedWorker => {
    return new SharedWorker(new URL("./nodeTransformerWorker/index", import.meta.url));
  };

  // exposed as a static to allow testing to mock/replace
  static CreateNodeRuntimeWorker = (): SharedWorker => {
    return new SharedWorker(new URL("./nodeRuntimeWorker/index", import.meta.url));
  };

  constructor(player: Player, userNodeActions: UserNodeActions) {
    this._player = player;
    this._player.setListener((state) => this._onPlayerState(state));
    const { setUserNodeDiagnostics, addUserNodeLogs, setUserNodeRosLib } = userNodeActions;

    // TODO(troy): can we make the below action flow better? Might be better to
    // just add an id, and the thing you want to update? Instead of passing in
    // objects?
    this._setUserNodeDiagnostics = (nodeId: string, diagnostics: readonly Diagnostic[]) => {
      setUserNodeDiagnostics({ [nodeId]: { diagnostics } });
    };
    this._addUserNodeLogs = (nodeId: string, logs: UserNodeLog[]) => {
      if (logs.length > 0) {
        addUserNodeLogs({ [nodeId]: { logs } });
      }
    };

    this._setRosLib = (rosLib: string, datatypes: RosDatatypes) => {
      this._rosLib = rosLib;
      this._rosLibDatatypes = datatypes;
      // We set this in Redux as the monaco editor needs to refer to it.
      setUserNodeRosLib(rosLib);
    };
  }

  _getTopics = microMemoize(
    (topics: Topic[], nodeTopics: Topic[]): Topic[] => [...topics, ...nodeTopics],
    {
      isEqual,
    },
  );
  _getDatatypes = microMemoize(
    (datatypes: RosDatatypes, nodeRegistrations: NodeRegistration[]): RosDatatypes => {
      const userNodeDatatypes = nodeRegistrations.reduce(
        (allDatatypes, { nodeData }) => ({ ...allDatatypes, ...nodeData.datatypes }),
        { ...basicDatatypes },
      );
      return { ...datatypes, ...userNodeDatatypes };
    },
    { isEqual },
  );

  // When updating nodes while paused, we seek to the current time
  // (i.e. invoke _getMessages with an empty array) to refresh messages
  _getMessages = microMemoize(
    async (
      parsedMessages: readonly MessageEvent<unknown>[],
      _datatypes: RosDatatypes,
      globalVariables: GlobalVariables,
      nodeRegistrations: readonly NodeRegistration[],
    ): Promise<{
      parsedMessages: readonly MessageEvent<unknown>[];
    }> => {
      const parsedMessagesPromises: Promise<MessageEvent<unknown> | undefined>[] = [];
      for (const message of parsedMessages) {
        const messagePromises = [];
        for (const nodeRegistration of nodeRegistrations) {
          if (
            this._validTopics.has(nodeRegistration.output.name) &&
            nodeRegistration.inputs.includes(message.topic)
          ) {
            const messagePromise = nodeRegistration.processMessage(message, globalVariables);
            messagePromises.push(messagePromise);
            parsedMessagesPromises.push(messagePromise);
          }
        }
        await Promise.all(messagePromises);
      }

      const nodeParsedMessages = (await Promise.all(parsedMessagesPromises)).filter(Boolean);

      return {
        parsedMessages: parsedMessages
          .concat(nodeParsedMessages as any)
          .sort((a, b) => TimeUtil.compare(a.receiveTime, b.receiveTime)),
      };
    },
  );

  setGlobalVariables(globalVariables: GlobalVariables): void {
    this._globalVariables = globalVariables;
  }

  // Called when userNode state is updated.
  async setUserNodes(userNodes: UserNodes): Promise<void> {
    this._userNodes = userNodes;

    // Prune the nodeDefinition cache so it doesn't grow forever.
    // We add one to the count so we don't have to recompile nodes if users undo/redo node changes.
    const maxNodeRegistrationCacheCount = Object.keys(userNodes).length + 1;
    this._getNodeRegistration.cache.keys.splice(maxNodeRegistrationCacheCount, Infinity);
    this._getNodeRegistration.cache.values.splice(maxNodeRegistrationCacheCount, Infinity);

    // This code causes us to reset workers twice because the forceSeek resets the workers too
    // TODO: Only reset workers once
    return this._resetWorkers().then(() => {
      this.setSubscriptions(this._subscriptions);
      const { currentTime, isPlaying = false } = this._lastPlayerStateActiveData ?? {};
      if (currentTime && !isPlaying) {
        this._player.seekPlayback(currentTime);
      }
    });
  }

  // Defines the inputs/outputs and worker interface of a user node.
  private _createNodeRegistration = async (
    nodeId: string,
    userNode: UserNode,
  ): Promise<NodeRegistration> => {
    // Pass all the nodes a set of basic datatypes that we know how to render.
    // These could be overwritten later by bag datatypes, but these datatype definitions should be very stable.
    const { topics = [], datatypes = {} } = this._lastPlayerStateActiveData ?? {};
    const nodeDatatypes = { ...basicDatatypes, ...datatypes };

    const rosLib = await this._getRosLib();
    const { name, sourceCode } = userNode;
    const transformMessage = { name, sourceCode, topics, rosLib, datatypes: nodeDatatypes };
    const transformWorker = this._getTransformWorker();
    const nodeData = await transformWorker.send<NodeData>("transform", transformMessage);
    const { inputTopics, outputTopic, transpiledCode, projectCode, outputDatatype } = nodeData;

    let rpc: Rpc | undefined;
    let terminateSignal = signal<void>();

    // problemKey is a unique identifier for each userspace node so we can manage problems from
    // a specific node. A node may have a problem that may later clear. Using the key we can add/remove
    // problems for specific userspace nodes independently of other userspace nodes.
    const problemKey = `node-id-${nodeId}`;

    const processMessage = async (msgEvent: MessageEvent<unknown>) => {
      // We allow _resetWorkers to "cancel" the processing by creating a new signal every time we process a message
      terminateSignal = signal<void>();

      // Register the node within a web worker to be executed.
      if (!rpc) {
        rpc = this._unusedNodeRuntimeWorkers.pop();

        // initialize a new worker since no unused one is available
        if (!rpc) {
          const worker = UserNodePlayer.CreateNodeRuntimeWorker();

          worker.onerror = (event) => {
            log.error(event);

            this._problemStore.set(problemKey, {
              message: `Node playground runtime error: ${event.message}`,
              severity: "error",
            });

            // trigger listener updates
            this._emitState();
          };

          const port: MessagePort = worker.port;
          port.onmessageerror = (event) => {
            log.error(event);

            this._problemStore.set(problemKey, {
              severity: "error",
              message: `Node playground runtime error: ${String(event.data)}`,
            });

            this._emitState();
          };
          port.start();
          rpc = new Rpc(port);

          rpc.receive("error", (msg) => {
            log.error(msg);

            this._problemStore.set(problemKey, {
              severity: "error",
              message: `Node playground runtime error: ${msg}`,
            });

            this._emitState();
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

      const result = (await Promise.race([
        rpc.send("processMessage", { message: msgEvent, globalVariables: this._globalVariables }),
        terminateSignal,
      ])) as any;

      if (!result) {
        this._problemStore.set(problemKey, {
          message: `Node playground node ${nodeId} timed out`,
          severity: "warning",
        });
        return;
      }

      const diagnostics =
        result.error != undefined
          ? [
              {
                source: Sources.Runtime,
                severity: DiagnosticSeverity.Error,
                message: result.error,
                code: ErrorCodes.RUNTIME,
              },
            ]
          : [];
      if (diagnostics.length > 0) {
        this._setUserNodeDiagnostics(nodeId, diagnostics);
      }
      this._addUserNodeLogs(nodeId, result.userNodeLogs);

      if (!result.message) {
        this._problemStore.set(problemKey, {
          severity: "warning",
          message: `Node playground node ${nodeId} did not produce a message`,
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
      };
    };

    const terminate = () => {
      this._problemStore.delete(problemKey);

      terminateSignal.resolve();
      if (rpc) {
        this._unusedNodeRuntimeWorkers.push(rpc);
        rpc = undefined;
      }
    };

    return {
      nodeId,
      nodeData,
      inputs: inputTopics,
      output: { name: outputTopic, datatype: outputDatatype },
      processMessage,
      terminate,
    };
  };

  private _getNodeRegistration = microMemoize(this._createNodeRegistration, {
    isEqual,
    isPromise: true,
    maxSize: Infinity, // We prune the cache anytime the userNodes change, so it's not *actually* Infinite
  });

  private _getTransformWorker(): Rpc {
    if (!this._nodeTransformRpc) {
      const worker = UserNodePlayer.CreateNodeTransformWorker();

      // The errors below persist for the lifetime of the player.
      // They are not cleared because they are irrecoverable.

      worker.onerror = (event) => {
        log.error(event);

        this._problemStore.set("worker-error", {
          severity: "error",
          message: `Node playground error: ${event.message}`,
        });

        this._emitState();
      };

      const port: MessagePort = worker.port;
      port.onmessageerror = (event) => {
        log.error(event);

        this._problemStore.set("worker-error", {
          severity: "error",
          message: `Node playground error: ${String(event.data)}`,
        });

        this._emitState();
      };
      port.start();
      const rpc = new Rpc(port);

      rpc.receive("error", (msg) => {
        log.error(msg);

        this._problemStore.set("worker-error", {
          severity: "error",
          message: `Node playground error: ${msg}`,
        });

        this._emitState();
      });

      this._nodeTransformRpc = rpc;
    }
    return this._nodeTransformRpc;
  }

  // We need to reset workers in a variety of circumstances:
  // - When a user node is updated, added or deleted
  // - When we seek (in order to reset state)
  // - When a new child player is added
  //
  // For the time being, resetWorkers is a catchall for these circumstances. As
  // performance bottlenecks are identified, it will be subject to change.
  async _resetWorkers(): Promise<void> {
    if (!this._lastPlayerStateActiveData) {
      return;
    }

    // Make sure that we only run this function once at a time, but using this instead of `debouncePromise` so that it
    // returns a promise.
    if (this._pendingResetWorkers) {
      await this._pendingResetWorkers;
    }
    const pending = signal();
    this._pendingResetWorkers = pending;

    // This early return is an optimization measure so that the
    // `nodeRegistrations` array is not re-defined, which will invalidate
    // downstream caches. (i.e. `this._getTopics`)
    if (this._nodeRegistrations.length === 0 && Object.entries(this._userNodes).length === 0) {
      pending.resolve();
      this._pendingResetWorkers = undefined;
      return;
    }

    for (const nodeRegistration of this._nodeRegistrations) {
      nodeRegistration.terminate();
    }

    const allNodeRegistrations = await Promise.all(
      Object.entries(this._userNodes).map(async ([nodeId, userNode]) =>
        this._getNodeRegistration(nodeId, userNode),
      ),
    );

    // Filter out nodes with compilation errors
    const nodeRegistrations: Array<NodeRegistration> = allNodeRegistrations.filter(
      ({ nodeData, nodeId }) => {
        const hasError = hasTransformerErrors(nodeData);
        if (hasError) {
          this._setUserNodeDiagnostics(nodeId, nodeData.diagnostics);
        }
        return !hasError;
      },
    );

    // Create diagnostic errors if more than one node outputs to the same topic
    const nodesByOutputTopic = groupBy(nodeRegistrations, ({ output }) => output.name);
    const [validNodeRegistrations, duplicateNodeRegistrations] = partition(
      nodeRegistrations,
      (nodeReg) => nodeReg === nodesByOutputTopic[nodeReg.output.name]?.[0],
    );
    duplicateNodeRegistrations.forEach(({ nodeId, nodeData }) => {
      this._setUserNodeDiagnostics(nodeId, [
        ...nodeData.diagnostics,
        {
          severity: DiagnosticSeverity.Error,
          message: `Output "${nodeData.outputTopic}" must be unique`,
          source: Sources.OutputTopicChecker,
          code: ErrorCodes.OutputTopicChecker.NOT_UNIQUE,
        },
      ]);
    });

    this._nodeRegistrations = validNodeRegistrations;
    this._nodeRegistrations.forEach(({ nodeId }) => this._setUserNodeDiagnostics(nodeId, []));

    this._pendingResetWorkers = undefined;
    pending.resolve();
  }

  async _getRosLib(): Promise<string> {
    if (!this._lastPlayerStateActiveData) {
      throw new Error("_getRosLib was called before `_lastPlayerStateActiveData` set");
    }
    const { topics, datatypes } = this._lastPlayerStateActiveData;

    // If datatypes have not changed, we can reuse the existing rosLib
    if (this._rosLib != undefined && this._rosLibDatatypes === datatypes) {
      return this._rosLib;
    }

    const transformWorker = this._getTransformWorker();
    const rosLib: string = await transformWorker.send("generateRosLib", {
      topics,
      datatypes,
    });
    this._setRosLib(rosLib, datatypes);

    return rosLib;
  }

  // invoked when our child player state changes
  private async _onPlayerState(playerState: PlayerState) {
    try {
      const { activeData } = playerState;
      if (!activeData) {
        this._playerState = playerState;
        await this._emitState();
        return;
      }

      const { messages, topics, datatypes } = activeData;

      // Reset node state after seeking
      if (activeData.lastSeekTime !== this._lastPlayerStateActiveData?.lastSeekTime) {
        await this._resetWorkers();
      }

      // If we do not have active player data from a previous call, then our
      // player just spun up, meaning we should re-run our user nodes in case
      // they have inputs that now exist in the current player context.
      if (!this._lastPlayerStateActiveData) {
        this._lastPlayerStateActiveData = activeData;
        await this._resetWorkers();
        this.setSubscriptions(this._subscriptions);
        this.requestBackfill();
      }

      const allDatatypes = this._getDatatypes(datatypes, this._nodeRegistrations);

      const { parsedMessages } = await this._getMessages(
        messages,
        allDatatypes,
        this._globalVariables,
        this._nodeRegistrations,
      );

      const newPlayerState = {
        ...playerState,
        activeData: {
          ...activeData,
          messages: parsedMessages,
          topics: this._getTopics(
            topics,
            this._nodeRegistrations.map((nodeRegistration) => nodeRegistration.output),
          ),
          datatypes: allDatatypes,
        },
      };

      this._playerState = newPlayerState;
      this._lastPlayerStateActiveData = playerState.activeData;

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

  setListener(listener: NonNullable<UserNodePlayer["_listener"]>): void {
    this._listener = listener;
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._subscriptions = subscriptions;

    const mappedTopics: string[] = [];
    const realTopicSubscriptions: SubscribePayload[] = [];
    const nodeSubscriptions: SubscribePayload[] = [];
    for (const subscription of subscriptions) {
      // For performance, only check topics that start with DEFAULT_STUDIO_NODE_PREFIX.
      if (!subscription.topic.startsWith(DEFAULT_STUDIO_NODE_PREFIX)) {
        realTopicSubscriptions.push(subscription);
        continue;
      }

      nodeSubscriptions.push(subscription);

      // When subscribing to the same node multiple times, only subscribe to the underlying
      // topics once. This is not strictly necessary, but it makes debugging a bit easier.
      if (mappedTopics.includes(subscription.topic)) {
        continue;
      }
      mappedTopics.push(subscription.topic);

      const nodeRegistration = this._nodeRegistrations.find(
        (info) => info.output.name === subscription.topic,
      );
      if (nodeRegistration) {
        for (const inputTopic of nodeRegistration.inputs) {
          realTopicSubscriptions.push({
            topic: inputTopic,
            requester: { type: "node", name: nodeRegistration.output.name },
          });
        }
      }
    }

    this._validTopics = new Set(nodeSubscriptions.map((sub) => sub.topic));
    this._player.setSubscriptions(realTopicSubscriptions);
  }

  close = (): void => {
    for (const nodeRegistration of this._nodeRegistrations) {
      nodeRegistration.terminate();
    }
    this._player.close();
    if (this._nodeTransformRpc) {
      this._nodeTransformRpc.send("close");
    }
  };

  setPublishers = (publishers: AdvertisePayload[]): void => this._player.setPublishers(publishers);
  setParameter = (key: string, value: ParameterValue): void =>
    this._player.setParameter(key, value);
  publish = (request: PublishPayload): void => this._player.publish(request);
  startPlayback = (): void => this._player.startPlayback();
  pausePlayback = (): void => this._player.pausePlayback();
  setPlaybackSpeed = (speed: number): void => this._player.setPlaybackSpeed(speed);
  seekPlayback = (time: Time, backfillDuration?: Time): void =>
    this._player.seekPlayback(time, backfillDuration);
  requestBackfill = (): void => this._player.requestBackfill();
}
