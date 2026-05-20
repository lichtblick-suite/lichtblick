// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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
import { v4 as uuidv4 } from "uuid";

import { MutexLocked } from "@lichtblick/den/async";
import { filterMap } from "@lichtblick/den/collection";
import Log from "@lichtblick/log";
import { Time, compare } from "@lichtblick/rostime";
import { Metadata, ParameterValue } from "@lichtblick/suite";
import { Asset } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import {
  IPerformanceRegistry,
  PerformanceMetricID,
} from "@lichtblick/suite-base/context/PerformanceContext";
import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { IteratorResult as IIterableSourceIteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { MemoizedLibGenerator } from "@lichtblick/suite-base/players/UserScriptPlayer/MemoizedLibGenerator";
import { generateTypesLib } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/generateTypesLib";
import { TransformArgs } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/types";
import {
  Diagnostic,
  ProcessMessageOutput,
  RegistrationOutput,
  ScriptData,
  ScriptRegistration,
  UserScriptLog,
} from "@lichtblick/suite-base/players/UserScriptPlayer/types";
import { hasTransformerErrors } from "@lichtblick/suite-base/players/UserScriptPlayer/utils";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerAlert,
  PlayerState,
  PlayerStateActiveData,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@lichtblick/suite-base/players/types";
import { reportError } from "@lichtblick/suite-base/reportError";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";
import { UserScript, UserScripts } from "@lichtblick/suite-base/types/panels";
import Rpc from "@lichtblick/suite-base/util/Rpc";
import { basicDatatypes } from "@lichtblick/suite-base/util/basicDatatypes";

import { DIAGNOSTIC_SEVERITY, ERROR_CODES, MAX_GLOBAL_BUFFER_SIZE, SOURCES } from "./constants";
import { getPreloadTypes, remapVirtualSubscriptions } from "./subscriptions";

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

type CacheConsumerHandle = { index: number };

type BatchIteratorCacheEntry = {
  results: Readonly<IIterableSourceIteratorResult>[];
  done: boolean;
  error?: Error;
  resolve: () => void;
  promise: Promise<void>;
  processor: { terminate: () => void };
  consumers: Set<CacheConsumerHandle>;
  pruneOffset: number;
};

export default class UserScriptPlayer implements Player {
  #player: Player;
  #perfRegistry?: IPerformanceRegistry;
  #totalTimeMetric?: PerformanceMetricID;

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

  // The store tracks alerts for individual user scripts
  // a script may set its own alert or clear its alert
  #alertStore = new Map<string, PlayerAlert>();

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

  // Shadow copy of script registrations keyed by output topic for synchronous access
  // in getBatchIterator (which can't use the async MutexLocked).
  // Updated in #resetWorkersUnlocked.
  #outputTopicRegistrations = new Map<string, ScriptRegistration>();

  // Shared cache for virtual topic batch iterators. One source consumer per topic processes
  // messages through its own worker; multiple panels replay from the shared results array.
  readonly #batchIteratorCache = new Map<string, BatchIteratorCacheEntry>();

  #totalCachedResults: number = 0;

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

  public constructor(
    player: Player,
    userScriptActions: UserScriptActions,
    perfRegistry?: IPerformanceRegistry,
  ) {
    this.#player = player;
    this.#userScriptActions = userScriptActions;
    this.#perfRegistry = perfRegistry;
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

  public setGlobalVariables(globalVariables: GlobalVariables): void {
    this.#globalVariables = globalVariables;
    this.#player.setGlobalVariables(globalVariables);
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
      this.#invalidateBatchIteratorCache();
      // Create new Topic objects so downstream consumers (e.g. PlotCoordinator) can detect
      // which specific topics had their preloaded data invalidated via reference comparison.
      this.#memoizedScriptTopics = this.#memoizedScriptTopics.map((t) => ({ ...t }));
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

    // alertKey is a unique identifier for each user script so we can manage alerts from
    // a specific script. A script may have a problem that may later clear. Using the key we can add/remove
    // alerts for specific user scripts independently of other user scripts.
    const alertKey = `script-id-${scriptId}`;
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

              this.#alertStore.set(alertKey, {
                message: `User script runtime error: ${event.message}`,
                severity: "error",
              });

              // trigger listener updates
              void this.#queueEmitState();
            };

            const port: MessagePort = worker.port;
            port.onmessageerror = (event) => {
              log.error(event);

              this.#alertStore.set(alertKey, {
                severity: "error",
                message: `User script runtime error: ${String(event.data)}`,
              });

              void this.#queueEmitState();
            };
            port.start();
            rpc = new Rpc(port);

            rpc.receive("error", (msg) => {
              log.error(msg);

              this.#alertStore.set(alertKey, {
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
                source: SOURCES.Runtime,
                severity: DIAGNOSTIC_SEVERITY.Error,
                message: error,
                code: ERROR_CODES.RUNTIME,
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
            source: SOURCES.Runtime,
            severity: DIAGNOSTIC_SEVERITY.Error,
            message: result.error,
            code: ERROR_CODES.RUNTIME,
          });
        }

        this.#addUserScriptLogs(scriptId, result.userScriptLogs);

        if (allDiagnostics.length > 0) {
          this.#alertStore.set(alertKey, {
            severity: "error",
            message: `User Script ${scriptData.name} encountered an error.`,
            tip: "Open the User Scripts panel and check the Alerts tab for errors.",
          });

          this.#setUserScriptDiagnostics(scriptId, allDiagnostics);
          return;
        }

        if (!result.message) {
          this.#alertStore.set(alertKey, {
            severity: "warn",
            message: `User Script ${scriptData.name} did not produce a message.`,
            tip: "Check that all code paths in the user script return a message.",
          });
          return;
        }

        // At this point we've received a message successfully from the user script, therefore
        // we clear any previous problem from this script.
        this.#alertStore.delete(alertKey);

        return {
          topic: outputTopic,
          receiveTime: msgEvent.receiveTime,
          message: result.message,
          sizeInBytes: msgEvent.sizeInBytes,
          schemaName: outputDatatype,
        };
      };

      const terminate = () => {
        this.#alertStore.delete(alertKey);

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
      buildMessageProcessor: () => {
        const proc = buildMessageProcessor();
        return { processMessage: proc.registration, terminate: proc.terminate };
      },
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

        this.#alertStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${event.message}`,
        });

        void this.#queueEmitState();
      };

      const port: MessagePort = worker.port;
      port.onmessageerror = (event) => {
        log.error(event);

        this.#alertStore.set("worker-error", {
          severity: "error",
          message: `User Script error: ${String(event.data)}`,
        });

        void this.#queueEmitState();
      };
      port.start();
      const rpc = new Rpc(port);

      rpc.receive("error", (msg) => {
        log.error(msg);

        this.#alertStore.set("worker-error", {
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
  // Invalidate shared batch iterator cache. Called when scripts or topics/datatypes change
  // (NOT on seek — seek doesn't affect preloaded block data and PlotCoordinator won't re-subscribe).
  #invalidateBatchIteratorCache() {
    for (const cache of this.#batchIteratorCache.values()) {
      this.#totalCachedResults -= cache.results.length;
      cache.done = true;
      cache.resolve();
      cache.processor.terminate();
    }
    this.#batchIteratorCache.clear();
    this.#alertStore.delete("batch-iterator-buffer-overflow");
  }

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

    const rosLib = await this.#getLib(
      state,
      this.#rosLibGenerator,
      this.#userScriptActions.setUserScriptRosLib,
    );
    const typesLib = await this.#getLib(
      state,
      this.#typesLibGenerator,
      this.#userScriptActions.setUserScriptTypesLib,
    );

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
            severity: DIAGNOSTIC_SEVERITY.Error,
            message: `Output topic cannot be an empty string.`,
            source: SOURCES.OutputTopicChecker,
            code: ERROR_CODES.OutputTopicChecker.NOT_UNIQUE,
          },
        ]);
        continue;
      }

      // Create diagnostic errors if more than one script outputs to the same topic
      if (state.inputsByOutputTopic.has(scriptData.outputTopic)) {
        this.#setUserScriptDiagnostics(scriptId, [
          ...scriptData.diagnostics,
          {
            severity: DIAGNOSTIC_SEVERITY.Error,
            message: `Output "${scriptData.outputTopic}" must be unique`,
            source: SOURCES.OutputTopicChecker,
            code: ERROR_CODES.OutputTopicChecker.NOT_UNIQUE,
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
            severity: DIAGNOSTIC_SEVERITY.Error,
            message: `Output topic "${scriptData.outputTopic}" is already present in the data source`,
            source: SOURCES.OutputTopicChecker,
            code: ERROR_CODES.OutputTopicChecker.EXISTING_TOPIC,
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

    // Atomically replace shadow registry for synchronous access in getBatchIterator.
    // We avoid clearing the old map earlier because getBatchIterator is synchronous and
    // could be called during the async gap above — stale-but-functional registrations
    // are better than an empty map that causes panels to get no iterator.
    const newOutputTopicRegistrations = new Map<string, ScriptRegistration>();
    for (const reg of validScriptRegistrations) {
      newOutputTopicRegistrations.set(reg.output.name, reg);
    }
    this.#outputTopicRegistrations = newOutputTopicRegistrations;

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

    for (const scriptRegistration of state.scriptRegistrations) {
      this.#setUserScriptDiagnostics(scriptRegistration.scriptId, []);
    }

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

  async #getLib(
    state: ProtectedState,
    generator: MemoizedLibGenerator,
    setter: (lib: string) => void,
  ): Promise<string> {
    if (!state.lastPlayerStateActiveData) {
      throw new Error("getLib was called before `lastPlayerStateActiveData` set");
    }

    const { topics, datatypes } = state.lastPlayerStateActiveData;
    const { didUpdate, lib } = await generator.update({ topics, datatypes });
    if (didUpdate) {
      setter(lib);
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

      if (this.#totalTimeMetric == undefined) {
        this.#totalTimeMetric = this.#perfRegistry?.registerMetric({
          name: "User scripts (total)",
          unit: "ms per frame",
        });
      }
      using $timer = this.#totalTimeMetric
        ? this.#perfRegistry?.scopeTimer(this.#totalTimeMetric)
        : undefined;
      void $timer;

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
            this.#invalidateBatchIteratorCache();
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
      this.#alertStore.delete("player-state-update");
    } catch (e: unknown) {
      const err = e as Error;
      this.#alertStore.set("player-state-update", {
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

      // only augment child alerts if we have our own alerts
      // if neither child or parent have alerts we do nothing
      let alerts = this.#playerState.alerts;
      if (this.#alertStore.size > 0) {
        alerts = (alerts ?? []).concat(Array.from(this.#alertStore.values()));
      }

      const playerState: PlayerState = {
        ...this.#playerState,
        alerts,
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
      .catch((err: unknown) => {
        log.error(err);
        reportError(err instanceof Error ? err : new Error(String(err)));
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
    if (this.#totalTimeMetric != undefined) {
      this.#perfRegistry?.unregisterMetric(this.#totalTimeMetric);
    }
    if (this.#transformRpc) {
      void this.#transformRpc.send("close");
    }
  };

  public getMetadata(): ReadonlyArray<Readonly<Metadata>> {
    return this.#player.getMetadata?.() ?? Object.freeze([]);
  }

  public getBatchIterator(
    topic: string,
    options?: { start?: Time; end?: Time },
  ): AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>> | undefined {
    const registration = this.#outputTopicRegistrations.get(topic);
    if (!registration) {
      return this.#player.getBatchIterator(topic, options);
    }

    return this.#getVirtualBatchIterator(registration, options);
  }

  #collectInputIterators(
    inputTopics: readonly string[],
    options?: { start?: Time; end?: Time },
  ): AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>>[] | undefined {
    const iterators: AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>>[] = [];
    for (const inputTopic of inputTopics) {
      const iter = this.#player.getBatchIterator(inputTopic, options);
      if (iter) {
        iterators.push(iter);
      }
    }
    return iterators.length > 0 ? iterators : undefined;
  }

  #getVirtualBatchIterator(
    registration: ScriptRegistration,
    options?: { start?: Time; end?: Time },
  ): AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>> | undefined {
    const inputTopics = registration.inputs;
    if (inputTopics.length === 0) {
      return undefined;
    }

    // For full-range (no options), use shared cache so multiple panels
    // subscribing to the same virtual topic only process messages once.
    if (!options) {
      const topic = registration.output.name;
      const existingCache = this.#batchIteratorCache.get(topic);
      if (existingCache) {
        return this.#createReplayIterator(existingCache);
      }

      const inputIterators = this.#collectInputIterators(inputTopics);
      if (!inputIterators) {
        return undefined;
      }
      const cache = this.#startSharedConsumer(registration, inputIterators);
      this.#batchIteratorCache.set(topic, cache);
      return this.#createReplayIterator(cache);
    }

    // With range options, create an independent iterator (no cache)
    const inputIterators = this.#collectInputIterators(inputTopics, options);
    if (!inputIterators) {
      return undefined;
    }

    return this.#createIndependentIterator(registration, inputIterators);
  }

  /**
   * Merges multiple input iterators by receiveTime, processes each message through
   * the given processor, and yields transformed results. Handles cleanup of iterators
   * and processor on completion.
   */
  static async *#mergeAndTransformIterators(
    inputIterators: AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>>[],
    processor: { processMessage: ScriptRegistration["processMessage"]; terminate: () => void },
    globalVariables: GlobalVariables,
  ): AsyncGenerator<Readonly<IIterableSourceIteratorResult>> {
    const source =
      inputIterators.length === 1
        ? inputIterators[0]!
        : UserScriptPlayer.#mergeIteratorsByTime(inputIterators);

    try {
      for await (const result of source) {
        if (result.type === "message-event") {
          const outputMessage = await processor.processMessage(result.msgEvent, globalVariables);
          if (outputMessage) {
            yield { type: "message-event" as const, msgEvent: outputMessage };
          }
        } else {
          yield result;
        }
      }
    } finally {
      for (const iter of inputIterators) {
        await iter.return?.();
      }
      processor.terminate();
    }
  }

  /**
   * Merges multiple async iterators into a single stream ordered by receiveTime.
   * Non-message-event results (e.g. stamps) are yielded before message events.
   */
  static async *#mergeIteratorsByTime(
    iterators: AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>>[],
  ): AsyncGenerator<Readonly<IIterableSourceIteratorResult>> {
    const heads: {
      iter: AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>>;
      current: Readonly<IIterableSourceIteratorResult>;
    }[] = [];

    for (const iter of iterators) {
      const next = await iter.next();
      if (next.done !== true) {
        heads.push({ iter, current: next.value });
      }
    }

    while (heads.length > 0) {
      const minIdx = UserScriptPlayer.#findEarliestHeadIndex(heads);
      const head = heads[minIdx]!;
      yield head.current;

      const next = await head.iter.next();
      if (next.done === true) {
        heads.splice(minIdx, 1);
      } else {
        head.current = next.value;
      }
    }
  }

  /**
   * Finds the index of the head with the earliest receiveTime.
   * Non-message-event results are treated as earlier than any message event.
   */
  static #findEarliestHeadIndex(
    heads: { current: Readonly<IIterableSourceIteratorResult> }[],
  ): number {
    let minIdx = 0;
    for (let i = 1; i < heads.length; i++) {
      const a = heads[minIdx]!.current;
      const b = heads[i]!.current;

      if (a.type !== "message-event") {
        continue; // a is non-message → already earliest priority
      }
      if (
        b.type !== "message-event" ||
        compare(b.msgEvent.receiveTime, a.msgEvent.receiveTime) < 0
      ) {
        minIdx = i; // b is non-message → takes priority
      }
    }
    return minIdx;
  }

  #startSharedConsumer(
    registration: ScriptRegistration,
    inputIterators: AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>>[],
  ) {
    const processor = registration.buildMessageProcessor();
    const globalVariables = this.#globalVariables;

    let resolve = () => {};
    const cache: BatchIteratorCacheEntry = {
      results: [],
      done: false,
      error: undefined,
      resolve,
      promise: new Promise<void>((r) => {
        resolve = r;
      }),
      processor,
      consumers: new Set(),
      pruneOffset: 0,
    };

    // The executor runs synchronously, so `resolve` is now set.
    cache.resolve = resolve;

    const notify = () => {
      cache.resolve();
      cache.promise = new Promise<void>((r) => {
        cache.resolve = r;
      });
    };

    // Source consumer — processes messages once, populates shared results
    void (async () => {
      try {
        const source = UserScriptPlayer.#mergeAndTransformIterators(
          inputIterators,
          processor,
          globalVariables,
        );
        for await (const result of source) {
          if (cache.done) {
            break;
          }
          cache.results.push(result);
          this.#totalCachedResults++;
          notify();
        }
      } catch (err) {
        cache.error = err as Error;
      } finally {
        cache.done = true;
        notify();
      }
    })();

    return cache;
  }

  #createReplayIterator(cache: BatchIteratorCacheEntry) {
    const consumer: CacheConsumerHandle = { index: cache.pruneOffset };
    cache.consumers.add(consumer);
    return this.#replayIteratorImpl(cache, consumer);
  }

  async *#replayIteratorImpl(
    cache: BatchIteratorCacheEntry,
    consumer: CacheConsumerHandle,
  ): AsyncGenerator<Readonly<IIterableSourceIteratorResult>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        if (this.#totalCachedResults > MAX_GLOBAL_BUFFER_SIZE) {
          this.#alertStore.set("batch-iterator-buffer-overflow", {
            severity: "warn",
            message: "User script output buffer exceeded",
            tip: `Maximum ${MAX_GLOBAL_BUFFER_SIZE} cached results reached. Late-joining panels may show incomplete data for user script topics.`,
          });
          this.#pruneCache(cache);
        }
        const localIndex = consumer.index - cache.pruneOffset;
        if (localIndex < cache.results.length) {
          yield cache.results[localIndex]!;
          consumer.index++;
        } else if (cache.done) {
          if (cache.error) {
            throw cache.error;
          }
          return;
        } else {
          await cache.promise;
        }
      }
    } finally {
      cache.consumers.delete(consumer);
    }
  }

  #pruneCache(cache: BatchIteratorCacheEntry) {
    let min = Infinity;
    for (const consumer of cache.consumers) {
      if (consumer.index < min) {
        min = consumer.index;
      }
    }
    // Prune entries all consumers have passed
    const prunable = min - cache.pruneOffset;
    if (prunable > 0) {
      cache.results.splice(0, prunable);
      this.#totalCachedResults -= prunable;
      cache.pruneOffset += prunable;
    }
  }

  #createIndependentIterator(
    registration: ScriptRegistration,
    inputIterators: AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>>[],
  ): AsyncIterableIterator<Readonly<IIterableSourceIteratorResult>> {
    const processor = registration.buildMessageProcessor();
    return UserScriptPlayer.#mergeAndTransformIterators(
      inputIterators,
      processor,
      this.#globalVariables,
    );
  }

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
