// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatest } from "react-use";
import { v4 as uuid } from "uuid";

import { useValueChangedDebugLog } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { fromSec, toSec } from "@foxglove/rostime";
import {
  AppSettingValue,
  ExtensionPanelRegistration,
  PanelExtensionContext,
  ParameterValue,
  RenderState,
  SettingsTree,
  Subscription,
  VariableValue,
} from "@foxglove/studio";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { useAppConfiguration } from "@foxglove/studio-base/context/AppConfigurationContext";
import {
  ExtensionCatalog,
  useExtensionCatalog,
} from "@foxglove/studio-base/context/ExtensionCatalogContext";
import {
  useClearHoverValue,
  useHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { useSynchronousMountedState } from "@foxglove/studio-base/hooks/useSynchronousMountedState";
import {
  AdvertiseOptions,
  PlayerCapabilities,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { PanelConfig, SaveConfig } from "@foxglove/studio-base/types/panels";
import { assertNever } from "@foxglove/studio-base/util/assertNever";

import { initRenderStateBuilder } from "./renderState";

const log = Logger.getLogger(__filename);

type PanelExtensionAdapterProps = {
  /** function that initializes the panel extension */
  initPanel: ExtensionPanelRegistration["initPanel"];

  config: unknown;
  saveConfig: SaveConfig<unknown>;

  /** Help document for the panel */
  help?: string;
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
function PanelExtensionAdapter(props: PanelExtensionAdapterProps): JSX.Element {
  const { initPanel, config, saveConfig } = props;

  // Unlike the react data flow, the config is only provided to the panel once on setup.
  // The panel is meant to manage the config and call saveConfig on its own.
  //
  // We store the config in a ref to avoid re-initializing the panel when the react config
  // changes.
  const initialState = useLatest(config);

  const messagePipelineContext = useMessagePipeline(selectContext);

  const { playerState, pauseFrame, setSubscriptions, seekPlayback, sortedTopics } =
    messagePipelineContext;

  const { capabilities, profile: dataSourceProfile } = playerState;

  const { openSiblingPanel } = usePanelContext();

  const [panelId] = useState(() => uuid());
  const isMounted = useSynchronousMountedState();
  const [error, setError] = useState<Error | undefined>();
  const [watchedFields, setWatchedFields] = useState(new Set<keyof RenderState>());
  const messageConverters = useExtensionCatalog(selectInstalledMessageConverters);

  const [localSubscriptions, setLocalSubscriptions] = useState<Subscription[]>([]);

  const [appSettings, setAppSettings] = useState(new Map<string, AppSettingValue>());
  const [subscribedAppSettings, setSubscribedAppSettings] = useState<string[]>([]);

  const [renderFn, setRenderFn] = useState<RenderFn | undefined>();

  const [slowRender, setSlowRender] = useState(false);

  const { globalVariables, setGlobalVariables } = useGlobalVariables();

  const hoverValue = useHoverValue({
    componentId: `PanelExtensionAdapter:${panelId}`,
    isTimestampScale: true,
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
    if (!renderFn) {
      return;
    }

    const renderState = buildRenderState({
      watchedFields,
      globalVariables,
      hoverValue,
      playerState,
      colorScheme,
      appSettings,
      subscriptions: localSubscriptions,
      currentFrame: messageEvents,
      sortedTopics,
      messageConverters,
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
    } catch (err) {
      setError(err);
    }
  }, [
    panelId,
    pauseFrame,
    localSubscriptions,
    watchedFields,
    appSettings,
    hoverValue,
    playerState,
    messageEvents,
    messageConverters,
    renderFn,
    colorScheme,
    buildRenderState,
    globalVariables,
    sortedTopics,
  ]);

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  type PartialPanelExtensionContext = Omit<PanelExtensionContext, "panelElement">;
  const partialExtensionContext = useMemo<PartialPanelExtensionContext>(() => {
    const layout: PanelExtensionContext["layout"] = {
      addPanel({ position, type, updateIfExists, getState }) {
        if (!isMounted()) {
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (position === "sibling") {
          openSiblingPanel({
            panelType: type,
            updateIfExists,
            siblingConfigCreator: (existingConfig) => getState(existingConfig) as PanelConfig,
          });
          return;
        }
        assertNever(position, `Unsupported position for addPanel: ${position}`);
      },
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

      seekPlayback: seekPlayback
        ? (stamp: number) => {
            if (!isMounted()) {
              return;
            }
            seekPlayback(fromSec(stamp));
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

      watch: (field: keyof RenderState) => {
        if (!isMounted()) {
          return;
        }
        setWatchedFields((old) => {
          old.add(field);
          return new Set(old);
        });
      },

      subscribe: (topics: ReadonlyArray<string | Subscription>) => {
        if (!isMounted()) {
          return;
        }
        const subscribePayloads = topics.map<SubscribePayload>((item) => {
          if (typeof item === "string") {
            // For backwards compatability with the topic-string-array api `subscribe(["/topic"])`
            // results in a topic subscription with full preloading
            return { topic: item, preloadType: "full" };
          }

          return {
            topic: item.topic,
            convertTo: item.convertTo,
            preloadType: item.preload === true ? "full" : "partial",
          };
        });

        setLocalSubscriptions(subscribePayloads);
        setSubscriptions(panelId, subscribePayloads);
      },

      advertise: capabilities.includes(PlayerCapabilities.advertise)
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

      unadvertise: capabilities.includes(PlayerCapabilities.advertise)
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

      publish: capabilities.includes(PlayerCapabilities.advertise)
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

      callService: capabilities.includes(PlayerCapabilities.callServices)
        ? async (service, request): Promise<unknown> => {
            if (!isMounted()) {
              throw new Error("Service call after panel was unmounted");
            }
            return await getMessagePipelineContext().callService(service, request);
          }
        : undefined,

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
        updatePanelSettingsTree(settings);
      },
    };
  }, [
    capabilities,
    clearHoverValue,
    dataSourceProfile,
    getMessagePipelineContext,
    initialState,
    isMounted,
    openSiblingPanel,
    panelId,
    saveConfig,
    seekPlayback,
    setGlobalVariables,
    setHoverValue,
    setSubscriptions,
    updatePanelSettingsTree,
  ]);

  const panelContainerRef = useRef<HTMLDivElement>(ReactNull);

  useValueChangedDebugLog(initPanel, "initPanel");
  useValueChangedDebugLog(panelId, "panelId");
  useValueChangedDebugLog(partialExtensionContext, "partialExtensionContext");

  // Manage extension lifecycle by calling initPanel() when the panel context changes.
  //
  // If we useEffect here instead of useLayoutEffect, the prevRenderState can get polluted with data
  // from a previous panel instance.
  useLayoutEffect(() => {
    if (!panelContainerRef.current) {
      throw new Error("Expected panel container to be mounted");
    }

    // Reset local state when the panel element is mounted or changes
    setRenderFn(undefined);
    setBuildRenderState(() => initRenderStateBuilder());

    const panelElement = document.createElement("div");
    panelElement.style.width = "100%";
    panelElement.style.height = "100%";
    panelElement.style.overflow = "hidden";
    panelContainerRef.current.appendChild(panelElement);

    log.info(`Init panel ${panelId}`);
    initPanel({
      panelElement,
      ...partialExtensionContext,

      // eslint-disable-next-line no-restricted-syntax
      set onRender(renderFunction: RenderFn | undefined) {
        setRenderFn(() => renderFunction);
      },
    });

    return () => {
      panelElement.remove();
      getMessagePipelineContext().setSubscriptions(panelId, []);
      getMessagePipelineContext().setPublishers(panelId, []);
    };
  }, [initPanel, panelId, partialExtensionContext, getMessagePipelineContext]);

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
      <PanelToolbar helpContent={props.help} />
      <div style={{ flex: 1, overflow: "hidden" }} ref={panelContainerRef} />
    </div>
  );
}

export default PanelExtensionAdapter;
