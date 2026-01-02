// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { produce } from "immer";
import { CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatest } from "react-use";
import { v4 as uuid } from "uuid";

import { useSynchronousMountedState, useValueChangedDebugLog } from "@lichtblick/hooks";
import Logger from "@lichtblick/log";
import { fromSec, toSec } from "@lichtblick/rostime";
import {
  AppSettingValue,
  ExtensionPanelRegistration,
  PanelExtensionContext,
  ParameterValue,
  RenderState,
  SettingsTree,
  SettingsTreeAction,
  Subscription,
  Time,
  VariableValue,
} from "@lichtblick/suite";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import { useAppConfiguration } from "@lichtblick/suite-base/context/AppConfigurationContext";
import {
  ExtensionCatalog,
  getExtensionPanelSettings,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import {
  useClearHoverValue,
  useHoverValue,
  useSetHoverValue,
} from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import {
  AdvertiseOptions,
  PlayerPresence,
  SubscribePayload,
} from "@lichtblick/suite-base/players/types";
import {
  useDefaultPanelTitle,
  usePanelSettingsTreeUpdate,
} from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import { PanelConfig, SaveConfig } from "@lichtblick/suite-base/types/panels";
import { assertNever } from "@lichtblick/suite-base/util/assertNever";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";

import { PanelConfigVersionError } from "./PanelConfigVersionError";
import { createMessageRangeIterator } from "./messageRangeIterator";
import { RenderStateConfig, initRenderStateBuilder } from "./renderState";
import { BuiltinPanelExtensionContext } from "./types";
import { useSharedPanelState } from "./useSharedPanelState";

const log = Logger.getLogger(__filename);

type VersionedPanelConfig = Record<string, unknown> & { [VERSION_CONFIG_KEY]: number };

export const VERSION_CONFIG_KEY = "foxgloveConfigVersion";

function isVersionedPanelConfig(config: unknown): config is VersionedPanelConfig {
  return (
    config != undefined &&
    typeof config === "object" &&
    VERSION_CONFIG_KEY in config &&
    typeof config[VERSION_CONFIG_KEY] === "number"
  );
}

type PanelExtensionAdapterProps = {
  /** function that initializes the panel extension */
  initPanel:
    | ExtensionPanelRegistration["initPanel"]
    | ((context: BuiltinPanelExtensionContext) => void);
  /**
   * If defined, the highest supported version of config the panel supports.
   * Used to prevent older implementations of a panel from trying to access
   * newer, incompatible versions of the panel's config. Panels should include a
   * numbered foxgloveConfigVersion property in their config to control this.
   */
  highestSupportedConfigVersion?: number;
  config: unknown;
  saveConfig: SaveConfig<unknown>;
};

function selectContext(ctx: MessagePipelineContext) {
  return ctx;
}

function selectInstalledMessageConverters(state: ExtensionCatalog) {
  return state.installedMessageConverters;
}

type RenderFn = NonNullable<PanelExtensionContext["onRender"]>;
/**
 * PanelExtensionAdapter renders a panel extension via initPanel
 *
 * The adapter creates a PanelExtensionContext and invokes initPanel using the context.
 */
function PanelExtensionAdapter(
  props: React.PropsWithChildren<PanelExtensionAdapterProps>,
): React.JSX.Element {
  const { initPanel, config, saveConfig, highestSupportedConfigVersion } = props;

  // Unlike the react data flow, the config is only provided to the panel once on setup.
  // The panel is meant to manage the config and call saveConfig on its own.
  //
  // We store the config in a ref to avoid re-initializing the panel when the react config
  // changes.
  const initialState = useLatest(maybeCast<RenderStateConfig>(config));

  const messagePipelineContext = useMessagePipeline(selectContext);

  const {
    playerState,
    pauseFrame,
    setSubscriptions,
    seekPlayback,
    getMetadata,
    sortedTopics,
    sortedServices,
    getBatchIterator,
  } = messagePipelineContext;

  const { capabilities, profile: dataSourceProfile, presence: playerPresence } = playerState;

  const { openSiblingPanel, setMessagePathDropConfig, type: panelName } = usePanelContext();

  const [panelId] = useState(() => uuid());
  const isMounted = useSynchronousMountedState();
  const [error, setError] = useState<Error | undefined>();
  const [watchedFields, setWatchedFields] = useState(new Set<keyof RenderState>());
  const messageConverters = useExtensionCatalog(selectInstalledMessageConverters);

  const [localSubscriptions, setLocalSubscriptions] = useState<Subscription[]>([]);

  const [appSettings, setAppSettings] = useState(new Map<string, AppSettingValue>());
  const [subscribedAppSettings, setSubscribedAppSettings] = useState<string[]>([]);

  const [renderFn, setRenderFn] = useState<RenderFn | undefined>();
  const isPanelInitializedRef = useRef(false);

  const [slowRender, setSlowRender] = useState(false);
  const [, setDefaultPanelTitle] = useDefaultPanelTitle();

  const { globalVariables, setGlobalVariables } = useGlobalVariables();

  const hoverValue = useHoverValue({
    componentId: `PanelExtensionAdapter:${panelId}`,
    isPlaybackSeconds: true,
  });
  const setHoverValue = useSetHoverValue();
  const clearHoverValue = useClearHoverValue();

  // track the advertisements requested by the panel context
  // topic -> advertisement
  const advertisementsRef = useRef(new Map<string, AdvertiseOptions>());

  const {
    palette: { mode: colorScheme },
  } = useTheme();

  const appConfiguration = useAppConfiguration();

  // The panel extension context exposes methods on the message pipeline. We don't want
  // the extension context to be re-created when the message pipeline changes since it only
  // needs to act on the latest version of the message pipeline.
  //
  // This getter allows the extension context to remain stable through pipeline changes
  const getMessagePipelineContext = useMessagePipelineGetter();

  // initRenderStateBuilder render produces a function which computes the latest render state from a set of inputs
  // Spiritually its like a reducer
  const [buildRenderState, setBuildRenderState] = useState(() => initRenderStateBuilder());

  const [sharedPanelState, setSharedPanelState] = useSharedPanelState();

  // Register handlers to update the app settings we subscribe to
  useEffect(() => {
    const handlers = new Map<string, (newValue: AppSettingValue) => void>();

    for (const key of subscribedAppSettings) {
      const handler = (newValue: AppSettingValue) => {
        setAppSettings((old) => {
          old.set(key, newValue);
          return new Map(old);
        });
      };
      handlers.set(key, handler);
      appConfiguration.addChangeListener(key, handler);
    }

    const newAppSettings = new Map<string, AppSettingValue>();
    for (const key of subscribedAppSettings) {
      newAppSettings.set(key, appConfiguration.get(key));
    }

    setAppSettings(newAppSettings);

    return () => {
      for (const [key, handler] of handlers.entries()) {
        appConfiguration.removeChangeListener(key, handler);
      }
    };
  }, [appConfiguration, subscribedAppSettings]);

  const messageEvents = useMemo(
    () => messagePipelineContext.messageEventsBySubscriberId.get(panelId),
    [messagePipelineContext.messageEventsBySubscriberId, panelId],
  );

  // The rendering ref is set when we've begin rendering the frame (calling the panel's render
  // function)
  //
  // If another update arrives before the panel finishes rendering, we will update the
  // slowRenderState to indicate that the panel could not keep up with rendering relative to
  // updates.
  const renderingRef = useRef<boolean>(false);
  useLayoutEffect(() => {
    /**
     * We need to check that the panel has been initialized because the renderFn function is being
     * called between the initPanel's useLayoutEffect cleanup and initPanel being called
     * again even if setRenderFn(undefined) is called in the cleanup function. This causes
     * the old renderFn to be called in this effect and pauseFrame to happen, but it is never
     * resumed, thus causing a 5 second delay in all panels in the layout to be loaded.
     */
    if (!renderFn || !isPanelInitializedRef.current) {
      return;
    }

    const renderState = buildRenderState({
      appSettings,
      colorScheme,
      currentFrame: messageEvents,
      globalVariables,
      hoverValue,
      messageConverters,
      playerState,
      sharedPanelState,
      sortedTopics,
      sortedServices,
      subscriptions: localSubscriptions,
      watchedFields,
      config: initialState.current,
    });

    if (!renderState) {
      return;
    }

    if (renderingRef.current) {
      setSlowRender(true);
      return;
    }

    setSlowRender(false);
    const resumeFrame = pauseFrame(panelId);

    // tell the panel to render and lockout future renders until rendering is complete
    renderingRef.current = true;
    try {
      setError(undefined);
      let doneCalled = false;
      renderFn(renderState, () => {
        // ignore any additional done calls from the panel
        if (doneCalled) {
          log.warn(`${panelId} called render done function twice`);
          return;
        }
        doneCalled = true;
        resumeFrame();
        renderingRef.current = false;
      });
    } catch (e: unknown) {
      const err = e as Error;
      setError(err);
    }
  }, [
    appSettings,
    buildRenderState,
    colorScheme,
    globalVariables,
    hoverValue,
    localSubscriptions,
    messageConverters,
    messageEvents,
    panelId,
    pauseFrame,
    playerState,
    renderFn,
    sharedPanelState,
    sortedTopics,
    sortedServices,
    watchedFields,
    initialState,
  ]);

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const extensionsSettings = useExtensionCatalog(getExtensionPanelSettings);

  type PartialPanelExtensionContext = Omit<BuiltinPanelExtensionContext, "panelElement">;

  const partialExtensionContext = useMemo<PartialPanelExtensionContext>(() => {
    const layout: PanelExtensionContext["layout"] = {
      addPanel: ({ position, type, updateIfExists, getState }) => {
        if (!isMounted()) {
          return;
        }

        // Check if it is not sibling. Currently it is impossible, but in the future it might be possible.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (position !== "sibling") {
          assertNever(position, `Unsupported position for addPanel: ${position}`);
        }

        openSiblingPanel({
          panelType: type,
          updateIfExists,
          siblingConfigCreator: (existingConfig) => getState(existingConfig) as PanelConfig,
        });
      },
    };

    const extensionSettingsActionHandler = (action: SettingsTreeAction) => {
      const {
        payload: { path },
      } = action;

      saveConfig(
        produce<{ topics: Record<string, unknown> }>((draft) => {
          const [category, topicName] = path;
          if (category === "topics" && topicName != undefined) {
            extensionsSettings[panelName]?.[topicName]?.handler(action, draft.topics[topicName]);
          }
        }),
      );
    };

    return {
      initialState: initialState.current,

      saveState: (state) => {
        if (!isMounted()) {
          return;
        }
        saveConfig(state);
      },

      layout,

      metadata: getMetadata(),

      seekPlayback: seekPlayback
        ? (stamp: number | Time) => {
            if (!isMounted()) {
              return;
            }
            const seekTarget = typeof stamp === "object" ? stamp : fromSec(stamp);
            seekPlayback(seekTarget);
          }
        : undefined,

      dataSourceProfile,

      setParameter: (name: string, value: ParameterValue) => {
        if (!isMounted()) {
          return;
        }
        getMessagePipelineContext().setParameter(name, value);
      },

      setVariable: (name: string, value: VariableValue) => {
        if (!isMounted()) {
          return;
        }
        setGlobalVariables({ [name]: value });
      },

      setPreviewTime: (stamp: number | undefined) => {
        if (!isMounted()) {
          return;
        }
        if (stamp == undefined) {
          clearHoverValue("PanelExtensionAdatper");
        } else {
          const ctx = getMessagePipelineContext();
          const startTime = ctx.playerState.activeData?.startTime;
          // if we don't have a start time we cannot correctly set the playback seconds hover value
          // this hover value needs seconds from start
          if (!startTime) {
            return;
          }
          const secondsFromStart = stamp - toSec(startTime);
          setHoverValue({
            type: "PLAYBACK_SECONDS",
            componentId: "PanelExtensionAdatper",
            value: secondsFromStart,
          });
        }
      },

      setSharedPanelState,

      watch: (field: keyof RenderState) => {
        if (!isMounted()) {
          return;
        }
        setWatchedFields((old) => {
          if (old.has(field)) {
            // In React 18 we noticed that this setter function would be called in an infinite loop
            // even though watch() was not called repeatedly. Adding this early return of the old
            // value fixed the issue.
            return old;
          }
          const newWatchedFields = new Set(old);
          newWatchedFields.add(field);
          return newWatchedFields;
        });
      },

      subscribe: (topics: ReadonlyArray<string | Subscription>) => {
        if (!isMounted()) {
          return;
        }
        const subscribePayloads = topics.map((item): SubscribePayload => {
          if (typeof item === "string") {
            // For backwards compatability with the topic-string-array api `subscribe(["/topic"])`
            // results in a topic subscription with full preloading
            return { topic: item, preloadType: "full" };
          }

          return {
            topic: item.topic,
            preloadType: item.preload === true ? "full" : "partial",
          };
        });

        // ExtensionPanel-Facing subscription type
        const localSubs = topics.map((item): Subscription => {
          if (typeof item === "string") {
            return { topic: item, preload: true };
          }

          return item;
        });

        setLocalSubscriptions(localSubs);
        setSubscriptions(panelId, subscribePayloads);
      },

      advertise: capabilities.includes(PLAYER_CAPABILITIES.advertise)
        ? (topic: string, datatype: string, options) => {
            if (!isMounted()) {
              return;
            }
            const payload: AdvertiseOptions = {
              topic,
              schemaName: datatype,
              options,
            };
            advertisementsRef.current.set(topic, payload);

            getMessagePipelineContext().setPublishers(
              panelId,
              Array.from(advertisementsRef.current.values()),
            );
          }
        : undefined,

      unadvertise: capabilities.includes(PLAYER_CAPABILITIES.advertise)
        ? (topic: string) => {
            if (!isMounted()) {
              return;
            }
            advertisementsRef.current.delete(topic);
            getMessagePipelineContext().setPublishers(
              panelId,
              Array.from(advertisementsRef.current.values()),
            );
          }
        : undefined,

      publish: capabilities.includes(PLAYER_CAPABILITIES.advertise)
        ? (topic, message) => {
            if (!isMounted()) {
              return;
            }
            getMessagePipelineContext().publish({
              topic,
              msg: message as Record<string, unknown>,
            });
          }
        : undefined,

      callService: capabilities.includes(PLAYER_CAPABILITIES.callServices)
        ? async (service, request): Promise<unknown> => {
            if (!isMounted()) {
              throw new Error("Service call after panel was unmounted");
            }
            return await getMessagePipelineContext().callService(service, request);
          }
        : undefined,

      unstable_fetchAsset: async (uri, options) => {
        if (!isMounted()) {
          throw new Error("Asset fetch after panel was unmounted");
        }
        return await getMessagePipelineContext().fetchAsset(uri, options);
      },

      unsubscribeAll: () => {
        if (!isMounted()) {
          return;
        }
        setLocalSubscriptions([]);
        setSubscriptions(panelId, []);
      },

      subscribeAppSettings: (settings: string[]) => {
        if (!isMounted()) {
          return;
        }
        setSubscribedAppSettings(settings);
      },

      updatePanelSettingsEditor: (settings: SettingsTree) => {
        if (!isMounted()) {
          return;
        }
        const actionHandler: typeof settings.actionHandler = (action) => {
          settings.actionHandler(action);
          extensionSettingsActionHandler(action);
        };
        updatePanelSettingsTree({ ...settings, actionHandler });
      },

      setDefaultPanelTitle: (title: string) => {
        if (!isMounted()) {
          return;
        }
        setDefaultPanelTitle(title);
      },

      /**
       * EXPERIMENTAL: Subscribe to message ranges for efficient batch processing.
       *
       * This API is marked as "unstable" because it's still experimental and not fully functional.
       * We're gradually testing and refining this feature to see how it performs in real-world scenarios.
       *
       * The API may change without notice as we gather feedback and improve the implementation.
       * Use with caution in production environments.
       *
       * Current limitations:
       * - Performance characteristics may vary
       * - Error handling is still being refined
       * - API surface may change based on testing feedback
       */
      unstable_subscribeMessageRange({ topic, convertTo, onNewRangeIterator }) {
        if (!isMounted()) {
          return () => {};
        }

        const rawBatchIterator = getBatchIterator(topic);
        if (!rawBatchIterator) {
          // If no batch iterator is available, just return an empty cleanup function
          return () => {};
        }

        const { iterable: messageEventIterable, cancel } = createMessageRangeIterator({
          topic,
          convertTo,
          rawBatchIterator,
          sortedTopics,
          messageConverters: messageConverters ?? [],
        });

        // Call the callback with the processed iterable
        onNewRangeIterator(messageEventIterable).catch((err: unknown) => {
          log.error("Error in onNewRangeIterator callback:", err);
        });

        return cancel;
      },

      unstable_setMessagePathDropConfig(dropConfig) {
        setMessagePathDropConfig(dropConfig);
      },
    };
    // Disable this rule because the metadata function. If used, it will break.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialState,
    seekPlayback,
    dataSourceProfile,
    setSharedPanelState,
    capabilities,
    isMounted,
    openSiblingPanel,
    saveConfig,
    extensionsSettings,
    panelName,
    getMessagePipelineContext,
    setGlobalVariables,
    clearHoverValue,
    setHoverValue,
    setSubscriptions,
    panelId,
    updatePanelSettingsTree,
    setDefaultPanelTitle,
    setMessagePathDropConfig,
  ]);

  const panelContainerRef = useRef<HTMLDivElement>(ReactNull);

  useValueChangedDebugLog(initPanel, "initPanel");
  useValueChangedDebugLog(panelId, "panelId");
  useValueChangedDebugLog(partialExtensionContext, "partialExtensionContext");

  const configTooNew = useMemo(() => {
    const latestConfig = initialState.current;
    return (
      isVersionedPanelConfig(latestConfig) &&
      highestSupportedConfigVersion != undefined &&
      latestConfig[VERSION_CONFIG_KEY] > highestSupportedConfigVersion
    );
  }, [initialState, highestSupportedConfigVersion]);

  const playerIsInitializing = playerPresence === PlayerPresence.INITIALIZING;

  // Manage extension lifecycle by calling initPanel() when the panel context changes.
  //
  // If we useEffect here instead of useLayoutEffect, the prevRenderState can get polluted with data
  // from a previous panel instance.
  useLayoutEffect(() => {
    if (!panelContainerRef.current) {
      throw new Error("Expected panel container to be mounted");
    }

    // Also don't show panel when the player is initializing. The initializing state is temporary for
    // players to go through to load their sources. Once a player has completed initialization `initPanel` is called again (or even a few times),
    // because parts of the player context have changed. This cleans up the old panel that was present
    // during initialization. So there can be no state held between extension panels between initialization and
    // whatever follows it. To prevent this unnecessary render, we do not render the panel during initialization.
    if (configTooNew || playerIsInitializing) {
      return;
    }

    // Reset local state when the panel element is mounted or changes
    setRenderFn(undefined);
    renderingRef.current = false;
    setSlowRender(false);

    setBuildRenderState(() => initRenderStateBuilder());

    const panelElement = document.createElement("div");
    panelElement.style.width = "100%";
    panelElement.style.height = "100%";
    panelElement.style.overflow = "hidden";
    panelContainerRef.current.appendChild(panelElement);

    log.info(`Init panel ${panelId}`);
    const onUnmount = initPanel({
      panelElement,
      ...partialExtensionContext,

      // eslint-disable-next-line no-restricted-syntax
      set onRender(renderFunction: RenderFn | undefined) {
        setRenderFn(() => renderFunction);
      },
    });
    isPanelInitializedRef.current = true;

    return () => {
      if (onUnmount) {
        onUnmount();
      }
      isPanelInitializedRef.current = false;
      panelElement.remove();
      getMessagePipelineContext().setSubscriptions(panelId, []);
      getMessagePipelineContext().setPublishers(panelId, []);
    };
  }, [
    initPanel,
    panelId,
    partialExtensionContext,
    getMessagePipelineContext,
    configTooNew,
    playerIsInitializing,
  ]);

  const style: CSSProperties = {};
  if (slowRender) {
    style.borderColor = "orange";
    style.borderWidth = "1px";
    style.borderStyle = "solid";
  }

  if (error) {
    throw error;
  }

  return (
    <div
      style={{
        alignItems: "stretch",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        width: "100%",
        zIndex: 0,
        ...style,
      }}
    >
      <PanelToolbar />
      {configTooNew && <PanelConfigVersionError />}
      {props.children}
      <div style={{ flex: 1, overflow: "hidden" }} ref={panelContainerRef} />
    </div>
  );
}

export default PanelExtensionAdapter;
