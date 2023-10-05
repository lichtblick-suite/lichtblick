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
import ReactDOM from "react-dom";
import shallowequal from "shallowequal";
import { v4 as uuidv4 } from "uuid";

import { MutexLocked } from "@foxglove/den/async";
import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import { Time, compare } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import { Asset } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { MemoizedLibGenerator } from "@foxglove/studio-base/players/UserScriptPlayer/MemoizedLibGenerator";
import { generateTypesLib } from "@foxglove/studio-base/players/UserScriptPlayer/transformerWorker/generateTypesLib";
import { TransformArgs } from "@foxglove/studio-base/players/UserScriptPlayer/transformerWorker/types";
import {
  Diagnostic,
  DiagnosticSeverity,
  ErrorCodes,
  ScriptData,
  ScriptRegistration,
  ProcessMessageOutput,
  RegistrationOutput,
  Sources,
  UserScriptLog,
} from "@foxglove/studio-base/players/UserScriptPlayer/types";
import { hasTransformerErrors } from "@foxglove/studio-base/players/UserScriptPlayer/utils";
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
import { UserScript, UserScripts } from "@foxglove/studio-base/types/panels";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { basicDatatypes } from "@foxglove/studio-base/util/basicDatatypes";

import { remapVirtualSubscriptions, getPreloadTypes } from "./subscriptions";

const log = Log.getLogger(__filename);

// TypeScript's built-in lib only accepts strings for the scriptURL. However, webpack only
// understands `new URL()` to properly build the worker entry point:
// https://github.com/webpack/webpack/issues/13043
declare let SharedWorker: {
  prototype: SharedWorker;
  new (scriptURL: URL, options?: string | WorkerOptions): SharedWorker;
};

type UserScriptActions = {
  setUserScriptDiagnostics: (scriptId: string, diagnostics: readonly Diagnostic[]) => void;
  addUserScriptLogs: (scriptId: string, logs: readonly UserScriptLog[]) => void;
  setUserScriptRosLib: (rosLib: string) => void;
  setUserScriptTypesLib: (lib: string) => void;
};

type ScriptRegistrationCacheItem = {
  scriptId: string;
  userScript: UserScript;
  result: ScriptRegistration;
};

/** Mutable state protected by a mutex lock */
type ProtectedState = {
  scriptRegistrationCache: ScriptRegistrationCacheItem[];
  scriptRegistrations: readonly ScriptRegistration[];
  lastPlayerStateActiveData?: PlayerStateActiveData;
  userScripts: UserScripts;

  /**
   * Map of output topics to input topics. To produce an output we need to know the input topics
   * that a script requires. When subscribers subscribe to the output topic, the user script player
   * subscribes to the underlying input topics.
   */
  inputsByOutputTopic: Map<string, readonly string[]>;
};

export default class UserScriptPlayer implements Player {
  #player: Player;

  // Datatypes and topics are derived from scriptRegistrations, but memoized so they only change when needed
  #memoizedScriptDatatypes: readonly RosDatatypes[] = [];
  #memoizedScriptTopics: readonly Topic[] = [];

  #subscriptions: SubscribePayload[] = [];
  #scriptSubscriptions: Record<string, SubscribePayload> = {};

  // listener for state updates
  #listener?: (arg0: PlayerState) => Promise<void>;

  // Not sure if there is perf issue with unused workers (may just go idle) - requires more research
  #unusedRuntimeWorkers: Rpc[] = [];
  #setUserScriptDiagnostics: (scriptId: string, diagnostics: readonly Diagnostic[]) => void;
  #addUserScriptLogs: (scriptId: string, logs: UserScriptLog[]) => void;
  #transformRpc?: Rpc;
  #globalVariables: GlobalVariables = {};
  #userScriptActions: UserScriptActions;
  #rosLibGenerator: MemoizedLibGenerator;
  #typesLibGenerator: MemoizedLibGenerator;

  // Player state changes when the child player invokes our player state listener
  // we may also emit state changes on internal errors
  #playerState?: PlayerState;

  // The store tracks problems for individual user scripts
  // a script may set its own problem or clear its problem
  #problemStore = new Map<string, PlayerProblem>();

  // keep track of last message on all topics to recompute output topic messages when user scripts change
  #lastMessageByInputTopic = new Map<string, MessageEvent>();
  #userScriptIdsNeedUpdate = new Set<string>();

  #protectedState = new MutexLocked<ProtectedState>({
    userScripts: {},
    scriptRegistrations: [],
    scriptRegistrationCache: [],
    lastPlayerStateActiveData: undefined,
    inputsByOutputTopic: new Map(),
  });

  readonly #emitLock = new Mutex();

  // exposed as a static to allow testing to mock/replace
  public static CreateTransformWorker = (): SharedWorker => {
    // foxglove-depcheck-used: babel-plugin-transform-import-meta
    return new SharedWorker(new URL("./transformerWorker/index", import.meta.url), {
      // Although we are using SharedWorkers, we do not actually want to share worker instances
      // between tabs. We achieve this by passing in a unique name.
      name: uuidv4(),
    });
  };

  // exposed as a static to allow testing to mock/replace
  public static CreateRuntimeWorker = (): SharedWorker => {
    // foxglove-depcheck-used: babel-plugin-transform-import-meta
    return new SharedWorker(new URL("./runtimeWorker/index", import.meta.url), {
      // Although we are using SharedWorkers, we do not actually want to share worker instances
      // between tabs. We achieve this by passing in a unique name.
      name: uuidv4(),
    });
  };

  public constructor(player: Player, userScriptActions: UserScriptActions) {
    this.#player = player;
    this.#userScriptActions = userScriptActions;
    const { setUserScriptDiagnostics, addUserScriptLogs } = userScriptActions;

    this.#setUserScriptDiagnostics = (scriptId: string, diagnostics: readonly Diagnostic[]) => {
      setUserScriptDiagnostics(scriptId, diagnostics);
    };
    this.#addUserScriptLogs = (scriptId: string, logs: UserScriptLog[]) => {
      if (logs.length > 0) {
        addUserScriptLogs(scriptId, logs);
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

  #getTopics = memoizeWeak((topics: readonly Topic[], scriptTopics: readonly Topic[]): Topic[] => [
    ...topics,
    ...scriptTopics,
  ]);

  #getDatatypes = memoizeWeak(
    (datatypes: RosDatatypes, scriptDatatypes: readonly RosDatatypes[]): RosDatatypes => {
      return scriptDatatypes.reduce(
        (allDatatypes, userScriptDatatypes) => new Map([...allDatatypes, ...userScriptDatatypes]),
        new Map([...basicDatatypes, ...datatypes]),
      );
    },
  );

  #lastBlockRequest: {
    input?: {
      blocks: readonly (MessageBlock | undefined)[];
      globalVariables: GlobalVariables;
      scriptRegistrations: readonly ScriptRegistration[];
    };
    result: (MessageBlock | undefined)[];
  } = { result: [] };

  // Processes input messages through scripts to create messages on output topics
  async #getMessages(
    inputMessages: readonly MessageEvent[],
    globalVariables: GlobalVariables,
    scriptRegistrations: readonly ScriptRegistration[],
  ): Promise<readonly MessageEvent[]> {
    // fast-track if there's no input and return empty output
    if (inputMessages.length === 0) {
      return [];
    }

    const identity = <T>(item: T) => item;

    const outputMessages: MessageEvent[] = [];
    for (const message of inputMessages) {
      const messagePromises = [];
      for (const scriptRegistration of scriptRegistrations) {
        if (
          this.#scriptSubscriptions[scriptRegistration.output.name] &&
          scriptRegistration.inputs.includes(message.topic)
        ) {
          const messagePromise = scriptRegistration.processMessage(message, globalVariables);
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
    scriptRegistrations: readonly ScriptRegistration[],
  ): Promise<readonly (MessageBlock | undefined)[]> {
    if (
      shallowequal(this.#lastBlockRequest.input, {
        blocks,
        globalVariables,
        scriptRegistrations,
      })
    ) {
      return this.#lastBlockRequest.result;
    }

    // If no downstream subscriptions want blocks for our output topics we can just pass through
    // the blocks from the underlying player.
    const fullRegistrations = scriptRegistrations.filter(
      (reg) => this.#scriptSubscriptions[reg.output.name]?.preloadType === "full",
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

      // Flatten and re-sort block messages so that scripts see them in the same order
      // as the non-block scripts.
      const messagesByTopic = { ...block.messagesByTopic };
      const blockMessages = allInputTopics
        .flatMap((topic) => messagesByTopic[topic] ?? [])
        .sort((a, b) => compare(a.receiveTime, b.receiveTime));
      for (const scriptRegistration of fullRegistrations) {
        const outTopic = scriptRegistration.output.name;
        // Clear out any previously processed messages that were previously in the output topic.
        // otherwise it will contain duplicates.
        if (messagesByTopic[outTopic] != undefined) {
          messagesByTopic[outTopic] = [];
        }

        for (const message of blockMessages) {
          if (scriptRegistration.inputs.includes(message.topic)) {
            const outputMessage = await scriptRegistration.processBlockMessage(
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
      input: { blocks, globalVariables, scriptRegistrations },
      result: outputBlocks,
    };

    return outputBlocks;
  }

  public setGlobalVariables(globalVariables: GlobalVariables): void {
    this.#globalVariables = globalVariables;
  }

  // Called when userScript state is updated (i.e. scripts are saved)
  public async setUserScripts(userScripts: UserScripts): Promise<void> {
    const newPlayerState = await this.#protectedState.runExclusive(async (state) => {
      for (const scriptId of Object.keys(userScripts)) {
        const prevScript = state.userScripts[scriptId];
        const newScript = userScripts[scriptId];
        if (prevScript && newScript && prevScript.sourceCode !== newScript.sourceCode) {
          // if source code of a user script changed then we need to mark it for re-processing input messages
          this.#userScriptIdsNeedUpdate.add(scriptId);
        }
      }
      state.userScripts = userScripts;

      // Prune the script registration cache so it doesn't grow forever.
      // We add one to the count so we don't have to recompile scripts if users undo/redo script changes.
      const maxScriptRegistrationCacheCount = Object.keys(userScripts).length + 1;
      state.scriptRegistrationCache.splice(maxScriptRegistrationCacheCount);
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
            // Using an empty messages array will make user script player only emit the script output
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

  // Defines the inputs/outputs and worker interface of a user script.
  async #createScriptRegistration(
    scriptId: string,
    userScript: UserScript,
    state: ProtectedState,
    rosLib: string,
    typesLib: string,
  ): Promise<ScriptRegistration> {
    for (const cacheEntry of state.scriptRegistrationCache) {
      if (scriptId === cacheEntry.scriptId && _.isEqual(userScript, cacheEntry.userScript)) {
        return cacheEntry.result;
      }
    }
    // Pass all the scripts a set of basic datatypes that we know how to render.
    // These could be overwritten later by bag datatypes, but these datatype definitions should be very stable.
    const { topics = [], datatypes = new Map() } = state.lastPlayerStateActiveData ?? {};
    const scriptDatatypes: RosDatatypes = new Map([...basicDatatypes, ...datatypes]);

    const { name, sourceCode } = userScript;
    const transformMessage: TransformArgs = {
      name,
      sourceCode,
      topics,
      rosLib,
      typesLib,
      datatypes: scriptDatatypes,
    };
    const transformWorker = this.#getTransformWorker();
    const scriptData = await transformWorker.send<ScriptData>("transform", transformMessage);
    const { inputTopics, outputTopic, transpiledCode, projectCode, outputDatatype } = scriptData;

    // problemKey is a unique identifier for each user script so we can manage problems from
    // a specific script. A script may have a problem that may later clear. Using the key we can add/remove
    // problems for specific user scripts independently of other user scripts.
    const problemKey = `script-id-${scriptId}`;
    const buildMessageProcessor = (): {
      registration: ScriptRegistration["processMessage"];
      terminate: () => void;
    } => {
      // rpc channel for this processor. Lazily created on each message if an unused
      // channel isn't available.
      let rpc: undefined | Rpc;

      const registration = async (msgEvent: MessageEvent, globalVariables: GlobalVariables) => {
        // Register the script within a web worker to be executed.
        if (!rpc) {
          rpc = this.#unusedRuntimeWorkers.pop();

          // initialize a new worker since no unused one is available
          if (!rpc) {
            const worker = UserScriptPlayer.CreateRuntimeWorker();

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

          const { error, userScriptDiagnostics, userScriptLogs } =
            await rpc.send<RegistrationOutput>("registerScript", {
              projectCode,
              scriptCode: transpiledCode,
            });
          if (error != undefined) {
            this.#setUserScriptDiagnostics(scriptId, [
              ...userScriptDiagnostics,
              {
                source: Sources.Runtime,
                severity: DiagnosticSeverity.Error,
                message: error,
                code: ErrorCodes.RUNTIME,
              },
            ]);
            return;
          }
          this.#addUserScriptLogs(scriptId, userScriptLogs);
        }

        const result = await rpc.send<ProcessMessageOutput>("processMessage", {
          message: {
            topic: msgEvent.topic,
            receiveTime: msgEvent.receiveTime,
            message: msgEvent.message,
            datatype: msgEvent.schemaName,
          },
          globalVariables,
        });

        const allDiagnostics = result.userScriptDiagnostics;
        if (result.error) {
          allDiagnostics.push({
            source: Sources.Runtime,
            severity: DiagnosticSeverity.Error,
            message: result.error,
            code: ErrorCodes.RUNTIME,
          });
        }

        this.#addUserScriptLogs(scriptId, result.userScriptLogs);

        if (allDiagnostics.length > 0) {
          this.#problemStore.set(problemKey, {
            severity: "error",
            message: `User Script ${scriptId} encountered an error.`,
            tip: "Open the User Scripts panel and check the Problems tab for errors.",
          });

          this.#setUserScriptDiagnostics(scriptId, allDiagnostics);
          return;
        }

        if (!result.message) {
          this.#problemStore.set(problemKey, {
            severity: "warn",
            message: `User Script ${scriptId} did not produce a message.`,
            tip: "Check that all code paths in the user script return a message.",
          });
          return;
        }

        // At this point we've received a message successfully from the user script, therefore
        // we clear any previous problem from this script.
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
          this.#unusedRuntimeWorkers.push(rpc);
          rpc = undefined;
        }
      };

      return { registration, terminate };
    };

    const messageProcessor = buildMessageProcessor();
    const blockProcessor = buildMessageProcessor();

    const result: ScriptRegistration = {
      scriptId,
      scriptData,
      inputs: inputTopics,
      output: { name: outputTopic, schemaName: outputDatatype },
      processMessage: messageProcessor.registration,
      processBlockMessage: blockProcessor.registration,
      terminate: () => {
        messageProcessor.terminate();
        blockProcessor.terminate();
      },
    };
    state.scriptRegistrationCache.push({ scriptId, userScript, result });
    return result;
  }

  #getTransformWorker(): Rpc {
    if (!this.#transformRpc) {
      const worker = UserScriptPlayer.CreateTransformWorker();

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

      this.#transformRpc = rpc;
    }
    return this.#transformRpc;
  }

  // We need to reset workers in a variety of circumstances:
  // - When a user script is updated, added or deleted
  // - When we seek (in order to reset state)
  // - When a new child player is added
  async #resetWorkersUnlocked(state: ProtectedState): Promise<void> {
    if (!state.lastPlayerStateActiveData) {
      return;
    }

    // This early return is an optimization measure so that the
    // `scriptRegistrations` array is not re-defined, which will invalidate
    // downstream caches. (i.e. `this._getTopics`)
    if (state.scriptRegistrations.length === 0 && Object.entries(state.userScripts).length === 0) {
      return;
    }

    // teardown and cleanup any existing script registrations
    for (const scriptRegistration of state.scriptRegistrations) {
      scriptRegistration.terminate();
    }
    state.scriptRegistrations = [];

    const rosLib = await this.#getRosLib(state);
    const typesLib = await this.#getTypesLib(state);

    const allScriptRegistrations = await Promise.all(
      Object.entries(state.userScripts).map(
        async ([scriptId, userScript]) =>
          await this.#createScriptRegistration(scriptId, userScript, state, rosLib, typesLib),
      ),
    );

    const validScriptRegistrations: ScriptRegistration[] = [];
    const playerTopics = new Set(state.lastPlayerStateActiveData.topics.map((topic) => topic.name));
    const allScriptOutputs = new Set(
      allScriptRegistrations.map(({ scriptData }) => scriptData.outputTopic),
    );

    // Clear the output -> input map and re-populate it again with with all the script registrations
    state.inputsByOutputTopic.clear();

    for (const scriptRegistration of allScriptRegistrations) {
      const { scriptData, scriptId } = scriptRegistration;

      if (!scriptData.outputTopic) {
        this.#setUserScriptDiagnostics(scriptId, [
          ...scriptData.diagnostics,
          {
            severity: DiagnosticSeverity.Error,
            message: `Output topic cannot be an empty string.`,
            source: Sources.OutputTopicChecker,
            code: ErrorCodes.OutputTopicChecker.NOT_UNIQUE,
          },
        ]);
        continue;
      }

      // Create diagnostic errors if more than one script outputs to the same topic
      if (state.inputsByOutputTopic.has(scriptData.outputTopic)) {
        this.#setUserScriptDiagnostics(scriptId, [
          ...scriptData.diagnostics,
          {
            severity: DiagnosticSeverity.Error,
            message: `Output "${scriptData.outputTopic}" must be unique`,
            source: Sources.OutputTopicChecker,
            code: ErrorCodes.OutputTopicChecker.NOT_UNIQUE,
          },
        ]);
        continue;
      }

      // Record the required input topics to service this output topic
      state.inputsByOutputTopic.set(scriptData.outputTopic, scriptData.inputTopics);

      // Create diagnostic errors if script outputs overlap with real topics
      if (playerTopics.has(scriptData.outputTopic)) {
        this.#setUserScriptDiagnostics(scriptId, [
          ...scriptData.diagnostics,
          {
            severity: DiagnosticSeverity.Error,
            message: `Output topic "${scriptData.outputTopic}" is already present in the data source`,
            source: Sources.OutputTopicChecker,
            code: ErrorCodes.OutputTopicChecker.EXISTING_TOPIC,
          },
        ]);
        continue;
      }

      // Filter out scripts with compilation errors
      if (hasTransformerErrors(scriptData)) {
        this.#setUserScriptDiagnostics(scriptId, scriptData.diagnostics);
        continue;
      }

      // Throw if scripts use other scripts' outputs as inputs. We should never get here because we
      // already prevent outputs from being the same as real topics in the data source, and we
      // already filter out input topics that aren't present in the data source.
      for (const input of scriptData.inputTopics) {
        if (allScriptOutputs.has(input)) {
          throw new Error(`Input "${input}" cannot equal another script's output`);
        }
      }

      validScriptRegistrations.push(scriptRegistration);
    }

    let changedTopicsRequireEmitState = false;
    state.scriptRegistrations = validScriptRegistrations;
    const scriptTopics = state.scriptRegistrations.map(({ output }) => output);
    if (!_.isEqual(scriptTopics, this.#memoizedScriptTopics)) {
      this.#memoizedScriptTopics = scriptTopics;
      changedTopicsRequireEmitState = true;
    }
    const scriptDatatypes = state.scriptRegistrations.map(
      ({ scriptData: { datatypes } }) => datatypes,
    );
    if (!_.isEqual(scriptDatatypes, this.#memoizedScriptDatatypes)) {
      this.#memoizedScriptDatatypes = scriptDatatypes;
      changedTopicsRequireEmitState = true;
    }

    // We need to set the user script diagnostics, which is a react set state
    // function. This is called once per user script. Since this is in an async
    // function, the state updates will not be batched below React 18 and React
    // will update components synchronously during the set state. In a complex
    // layout, each of the following #setUserScriptDiagnostics call result in
    // ~100ms of latency. With many scripts, this can turn into a multi-second
    // stall during layout switching.
    //
    // By batching the state update, unnecessary component updates are avoided
    // and performance is improved for layout switching and initial loading.
    //
    // Moving to React 18 should remove the need for this call.
    ReactDOM.unstable_batchedUpdates(() => {
      for (const scriptRegistration of state.scriptRegistrations) {
        this.#setUserScriptDiagnostics(scriptRegistration.scriptId, []);
      }
    });

    // If we have new topics after processing the script registrations we need to emit a new
    // state to let downstream clients subscribe to newly available topics. This is
    // necessary because we won't emit a new state otherwise if there are no other active
    // subscriptions.
    if (changedTopicsRequireEmitState && this.#playerState?.activeData) {
      const newTopics = _.unionBy(
        this.#playerState.activeData.topics,
        this.#memoizedScriptTopics,
        (top) => top.name,
      );
      const newDatatypes = this.#getDatatypes(
        this.#playerState.activeData.datatypes,
        this.#memoizedScriptDatatypes,
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
      this.#userScriptActions.setUserScriptRosLib(lib);
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
      this.#userScriptActions.setUserScriptTypesLib(lib);
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
      // player just spun up, meaning we should re-run our user scripts in case
      // they have inputs that now exist in the current player context.
      const newPlayerState = await this.#protectedState.runExclusive(async (state) => {
        if (!state.lastPlayerStateActiveData) {
          state.lastPlayerStateActiveData = activeData;
          await this.#resetWorkersUnlocked(state);
          this.#setSubscriptionsUnlocked(this.#subscriptions, state);
        } else {
          // Reset script state after seeking
          let shouldReset =
            activeData.lastSeekTime !== state.lastPlayerStateActiveData.lastSeekTime;

          // When topics or datatypes change we also need to re-build the scripts so we clear the cache
          if (
            activeData.topics !== state.lastPlayerStateActiveData.topics ||
            activeData.datatypes !== state.lastPlayerStateActiveData.datatypes
          ) {
            shouldReset = true;
            state.scriptRegistrationCache = [];
          }

          state.lastPlayerStateActiveData = activeData;
          if (shouldReset) {
            await this.#resetWorkersUnlocked(state);
          }
        }

        const allDatatypes = this.#getDatatypes(datatypes, this.#memoizedScriptDatatypes);

        /**
         * if scripts have been updated we need to add their previous input messages
         * to our list of messages to be parsed so that subscribers can refresh with
         * the new output topic messages
         */
        const inputTopicsForRecompute = new Set<string>();

        for (const userScriptId of this.#userScriptIdsNeedUpdate) {
          const scriptRegistration = state.scriptRegistrations.find(
            ({ scriptId }) => scriptId === userScriptId,
          );
          if (!scriptRegistration) {
            continue;
          }
          const inputTopics = scriptRegistration.inputs;

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

        this.#userScriptIdsNeedUpdate.clear();

        for (const message of messages) {
          this.#lastMessageByInputTopic.set(message.topic, message);
        }

        // These are new messages generated from input messages
        const computed = await this.#getMessages(
          messages,
          globalVariables,
          state.scriptRegistrations,
        );

        // These are messages generated from previously saved messages on input topics
        const recomputed = await this.#getMessages(
          messagesForRecompute,
          globalVariables,
          state.scriptRegistrations,
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
            state.scriptRegistrations,
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
            topics: this.#getTopics(topics, this.#memoizedScriptTopics),
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
    // Wrap in mutex in case the emitState triggered by changed script registrations happens
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
    this.#scriptSubscriptions = getPreloadTypes(subscriptions);
    this.#player.setSubscriptions(
      remapVirtualSubscriptions(subscriptions, state.inputsByOutputTopic),
    );
  }

  public close = (): void => {
    void this.#protectedState.runExclusive(async (state) => {
      for (const scriptRegistration of state.scriptRegistrations) {
        scriptRegistration.terminate();
      }
    });
    this.#player.close();
    if (this.#transformRpc) {
      void this.#transformRpc.send("close");
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
