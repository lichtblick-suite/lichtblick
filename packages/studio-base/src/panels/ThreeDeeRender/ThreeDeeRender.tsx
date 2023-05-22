// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { cloneDeep, isEqual, merge } from "lodash";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useLatest } from "react-use";
import { DeepPartial } from "ts-essentials";
import { useDebouncedCallback } from "use-debounce";

import Logger from "@foxglove/log";
import { Time, toNanoSec } from "@foxglove/rostime";
import {
  LayoutActions,
  MessageEvent,
  PanelExtensionContext,
  ParameterValue,
  RenderState,
  SettingsTreeAction,
  SettingsTreeNodes,
  Subscription,
  Topic,
  VariableValue,
} from "@foxglove/studio";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import type {
  RendererConfig,
  RendererSubscription,
  FollowMode,
  RendererEvents,
  IRenderer,
  ImageModeConfig,
} from "./IRenderer";
import type { PickedRenderable } from "./Picker";
import { SELECTED_ID_VARIABLE } from "./Renderable";
import { LegacyImageConfig, Renderer } from "./Renderer";
import { RendererContext, useRendererEvent } from "./RendererContext";
import { RendererOverlay } from "./RendererOverlay";
import { CameraState, DEFAULT_CAMERA_STATE } from "./camera";
import {
  makePointMessage,
  makePoseEstimateMessage,
  makePoseMessage,
  PublishRos1Datatypes,
  PublishRos2Datatypes,
} from "./publish";
import type { LayerSettingsTransform } from "./renderables/FrameAxes";
import { PublishClickEvent } from "./renderables/PublishClickTool";
import { DEFAULT_PUBLISH_SETTINGS } from "./renderables/PublishSettings";
import { InterfaceMode } from "./types";

const log = Logger.getLogger(__filename);

type Shared3DPanelState = {
  cameraState: CameraState;
  followMode: FollowMode;
  followTf: undefined | string;
};

const PANEL_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  position: "relative",
};

function useRendererProperty<K extends keyof IRenderer>(
  renderer: IRenderer | undefined,
  key: K,
  event: keyof RendererEvents,
  fallback: () => IRenderer[K],
): IRenderer[K] {
  const [value, setValue] = useState<IRenderer[K]>(() => renderer?.[key] ?? fallback());
  useEffect(() => {
    if (!renderer) {
      return;
    }
    const onChange = () => setValue(() => renderer[key]);
    onChange();

    renderer.addListener(event, onChange);
    return () => {
      renderer.removeListener(event, onChange);
    };
  }, [renderer, event, key]);
  return value;
}

/**
 * A panel that renders a 3D scene. This is a thin wrapper around a `Renderer` instance.
 */
export function ThreeDeeRender(props: {
  context: PanelExtensionContext;
  interfaceMode: InterfaceMode;
}): JSX.Element {
  const { context, interfaceMode } = props;
  const { initialState, saveState } = context;

  // Load and save the persisted panel configuration
  const [config, setConfig] = useState<Immutable<RendererConfig>>(() => {
    const partialConfig = initialState as DeepPartial<RendererConfig> | undefined;

    // Initialize the camera from default settings overlaid with persisted settings
    const cameraState: CameraState = merge(
      cloneDeep(DEFAULT_CAMERA_STATE),
      partialConfig?.cameraState,
    );
    const publish = merge(cloneDeep(DEFAULT_PUBLISH_SETTINGS), partialConfig?.publish);

    const transforms = (partialConfig?.transforms ?? {}) as Record<
      string,
      Partial<LayerSettingsTransform>
    >;

    // Merge in config from the legacy Image panel
    const legacyImageConfig = partialConfig as DeepPartial<LegacyImageConfig> | undefined;
    const imageMode: ImageModeConfig = {
      imageTopic: legacyImageConfig?.cameraTopic,
      ...partialConfig?.imageMode,
      annotations: partialConfig?.imageMode?.annotations as
        | ImageModeConfig["annotations"]
        | undefined,
    };

    return {
      cameraState,
      followMode: partialConfig?.followMode ?? "follow-pose",
      followTf: partialConfig?.followTf,
      scene: partialConfig?.scene ?? {},
      transforms,
      topics: partialConfig?.topics ?? {},
      layers: partialConfig?.layers ?? {},
      publish,
      imageMode,
    };
  });
  const configRef = useLatest(config);
  const { cameraState } = config;
  const backgroundColor = config.scene.backgroundColor;

  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);
  const [renderer, setRenderer] = useState<IRenderer | undefined>(undefined);
  const rendererRef = useRef<IRenderer | undefined>(undefined);
  useEffect(() => {
    const newRenderer = canvas ? new Renderer(canvas, configRef.current, interfaceMode) : undefined;
    setRenderer(newRenderer);
    rendererRef.current = newRenderer;
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = undefined;
    };
  }, [canvas, configRef, config.scene.transforms?.enablePreloading, interfaceMode]);

  const [colorScheme, setColorScheme] = useState<"dark" | "light" | undefined>();
  const [timezone, setTimezone] = useState<string | undefined>();
  const [topics, setTopics] = useState<ReadonlyArray<Topic> | undefined>();
  const [parameters, setParameters] = useState<ReadonlyMap<string, ParameterValue> | undefined>();
  const [variables, setVariables] = useState<ReadonlyMap<string, VariableValue> | undefined>();
  const [currentFrameMessages, setCurrentFrameMessages] = useState<
    ReadonlyArray<MessageEvent> | undefined
  >();
  const [currentTime, setCurrentTime] = useState<Time | undefined>();
  const [didSeek, setDidSeek] = useState<boolean>(false);
  const [sharedPanelState, setSharedPanelState] = useState<undefined | Shared3DPanelState>();
  const [allFrames, setAllFrames] = useState<readonly MessageEvent[] | undefined>(undefined);

  const renderRef = useRef({ needsRender: false });
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const schemaHandlers = useRendererProperty(
    renderer,
    "schemaHandlers",
    "schemaHandlersChanged",
    () => new Map(),
  );
  const topicHandlers = useRendererProperty(
    renderer,
    "topicHandlers",
    "topicHandlersChanged",
    () => new Map(),
  );

  // Config cameraState
  useEffect(() => {
    const listener = () => {
      if (renderer) {
        const newCameraState = renderer.getCameraState();
        if (!newCameraState) {
          return;
        }
        // This needs to be before `setConfig` otherwise flickering will occur during
        // non-follow mode playback
        renderer.setCameraState(newCameraState);
        setConfig((prevConfig) => ({ ...prevConfig, cameraState: newCameraState }));

        if (config.scene.syncCamera === true) {
          context.setSharedPanelState({
            cameraState: newCameraState,
            followMode: config.followMode,
            followTf: renderer.followFrameId,
          });
        }
      }
    };
    renderer?.addListener("cameraMove", listener);
    return () => void renderer?.removeListener("cameraMove", listener);
  }, [config.scene.syncCamera, config.followMode, context, renderer?.followFrameId, renderer]);

  // Handle user changes in the settings sidebar
  const actionHandler = useCallback(
    (action: SettingsTreeAction) =>
      // Wrapping in unstable_batchedUpdates causes React to run effects _after_ the handleAction
      // function has finished executing. This allows scene extensions that call
      // renderer.updateConfig to read out the new config value and configure their renderables
      // before the render occurs.
      ReactDOM.unstable_batchedUpdates(() => {
        if (renderer) {
          const initialCameraState = renderer.getCameraState();
          renderer.settings.handleAction(action);
          const updatedCameraState = renderer.getCameraState();
          // Communicate camera changes from settings to the global state if syncing.
          if (updatedCameraState !== initialCameraState && config.scene.syncCamera === true) {
            context.setSharedPanelState({
              cameraState: updatedCameraState,
              followMode: config.followMode,
              followTf: renderer.followFrameId,
            });
          }
        }
      }),
    [config.followMode, config.scene.syncCamera, context, renderer],
  );

  // Maintain the settings tree
  const [settingsTree, setSettingsTree] = useState<SettingsTreeNodes | undefined>(undefined);
  const updateSettingsTree = useCallback(
    (curRenderer: IRenderer) => setSettingsTree(curRenderer.settings.tree()),
    [],
  );
  useRendererEvent("settingsTreeChange", updateSettingsTree, renderer);

  // Save the panel configuration when it changes
  const updateConfig = useCallback((curRenderer: IRenderer) => setConfig(curRenderer.config), []);
  useRendererEvent("configChange", updateConfig, renderer);

  // Write to a global variable when the current selection changes
  const updateSelectedRenderable = useCallback(
    (selection: PickedRenderable | undefined) => {
      const id = selection?.renderable.idFromMessage();
      const customVariable = selection?.renderable.selectedIdVariable();
      if (customVariable) {
        context.setVariable(customVariable, id);
      }
      context.setVariable(SELECTED_ID_VARIABLE, id);
    },
    [context],
  );
  useRendererEvent("selectedRenderable", updateSelectedRenderable, renderer);

  // Rebuild the settings sidebar tree as needed
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler,
      enableFilter: true,
      nodes: settingsTree ?? {},
    });
  }, [actionHandler, context, settingsTree]);

  // Update the renderer's reference to `config` when it changes. Note that this does *not*
  // automatically update the settings tree.
  useEffect(() => {
    if (renderer) {
      renderer.config = config;
      renderRef.current.needsRender = true;
    }
  }, [config, renderer]);

  // Update the renderer's reference to `topics` when it changes
  useEffect(() => {
    if (renderer) {
      renderer.setTopics(topics);
      renderRef.current.needsRender = true;
    }
  }, [topics, renderer]);

  // Tell the renderer if we are connected to a ROS data source
  useEffect(() => {
    if (renderer) {
      renderer.ros = context.dataSourceProfile === "ros1" || context.dataSourceProfile === "ros2";
    }
  }, [context.dataSourceProfile, renderer]);

  // Save panel settings whenever they change
  const throttledSave = useDebouncedCallback(
    (newConfig: Immutable<RendererConfig>) => saveState(newConfig),
    1000,
    { leading: false, trailing: true, maxWait: 1000 },
  );
  useEffect(() => throttledSave(config), [config, throttledSave]);

  // Keep default panel title up to date with selected image topic in image mode
  useEffect(() => {
    if (interfaceMode === "image") {
      context.setDefaultPanelTitle(config.imageMode.imageTopic);
    }
  }, [interfaceMode, context, config.imageMode.imageTopic]);

  // Establish a connection to the message pipeline with context.watch and context.onRender
  useLayoutEffect(() => {
    context.onRender = (renderState: RenderState, done) => {
      ReactDOM.unstable_batchedUpdates(() => {
        if (renderState.currentTime) {
          setCurrentTime(renderState.currentTime);
        }

        // Check if didSeek is set to true to reset the preloadedMessageTime and
        // trigger a state flush in Renderer
        if (renderState.didSeek === true) {
          setDidSeek(true);
        }

        // Set the done callback into a state variable to trigger a re-render
        setRenderDone(() => done);

        // Keep UI elements and the renderer aware of the current color scheme
        setColorScheme(renderState.colorScheme);
        if (renderState.appSettings) {
          const tz = renderState.appSettings.get(AppSetting.TIMEZONE);
          setTimezone(typeof tz === "string" ? tz : undefined);
        }

        // We may have new topics - since we are also watching for messages in
        // the current frame, topics may not have changed
        setTopics(renderState.topics);

        setSharedPanelState(renderState.sharedPanelState as Shared3DPanelState);

        // Watch for any changes in the map of observed parameters
        setParameters(renderState.parameters);

        // Watch for any changes in the map of global variables
        setVariables(renderState.variables);

        // currentFrame has messages on subscribed topics since the last render call
        deepParseMessageEvents(renderState.currentFrame);
        setCurrentFrameMessages(renderState.currentFrame);

        // allFrames has messages on preloaded topics across all frames (as they are loaded)
        deepParseMessageEvents(renderState.allFrames);
        setAllFrames(renderState.allFrames);
      });
    };

    context.watch("allFrames");
    context.watch("colorScheme");
    context.watch("currentFrame");
    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("parameters");
    context.watch("sharedPanelState");
    context.watch("variables");
    context.watch("topics");
    context.watch("appSettings");
    context.subscribeAppSettings([AppSetting.TIMEZONE]);
  }, [context, renderer]);

  // Build a list of topics to subscribe to
  const [topicsToSubscribe, setTopicsToSubscribe] = useState<Subscription[] | undefined>(undefined);
  useEffect(() => {
    if (!topics) {
      setTopicsToSubscribe(undefined);
      return;
    }

    const newSubscriptions: Subscription[] = [];

    const addSubscription = (
      topic: Topic,
      rendererSubscription: RendererSubscription,
      convertTo?: string,
    ) => {
      let shouldSubscribe = rendererSubscription.shouldSubscribe?.(topic.name);
      if (shouldSubscribe == undefined) {
        if (config.topics[topic.name]?.visible === true) {
          shouldSubscribe = true;
        } else if (
          config.imageMode.annotations?.some(
            (sub) =>
              sub.topic === topic.name &&
              sub.schemaName === (convertTo ?? topic.schemaName) &&
              sub.settings.visible,
          ) === true
        ) {
          shouldSubscribe = true;
        } else {
          shouldSubscribe = false;
        }
      }
      if (shouldSubscribe) {
        newSubscriptions.push({
          topic: topic.name,
          preload: rendererSubscription.preload,
          convertTo,
        });
      }
    };

    for (const topic of topics) {
      for (const rendererSubscription of topicHandlers.get(topic.name) ?? []) {
        addSubscription(topic, rendererSubscription);
      }
      for (const rendererSubscription of schemaHandlers.get(topic.schemaName) ?? []) {
        addSubscription(topic, rendererSubscription);
      }
      for (const schemaName of topic.convertibleTo ?? []) {
        for (const rendererSubscription of schemaHandlers.get(schemaName) ?? []) {
          addSubscription(topic, rendererSubscription, schemaName);
        }
      }
    }

    // Sort the list to make comparisons stable
    newSubscriptions.sort((a, b) => a.topic.localeCompare(b.topic));
    setTopicsToSubscribe((prev) => (isEqual(prev, newSubscriptions) ? prev : newSubscriptions));
  }, [
    topics,
    config.topics,
    // Need to update subscriptions when imagemode topics change
    // shouldSubscribe values will be re-evaluated
    config.imageMode.calibrationTopic,
    config.imageMode.imageTopic,
    schemaHandlers,
    topicHandlers,
    config.imageMode.annotations,
  ]);

  // Notify the extension context when our subscription list changes
  useEffect(() => {
    if (!topicsToSubscribe) {
      return;
    }
    log.debug(`Subscribing to [${topicsToSubscribe.map((t) => JSON.stringify(t)).join(", ")}]`);
    context.subscribe(topicsToSubscribe);
  }, [context, topicsToSubscribe]);

  // Keep the renderer parameters up to date
  useEffect(() => {
    if (renderer) {
      renderer.setParameters(parameters);
    }
  }, [parameters, renderer]);

  // Keep the renderer variables up to date
  useEffect(() => {
    if (renderer && variables) {
      renderer.setVariables(variables);
    }
  }, [variables, renderer]);

  // Keep the renderer currentTime up to date and handle seeking
  useEffect(() => {
    const newTimeNs = currentTime ? toNanoSec(currentTime) : undefined;

    /*
     * NOTE AROUND SEEK HANDLING
     * Seeking MUST be handled even if there is no change in current time.  When there is a subscription
     * change while paused, the player goes into `seek-backfill` which sets didSeek to true.
     *
     * We cannot early return here when there is no change in current time due to that, otherwise it would
     * handle seek next time the current time changes and clear the backfilled messages and transforms.
     */
    if (!renderer || newTimeNs == undefined) {
      return;
    }
    const oldTimeNs = renderer.currentTime;

    renderer.setCurrentTime(newTimeNs);
    if (didSeek) {
      renderer.handleSeek(oldTimeNs);
      setDidSeek(false);
    }
  }, [currentTime, renderer, didSeek]);

  // Keep the renderer colorScheme and backgroundColor up to date
  useEffect(() => {
    if (colorScheme && renderer) {
      renderer.setColorScheme(colorScheme, backgroundColor);
      renderRef.current.needsRender = true;
    }
  }, [backgroundColor, colorScheme, renderer]);

  // Handle preloaded messages and render a frame if new messages are available
  // Should be called before `messages` is handled
  useEffect(() => {
    // we want didseek to be handled by the renderer first so that transforms aren't cleared after the cursor has been brought up
    if (!renderer || !currentTime) {
      return;
    }
    const newMessagesHandled = renderer.handleAllFramesMessages(allFrames);
    if (newMessagesHandled) {
      renderRef.current.needsRender = true;
    }
  }, [renderer, currentTime, allFrames]);

  // Handle messages and render a frame if new messages are available
  useEffect(() => {
    if (!renderer || !currentFrameMessages) {
      return;
    }

    for (const message of currentFrameMessages) {
      renderer.addMessageEvent(message);
    }

    renderRef.current.needsRender = true;
  }, [currentFrameMessages, renderer]);

  // Update the renderer when the camera moves
  useEffect(() => {
    if (!isEqual(cameraState, renderer?.getCameraState())) {
      renderer?.setCameraState(cameraState);
      renderRef.current.needsRender = true;
    }
  }, [cameraState, renderer]);

  // Sync camera with shared state, if enabled.
  useEffect(() => {
    if (!renderer || sharedPanelState == undefined || config.scene.syncCamera !== true) {
      return;
    }

    if (sharedPanelState.followMode !== config.followMode) {
      renderer.setCameraSyncError(
        `Follow mode must be ${sharedPanelState.followMode} to sync camera.`,
      );
    } else if (sharedPanelState.followTf !== renderer.followFrameId) {
      renderer.setCameraSyncError(
        `Display frame must be ${sharedPanelState.followTf} to sync camera.`,
      );
    } else {
      const newCameraState = sharedPanelState.cameraState;
      renderer.setCameraState(newCameraState);
      renderRef.current.needsRender = true;
      setConfig((prevConfig) => ({
        ...prevConfig,
        cameraState: newCameraState,
      }));
      renderer.setCameraSyncError(undefined);
    }
  }, [
    config.scene.syncCamera,
    config.followMode,
    renderer,
    renderer?.followFrameId,
    sharedPanelState,
  ]);

  // Render a new frame if requested
  useEffect(() => {
    if (renderer && renderRef.current.needsRender) {
      renderer.animationFrame();
      renderRef.current.needsRender = false;
    }
  });

  // Invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  // Create a useCallback wrapper for adding a new panel to the layout, used to open the
  // "Raw Messages" panel from the object inspector
  const addPanel = useCallback(
    (params: Parameters<LayoutActions["addPanel"]>[0]) => context.layout.addPanel(params),
    [context.layout],
  );

  const [measureActive, setMeasureActive] = useState(false);
  useEffect(() => {
    const onStart = () => setMeasureActive(true);
    const onEnd = () => setMeasureActive(false);
    renderer?.measurementTool.addEventListener("foxglove.measure-start", onStart);
    renderer?.measurementTool.addEventListener("foxglove.measure-end", onEnd);
    return () => {
      renderer?.measurementTool.removeEventListener("foxglove.measure-start", onStart);
      renderer?.measurementTool.removeEventListener("foxglove.measure-end", onEnd);
    };
  }, [renderer?.measurementTool]);

  const onClickMeasure = useCallback(() => {
    if (measureActive) {
      renderer?.measurementTool.stopMeasuring();
    } else {
      renderer?.measurementTool.startMeasuring();
      renderer?.publishClickTool.stop();
    }
  }, [measureActive, renderer]);

  const [publishActive, setPublishActive] = useState(false);
  useEffect(() => {
    if (renderer?.publishClickTool.publishClickType !== config.publish.type) {
      renderer?.publishClickTool.setPublishClickType(config.publish.type);
      // stop if we changed types while a publish action was already in progress
      renderer?.publishClickTool.stop();
    }
  }, [config.publish.type, renderer]);

  const publishTopics = useMemo(() => {
    return {
      goal: config.publish.poseTopic,
      point: config.publish.pointTopic,
      pose: config.publish.poseEstimateTopic,
    };
  }, [config.publish.poseTopic, config.publish.pointTopic, config.publish.poseEstimateTopic]);

  useEffect(() => {
    const datatypes =
      context.dataSourceProfile === "ros2" ? PublishRos2Datatypes : PublishRos1Datatypes;
    context.advertise?.(publishTopics.goal, "geometry_msgs/PoseStamped", { datatypes });
    context.advertise?.(publishTopics.point, "geometry_msgs/PointStamped", { datatypes });
    context.advertise?.(publishTopics.pose, "geometry_msgs/PoseWithCovarianceStamped", {
      datatypes,
    });

    return () => {
      context.unadvertise?.(publishTopics.goal);
      context.unadvertise?.(publishTopics.point);
      context.unadvertise?.(publishTopics.pose);
    };
  }, [publishTopics, context, context.dataSourceProfile]);

  const latestPublishConfig = useLatest(config.publish);

  useEffect(() => {
    const onStart = () => setPublishActive(true);
    const onSubmit = (event: PublishClickEvent & { type: "foxglove.publish-submit" }) => {
      const frameId = renderer?.followFrameId;
      if (frameId == undefined) {
        log.warn("Unable to publish, renderFrameId is not set");
        return;
      }
      if (!context.publish) {
        log.error("Data source does not support publishing");
        return;
      }
      if (context.dataSourceProfile !== "ros1" && context.dataSourceProfile !== "ros2") {
        log.warn("Publishing is only supported in ros1 and ros2");
        return;
      }

      try {
        switch (event.publishClickType) {
          case "point": {
            const message = makePointMessage(event.point, frameId);
            context.publish(publishTopics.point, message);
            break;
          }
          case "pose": {
            const message = makePoseMessage(event.pose, frameId);
            context.publish(publishTopics.goal, message);
            break;
          }
          case "pose_estimate": {
            const message = makePoseEstimateMessage(
              event.pose,
              frameId,
              latestPublishConfig.current.poseEstimateXDeviation,
              latestPublishConfig.current.poseEstimateYDeviation,
              latestPublishConfig.current.poseEstimateThetaDeviation,
            );
            context.publish(publishTopics.pose, message);
            break;
          }
        }
      } catch (error) {
        log.info(error);
      }
    };
    const onEnd = () => setPublishActive(false);
    renderer?.publishClickTool.addEventListener("foxglove.publish-start", onStart);
    renderer?.publishClickTool.addEventListener("foxglove.publish-submit", onSubmit);
    renderer?.publishClickTool.addEventListener("foxglove.publish-end", onEnd);
    return () => {
      renderer?.publishClickTool.removeEventListener("foxglove.publish-start", onStart);
      renderer?.publishClickTool.removeEventListener("foxglove.publish-submit", onSubmit);
      renderer?.publishClickTool.removeEventListener("foxglove.publish-end", onEnd);
    };
  }, [
    context,
    latestPublishConfig,
    publishTopics,
    renderer?.followFrameId,
    renderer?.publishClickTool,
  ]);

  const onClickPublish = useCallback(() => {
    if (publishActive) {
      renderer?.publishClickTool.stop();
    } else {
      renderer?.publishClickTool.start();
      renderer?.measurementTool.stopMeasuring();
    }
  }, [publishActive, renderer]);

  const onTogglePerspective = useCallback(() => {
    const currentState = renderer?.getCameraState()?.perspective ?? false;
    actionHandler({
      action: "update",
      payload: {
        input: "boolean",
        path: ["cameraState", "perspective"],
        value: !currentState,
      },
    });
  }, [actionHandler, renderer]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "3") {
        onTogglePerspective();
        event.stopPropagation();
        event.preventDefault();
      }
    },
    [onTogglePerspective],
  );

  // The 3d panel only supports publishing to ros1 and ros2 data sources
  const isRosDataSource =
    context.dataSourceProfile === "ros1" || context.dataSourceProfile === "ros2";
  const canPublish = context.publish != undefined && isRosDataSource;

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <div style={PANEL_STYLE} onKeyDown={onKeyDown}>
        <canvas
          ref={setCanvas}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            ...((measureActive || publishActive) && { cursor: "crosshair" }),
          }}
        />
        <RendererContext.Provider value={renderer}>
          <RendererOverlay
            interfaceMode={interfaceMode}
            canvas={canvas}
            addPanel={addPanel}
            enableStats={config.scene.enableStats ?? false}
            perspective={config.cameraState.perspective}
            onTogglePerspective={onTogglePerspective}
            measureActive={measureActive}
            onClickMeasure={onClickMeasure}
            canPublish={canPublish}
            publishActive={publishActive}
            onClickPublish={onClickPublish}
            publishClickType={renderer?.publishClickTool.publishClickType ?? "point"}
            onChangePublishClickType={(type) => {
              renderer?.publishClickTool.setPublishClickType(type);
              renderer?.publishClickTool.start();
            }}
            timezone={timezone}
          />
        </RendererContext.Provider>
      </div>
    </ThemeProvider>
  );
}

function deepParseMessageEvents(messageEvents: ReadonlyArray<MessageEvent> | undefined): void {
  if (!messageEvents) {
    return;
  }
  for (const messageEvent of messageEvents) {
    const maybeLazy = messageEvent.message as { toJSON?: () => unknown };
    if ("toJSON" in maybeLazy) {
      (messageEvent as { message: unknown }).message = maybeLazy.toJSON!();
    }
  }
}
