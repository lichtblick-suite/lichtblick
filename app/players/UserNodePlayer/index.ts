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

// Filename of nodeTransformerWorker is recognized by the server, and given a special header to
// ensure user-supplied code cannot make network requests.
import NodeDataWorker from "worker-loader?worker=SharedWorker&filename=nodeTransformerWorker.[ext]!@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker"; // eslint-disable-line
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
  ProcessMessageOutput,
  RegistrationOutput,
  Sources,
  UserNodeLog,
} from "@foxglove-studio/app/players/UserNodePlayer/types";
import { hasTransformerErrors } from "@foxglove-studio/app/players/UserNodePlayer/utils";
import {
  AdvertisePayload,
  Message,
  Player,
  PlayerState,
  PlayerStateActiveData,
  PublishPayload,
  SubscribePayload,
  Topic,
  BobjectMessage,
} from "@foxglove-studio/app/players/types";
import signal from "@foxglove-studio/app/shared/signal";
import UserNodePlayerWorker from "worker-loader?worker=SharedWorker&filename=nodeRuntimeWorker.[ext]!@foxglove-studio/app/players/UserNodePlayer/nodeRuntimeWorker"; // eslint-disable-line
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { UserNode, UserNodes } from "@foxglove-studio/app/types/panels";
import Rpc from "@foxglove-studio/app/util/Rpc";
import { setupReceiveReportErrorHandler } from "@foxglove-studio/app/util/RpcMainThreadUtils";
import { wrapJsObject } from "@foxglove-studio/app/util/binaryObjects";
import { BobjectRpcSender } from "@foxglove-studio/app/util/binaryObjects/BobjectRpc";
import { basicDatatypes } from "@foxglove-studio/app/util/datatypes";
import { DEFAULT_WEBVIZ_NODE_PREFIX } from "@foxglove-studio/app/util/globalConstants";

type UserNodeActions = {
  setUserNodeDiagnostics: SetUserNodeDiagnostics;
  addUserNodeLogs: AddUserNodeLogs;
  setUserNodeRosLib: SetUserNodeRosLib;
};

const rpcFromNewSharedWorker = (worker: any) => {
  const port: MessagePort = worker.port;
  port.start();
  const rpc = new Rpc(port);
  setupReceiveReportErrorHandler(rpc);
  return rpc;
};

const getBobjectMessage = async (
  datatypes: RosDatatypes,
  datatype: string,
  messagePromise: Promise<Message | null | undefined>,
): Promise<BobjectMessage | null | undefined> => {
  const msg = await messagePromise;
  if (!msg) {
    return null;
  }
  return {
    topic: msg.topic,
    receiveTime: msg.receiveTime,
    message: wrapJsObject(datatypes, datatype, msg.message),
  };
};

// TODO: FUTURE - Performance tests
// TODO: FUTURE - Consider how to incorporate with existing hardcoded nodes (esp re: stories/testing)
// 1 - Do we convert them all over to the new node format / Typescript? What about imported libraries?
// 2 - Do we keep them in the old format for a while and support both formats?
export default class UserNodePlayer implements Player {
  _player: Player;
  _nodeRegistrations: NodeRegistration[] = [];
  _subscriptions: SubscribePayload[] = [];
  _subscribedFormatByTopic: {
    [topic: string]: Set<"parsedMessages" | "bobjects">;
  } = {};
  _userNodes: UserNodes = {};
  // TODO: FUTURE - Terminate unused workers (some sort of timeout, for whole array or per rpc)
  // Not sure if there is perf issue with unused workers (may just go idle) - requires more research
  _unusedNodeRuntimeWorkers: Rpc[] = [];
  _lastPlayerStateActiveData: PlayerStateActiveData | null | undefined;
  _setUserNodeDiagnostics: (nodeId: string, diagnostics: Diagnostic[]) => void;
  _addUserNodeLogs: (nodeId: string, logs: UserNodeLog[]) => void;
  _setRosLib: (rosLib: string) => void;
  _nodeTransformRpc: Rpc | null | undefined = null;
  _rosLib: string | null | undefined;
  _globalVariables: GlobalVariables = {};
  _pendingResetWorkers: Promise<void> | null | undefined;

  constructor(player: Player, userNodeActions: UserNodeActions) {
    this._player = player;
    const { setUserNodeDiagnostics, addUserNodeLogs, setUserNodeRosLib } = userNodeActions;

    // TODO(troy): can we make the below action flow better? Might be better to
    // just add an id, and the thing you want to update? Instead of passing in
    // objects?
    this._setUserNodeDiagnostics = (nodeId: string, diagnostics: Diagnostic[]) => {
      setUserNodeDiagnostics({ [nodeId]: { diagnostics } });
    };
    this._addUserNodeLogs = (nodeId: string, logs: UserNodeLog[]) => {
      if (logs.length) {
        addUserNodeLogs({ [nodeId]: { logs } });
      }
    };

    this._setRosLib = (rosLib: string) => {
      this._rosLib = rosLib;
      // We set this in Redux as the monaco editor needs to refer to it.
      setUserNodeRosLib(rosLib);
    };
  }

  _getTopics = microMemoize((topics: Topic[], nodeTopics: Topic[]) => [...topics, ...nodeTopics], {
    isEqual,
  });
  _getDatatypes = microMemoize(
    (datatypes: any, nodeRegistrations: NodeRegistration[]) => {
      const userNodeDatatypes = nodeRegistrations.reduce(
        (allDatatypes, { nodeData }) => ({ ...allDatatypes, ...nodeData.datatypes }),
        { ...basicDatatypes },
      );
      return { ...datatypes, ...userNodeDatatypes };
    },
    { isEqual },
  );
  _getNodeRegistration = microMemoize(this._createNodeRegistration, {
    isEqual,
    isPromise: true,
    maxSize: Infinity, // We prune the cache anytime the userNodes change, so it's not *actually* Infinite
  });

  // When updating Webviz nodes while paused, we seek to the current time
  // (i.e. invoke _getMessages with an empty array) to refresh messages
  _getMessages = microMemoize(
    async (
      parsedMessages: Message[],
      bobjects: BobjectMessage[],
      datatypes: RosDatatypes,
      globalVariables: GlobalVariables,
      nodeRegistrations: NodeRegistration[],
    ): Promise<{
      parsedMessages: ReadonlyArray<Message>;
      bobjects: ReadonlyArray<BobjectMessage>;
    }> => {
      const parsedMessagesPromises = [];
      const bobjectPromises = [];
      for (const message of bobjects) {
        // BobjectRpc is currently not re-entrant: It has per-topic state, so we can't currently run multiple messages
        // concurrently. This also helps us provide an ordering guarantee for stateful nodes.
        // We run all nodes in parallel, but run all messages in series.
        const messagePromises = [];
        for (const nodeRegistration of nodeRegistrations) {
          const subscriptions = this._subscribedFormatByTopic[nodeRegistration.output.name];
          if (subscriptions && nodeRegistration.inputs.includes(message.topic)) {
            const messagePromise = nodeRegistration.processMessage(message, globalVariables);
            messagePromises.push(messagePromise);
            // There should be at most 2 subscriptions.
            for (const format of subscriptions.values()) {
              if (format === "parsedMessages") {
                parsedMessagesPromises.push(messagePromise);
              } else {
                bobjectPromises.push(
                  getBobjectMessage(datatypes, nodeRegistration.output.datatype, messagePromise),
                );
              }
            }
          }
        }
        await Promise.all(messagePromises);
      }
      const [nodeParsedMessages, nodeBobjects] = await Promise.all([
        (await Promise.all(parsedMessagesPromises)).filter(Boolean),
        (await Promise.all(bobjectPromises)).filter(Boolean),
      ]);

      return {
        parsedMessages: parsedMessages
          .concat(nodeParsedMessages as any)
          .sort((a, b) => TimeUtil.compare(a.receiveTime, b.receiveTime)),
        bobjects: bobjects
          .concat(nodeBobjects as any)
          .sort((a, b) => TimeUtil.compare(a.receiveTime, b.receiveTime)),
      };
    },
  );

  setGlobalVariables(globalVariables: GlobalVariables) {
    this._globalVariables = globalVariables;
  }

  // Called when userNode state is updated.
  async setUserNodes(userNodes: UserNodes): Promise<void> {
    this._userNodes = userNodes;

    // Prune the nodeDefinition cache so it doesn't grow forever.
    // We add one to the count so we don't have to recompile nodes if users undo/redo node changes.
    const maxNodeRegistrationCacheCount = Object.keys(userNodes).length + 1;
    this._getNodeRegistration.cache?.keys.splice(maxNodeRegistrationCacheCount, Infinity);
    this._getNodeRegistration.cache?.values.splice(maxNodeRegistrationCacheCount, Infinity);

    // This code causes us to reset workers twice because the forceSeek resets the workers too
    // TODO: Only reset workers once
    return this._resetWorkers().then(() => {
      this.setSubscriptions(this._subscriptions);
      const { currentTime = null, isPlaying = false } = this._lastPlayerStateActiveData || {};
      if (currentTime && !isPlaying) {
        this._player.seekPlayback(currentTime);
      }
    });
  }

  // Defines the inputs/outputs and worker interface of a user node.
  async _createNodeRegistration(nodeId: string, userNode: UserNode): Promise<NodeRegistration> {
    // Pass all the nodes a set of basic datatypes that we know how to render.
    // These could be overwritten later by bag datatypes, but these datatype definitions should be very stable.
    const { topics = [], datatypes = {} } = this._lastPlayerStateActiveData || {};
    const nodeDatatypes = { ...basicDatatypes, ...datatypes };

    const rosLib = await this._getRosLib();
    const { name, sourceCode } = userNode;
    const transformMessage = { name, sourceCode, topics, rosLib, datatypes: nodeDatatypes };
    const transformWorker = this._getTransformWorker();
    const nodeData = await transformWorker.send<NodeData>("transform", transformMessage);
    const { inputTopics, outputTopic, transpiledCode, projectCode, outputDatatype } = nodeData;

    let bobjectSender: any;
    let rpc: any;
    let terminateSignal = signal<void>();
    return {
      nodeId,
      nodeData,
      inputs: inputTopics,
      output: { name: outputTopic, datatype: outputDatatype },
      processMessage: async (message: Message) => {
        // We allow _resetWorkers to "cancel" the processing by creating a new signal every time we process a message
        terminateSignal = signal<void>();

        // Register the node within a web worker to be executed.
        if (!bobjectSender || !rpc) {
          rpc =
            this._unusedNodeRuntimeWorkers.pop() ||
            rpcFromNewSharedWorker(new UserNodePlayerWorker());
          bobjectSender = new BobjectRpcSender(rpc);
          // @ts-expect-error we don't know the type of rpc, once we fix that the send will accept a generic
          const { error, userNodeDiagnostics, userNodeLogs } = await rpc.send<RegistrationOutput>(
            "registerNode",
            {
              projectCode,
              nodeCode: transpiledCode,
            },
          );
          if (error) {
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

        const result = await Promise.race([
          // @ts-expect-error we don't know the type of rpc, once we fix that the send will accept a generic
          bobjectSender.send<ProcessMessageOutput>(
            "processMessage",
            message,
            this._globalVariables,
          ),
          terminateSignal,
        ]);
        if (!result) {
          return;
        }

        const diagnostics = result.error
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

        // TODO: FUTURE - surface runtime errors / infinite loop errors
        if (!result.message) {
          return;
        }
        return {
          topic: outputTopic,
          receiveTime: message.receiveTime,
          message: result.message,
        };
      },
      terminate: () => {
        terminateSignal.resolve();
        if (rpc) {
          this._unusedNodeRuntimeWorkers.push(rpc);
          rpc = null;
        }
      },
    };
  }

  _getTransformWorker(): Rpc {
    if (!this._nodeTransformRpc) {
      this._nodeTransformRpc = rpcFromNewSharedWorker(new NodeDataWorker());
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
  async _resetWorkers() {
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
    if (!this._nodeRegistrations.length && !Object.entries(this._userNodes).length) {
      pending.resolve();
      this._pendingResetWorkers = null;
      return;
    }

    for (const nodeRegistration of this._nodeRegistrations) {
      nodeRegistration.terminate();
    }

    const allNodeRegistrations = await Promise.all(
      Object.keys(this._userNodes).map(async (nodeId) =>
        this._getNodeRegistration(nodeId, this._userNodes[nodeId]),
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
      (nodeReg) => nodeReg === nodesByOutputTopic[nodeReg.output.name][0],
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

    this._pendingResetWorkers = null;
    pending.resolve();
  }

  async _getRosLib(): Promise<string> {
    // We only generate the roslib once, because available topics and datatypes should never change. If they do, for
    // a source or player change, we destroy this player and create a new one.
    if (this._rosLib) {
      return this._rosLib;
    }

    if (!this._lastPlayerStateActiveData) {
      throw new Error("_getRosLib was called before `_lastPlayerStateActiveData` set");
    }

    const { topics, datatypes } = this._lastPlayerStateActiveData;
    const transformWorker = this._getTransformWorker();
    const rosLib = await transformWorker.send("generateRosLib", {
      topics,
      datatypes,
    });
    this._setRosLib(rosLib as any);

    return rosLib as string;
  }

  setListener(listener: (arg0: PlayerState) => Promise<void>) {
    this._player.setListener(async (playerState: PlayerState) => {
      const { activeData } = playerState;
      if (!activeData) {
        return listener(playerState);
      }
      const { messages, topics, datatypes, bobjects } = activeData;

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
      const { parsedMessages, bobjects: augmentedBobjects } = await this._getMessages(
        messages,
        bobjects,
        allDatatypes,
        this._globalVariables,
        this._nodeRegistrations,
      );

      const newPlayerState = {
        ...playerState,
        activeData: {
          ...activeData,
          messages: parsedMessages,
          bobjects: augmentedBobjects,
          topics: this._getTopics(
            topics,
            this._nodeRegistrations.map((nodeRegistration) => nodeRegistration.output),
          ),
          datatypes: allDatatypes,
        },
      };

      this._lastPlayerStateActiveData = playerState.activeData;
      return listener(newPlayerState);
    });
  }

  setSubscriptions(subscriptions: SubscribePayload[]) {
    this._subscriptions = subscriptions;

    const mappedTopics: string[] = [];
    const realTopicSubscriptions: SubscribePayload[] = [];
    const nodeSubscriptions: SubscribePayload[] = [];
    for (const subscription of subscriptions) {
      // For performance, only check topics that start with DEFAULT_WEBVIZ_NODE_PREFIX.
      if (!subscription.topic.startsWith(DEFAULT_WEBVIZ_NODE_PREFIX)) {
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
            // Bobjects are parsed inside the worker.
            format: "bobjects",
          });
        }
      }
    }

    const subscribedFormatByTopic: Record<string, any> = {};
    for (const { topic, format } of nodeSubscriptions) {
      subscribedFormatByTopic[topic] = subscribedFormatByTopic[topic] || new Set();
      subscribedFormatByTopic[topic].add(format);
    }
    this._subscribedFormatByTopic = subscribedFormatByTopic;

    this._player.setSubscriptions(realTopicSubscriptions);
  }

  close = () => {
    for (const nodeRegistration of this._nodeRegistrations) {
      nodeRegistration.terminate();
    }
    this._player.close();
    if (this._nodeTransformRpc) {
      this._nodeTransformRpc.send("close");
    }
  };

  setPublishers = (publishers: AdvertisePayload[]) => this._player.setPublishers(publishers);
  publish = (request: PublishPayload) => this._player.publish(request);
  startPlayback = () => this._player.startPlayback();
  pausePlayback = () => this._player.pausePlayback();
  setPlaybackSpeed = (speed: number) => this._player.setPlaybackSpeed(speed);
  seekPlayback = (time: Time, backfillDuration?: Time | null) =>
    this._player.seekPlayback(time, backfillDuration);
  requestBackfill = () => this._player.requestBackfill();
}
