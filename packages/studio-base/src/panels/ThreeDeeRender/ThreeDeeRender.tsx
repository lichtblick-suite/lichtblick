// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RulerIcon from "@mdi/svg/svg/ruler.svg";
import Video3dIcon from "@mdi/svg/svg/video-3d.svg";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  useTheme,
} from "@mui/material";
import { isEqual, cloneDeep, merge } from "lodash";
import React, { useCallback, useLayoutEffect, useEffect, useState, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { useLatest, useLongPress } from "react-use";
import { DeepPartial } from "ts-essentials";
import { useDebouncedCallback } from "use-debounce";

import Logger from "@foxglove/log";
import { isLessThan, Time, toNanoSec } from "@foxglove/rostime";
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
import PublishGoalIcon from "@foxglove/studio-base/components/PublishGoalIcon";
import PublishPointIcon from "@foxglove/studio-base/components/PublishPointIcon";
import PublishPoseEstimateIcon from "@foxglove/studio-base/components/PublishPoseEstimateIcon";
import useCleanup from "@foxglove/studio-base/hooks/useCleanup";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import { DebugGui } from "./DebugGui";
import { Interactions, InteractionContextMenu, SelectionObject, TabType } from "./Interactions";
import type { PickedRenderable } from "./Picker";
import type { Renderable } from "./Renderable";
import { Renderer, RendererConfig, RendererEvents, RendererSubscription } from "./Renderer";
import { RendererContext, useRenderer, useRendererEvent } from "./RendererContext";
import { Stats } from "./Stats";
import { CameraState, DEFAULT_CAMERA_STATE, MouseEventObject } from "./camera";
import {
  PublishRos1Datatypes,
  PublishRos2Datatypes,
  makePointMessage,
  makePoseEstimateMessage,
  makePoseMessage,
} from "./publish";
import { DEFAULT_PUBLISH_SETTINGS } from "./renderables/CoreSettings";
import type { LayerSettingsTransform } from "./renderables/FrameAxes";
import { PublishClickEvent, PublishClickType } from "./renderables/PublishClickTool";

const log = Logger.getLogger(__filename);

const SHOW_DEBUG: true | false = false;
const SELECTED_ID_VARIABLE = "selected_id";
const PANEL_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  position: "relative",
};
const TIME_ZERO = { sec: 0, nsec: 0 };

type SubscriptionWithOptions = Subscription & {
  preload: boolean;
  forced: boolean;
};

const PublishClickIcons: Record<PublishClickType, React.ReactNode> = {
  pose: <PublishGoalIcon fontSize="inherit" />,
  point: <PublishPointIcon fontSize="inherit" />,
  pose_estimate: <PublishPoseEstimateIcon fontSize="inherit" />,
};

/**
 * Provides DOM overlay elements on top of the 3D scene (e.g. stats, debug GUI).
 */
function RendererOverlay(props: {
  canvas: HTMLCanvasElement | ReactNull;
  addPanel: LayoutActions["addPanel"];
  enableStats: boolean;
  perspective: boolean;
  onTogglePerspective: () => void;
  measureActive: boolean;
  onClickMeasure: () => void;
  canPublish: boolean;
  publishActive: boolean;
  publishClickType: PublishClickType;
  onChangePublishClickType: (_: PublishClickType) => void;
  onClickPublish: () => void;
}): JSX.Element {
  const [clickedPosition, setClickedPosition] = useState<{ clientX: number; clientY: number }>({
    clientX: 0,
    clientY: 0,
  });
  const [selectedRenderables, setSelectedRenderables] = useState<PickedRenderable[]>([]);
  const [selectedRenderable, setSelectedRenderable] = useState<PickedRenderable | undefined>(
    undefined,
  );
  const [interactionsTabType, setInteractionsTabType] = useState<TabType | undefined>(undefined);
  const renderer = useRenderer();

  // Publish control is only available if the canPublish prop is true and we have a fixed frame in the renderer
  const showPublishControl: boolean = props.canPublish && renderer?.fixedFrameId != undefined;

  // Toggle object selection mode on/off in the renderer
  useEffect(() => {
    if (renderer) {
      renderer.setPickingEnabled(interactionsTabType != undefined);
    }
  }, [interactionsTabType, renderer]);

  useRendererEvent("renderablesClicked", (selections, cursorCoords) => {
    const rect = props.canvas!.getBoundingClientRect();
    setClickedPosition({ clientX: rect.left + cursorCoords.x, clientY: rect.top + cursorCoords.y });
    setSelectedRenderables(selections);
    setSelectedRenderable(selections.length === 1 ? selections[0] : undefined);
  });

  const stats = props.enableStats ? (
    <div id="stats" style={{ position: "absolute", top: "10px", left: "10px" }}>
      <Stats />
    </div>
  ) : undefined;

  const debug = SHOW_DEBUG ? (
    <div id="debug" style={{ position: "absolute", top: "70px", left: "10px" }}>
      <DebugGui />
    </div>
  ) : undefined;

  // Convert the list of selected renderables (if any) into MouseEventObjects
  // that can be passed to <InteractionContextMenu>, which shows a context menu
  // of candidate objects to select
  const clickedObjects = useMemo<MouseEventObject[]>(
    () =>
      selectedRenderables.map((selection) => ({
        object: {
          pose: selection.renderable.userData.pose,
          scale: selection.renderable.scale,
          color: undefined,
          interactionData: {
            topic: selection.renderable.name,
            highlighted: undefined,
            renderable: selection.renderable,
          },
        },
        instanceIndex: selection.instanceIndex,
      })),
    [selectedRenderables],
  );

  // Once a single renderable is selected, convert it to the SelectionObject
  // format to populate the object inspection dialog (<Interactions>)
  const selectedObject = useMemo<SelectionObject | undefined>(
    () =>
      selectedRenderable
        ? {
            object: {
              pose: selectedRenderable.renderable.userData.pose,
              interactionData: {
                topic: (selectedRenderable.renderable.userData as { topic?: string }).topic,
                highlighted: true,
                originalMessage: selectedRenderable.renderable.details(),
                instanceDetails:
                  selectedRenderable.instanceIndex != undefined
                    ? selectedRenderable.renderable.instanceDetails(
                        selectedRenderable.instanceIndex,
                      )
                    : undefined,
              },
            },
            instanceIndex: selectedRenderable.instanceIndex,
          }
        : undefined,
    [selectedRenderable],
  );

  // Inform the Renderer when a renderable is selected
  useEffect(() => {
    renderer?.setSelectedRenderable(selectedRenderable);
  }, [renderer, selectedRenderable]);

  const publickClickButtonRef = useRef<HTMLButtonElement>(ReactNull);
  const [publishMenuExpanded, setPublishMenuExpanded] = useState(false);
  const selectedPublishClickIcon = PublishClickIcons[props.publishClickType];

  const onLongPressPublish = useCallback(() => {
    setPublishMenuExpanded(true);
  }, []);
  const longPressPublishEvent = useLongPress(onLongPressPublish);

  const theme = useTheme();

  return (
    <React.Fragment>
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <Interactions
          addPanel={props.addPanel}
          selectedObject={selectedObject}
          interactionsTabType={interactionsTabType}
          setInteractionsTabType={setInteractionsTabType}
        />
        <Paper square={false} elevation={4} style={{ display: "flex", flexDirection: "column" }}>
          <IconButton
            color={props.perspective ? "info" : "inherit"}
            title={props.perspective ? "Switch to 2D camera" : "Switch to 3D camera"}
            onClick={props.onTogglePerspective}
            style={{ pointerEvents: "auto" }}
          >
            <Video3dIcon style={{ width: 16, height: 16 }} />
          </IconButton>
          <IconButton
            data-testid="measure-button"
            color={props.measureActive ? "info" : "inherit"}
            title={props.measureActive ? "Cancel measuring" : "Measure distance"}
            onClick={props.onClickMeasure}
            style={{ position: "relative", pointerEvents: "auto" }}
          >
            <RulerIcon style={{ width: 16, height: 16 }} />
          </IconButton>

          {showPublishControl && (
            <>
              <IconButton
                {...longPressPublishEvent}
                color={props.publishActive ? "info" : "inherit"}
                title={props.publishActive ? "Click to cancel" : "Click to publish"}
                ref={publickClickButtonRef}
                onClick={props.onClickPublish}
                data-testid="publish-button"
                style={{ fontSize: "1rem", pointerEvents: "auto" }}
              >
                {selectedPublishClickIcon}
                <div
                  style={{
                    borderBottom: "6px solid currentColor",
                    borderRight: "6px solid transparent",
                    bottom: 0,
                    left: 0,
                    height: 0,
                    width: 0,
                    margin: theme.spacing(0.25),
                    position: "absolute",
                  }}
                />
              </IconButton>
              <Menu
                id="publish-menu"
                anchorEl={publickClickButtonRef.current}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                open={publishMenuExpanded}
                onClose={() => setPublishMenuExpanded(false)}
              >
                <MenuItem
                  selected={props.publishClickType === "pose_estimate"}
                  onClick={() => {
                    props.onChangePublishClickType("pose_estimate");
                    setPublishMenuExpanded(false);
                  }}
                >
                  <ListItemIcon>{PublishClickIcons.pose_estimate}</ListItemIcon>
                  <ListItemText>Publish pose estimate</ListItemText>
                </MenuItem>
                <MenuItem
                  selected={props.publishClickType === "pose"}
                  onClick={() => {
                    props.onChangePublishClickType("pose");
                    setPublishMenuExpanded(false);
                  }}
                >
                  <ListItemIcon>{PublishClickIcons.pose}</ListItemIcon>
                  <ListItemText>Publish pose</ListItemText>
                </MenuItem>
                <MenuItem
                  selected={props.publishClickType === "point"}
                  onClick={() => {
                    props.onChangePublishClickType("point");
                    setPublishMenuExpanded(false);
                  }}
                >
                  <ListItemIcon>{PublishClickIcons.point}</ListItemIcon>
                  <ListItemText>Publish point</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Paper>
      </div>
      {clickedObjects.length > 1 && !selectedObject && (
        <InteractionContextMenu
          onClose={() => setSelectedRenderables([])}
          clickedPosition={clickedPosition}
          clickedObjects={clickedObjects}
          selectObject={(selection) => {
            if (selection) {
              const renderable = (
                selection.object as unknown as { interactionData: { renderable: Renderable } }
              ).interactionData.renderable;
              const instanceIndex = selection.instanceIndex;
              setSelectedRenderables([]);
              setSelectedRenderable({ renderable, instanceIndex });
            }
          }}
        />
      )}
      {stats}
      {debug}
    </React.Fragment>
  );
}

function useRendererProperty<K extends keyof Renderer>(
  renderer: Renderer | undefined,
  key: K,
  event: keyof RendererEvents,
  fallback: () => Renderer[K],
): Renderer[K] {
  const [value, setValue] = useState(() => renderer?.[key] ?? fallback());
  useEffect(() => {
    if (!renderer) {
      return;
    }
    const onChange = () => setValue(renderer[key]);
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
export function ThreeDeeRender({ context }: { context: PanelExtensionContext }): JSX.Element {
  const { initialState, saveState } = context;

  // Load and save the persisted panel configuration
  const [config, setConfig] = useState<RendererConfig>(() => {
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

    return {
      cameraState,
      followMode: partialConfig?.followMode ?? "follow-pose",
      followTf: partialConfig?.followTf,
      scene: partialConfig?.scene ?? {},
      transforms,
      topics: partialConfig?.topics ?? {},
      layers: partialConfig?.layers ?? {},
      publish,
    };
  });
  const configRef = useLatest(config);
  const { cameraState } = config;
  const backgroundColor = config.scene.backgroundColor;

  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);
  const [renderer, setRenderer] = useState<Renderer | undefined>(undefined);
  useEffect(
    () => setRenderer(canvas ? new Renderer(canvas, configRef.current) : undefined),
    [canvas, configRef, config.scene.transforms?.enablePreloading],
  );

  const [colorScheme, setColorScheme] = useState<"dark" | "light" | undefined>();
  const [topics, setTopics] = useState<ReadonlyArray<Topic> | undefined>();
  const [parameters, setParameters] = useState<ReadonlyMap<string, ParameterValue> | undefined>();
  const [variables, setVariables] = useState<ReadonlyMap<string, VariableValue> | undefined>();
  const [messages, setMessages] = useState<ReadonlyArray<MessageEvent<unknown>> | undefined>();
  const [preloadedMessages, setPreloadedMessages] = useState<
    ReadonlyArray<MessageEvent<unknown>> | undefined
  >();
  const lastPreloadedMessageTimeRef = useRef<Time>(TIME_ZERO);
  const [currentTime, setCurrentTime] = useState<bigint | undefined>();
  const [didSeek, setDidSeek] = useState<boolean>(false);

  const renderRef = useRef({ needsRender: false });
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const datatypeHandlers = useRendererProperty(
    renderer,
    "datatypeHandlers",
    "datatypeHandlersChanged",
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
        // This needs to be before `setConfig` otherwise flickering will occur during
        // non-follow mode playback
        renderer.setCameraState(newCameraState);
        setConfig((prevConfig) => ({ ...prevConfig, cameraState: newCameraState }));
      }
    };
    renderer?.addListener("cameraMove", listener);
    return () => void renderer?.removeListener("cameraMove", listener);
  }, [renderer]);

  // Build a map from topic name to datatype
  const topicsToDatatypes = useMemo(() => {
    const map = new Map<string, string>();
    if (!topics) {
      return map;
    }
    for (const topic of topics) {
      map.set(topic.name, topic.datatype);
    }
    return map;
  }, [topics]);

  // Handle user changes in the settings sidebar
  const actionHandler = useCallback(
    (action: SettingsTreeAction) =>
      // Wrapping in unstable_batchedUpdates causes React to run effects _after_ the handleAction
      // function has finished executing. This allows scene extensions that call
      // renderer.updateConfig to read out the new config value and configure their renderables
      // before the render occurs.
      ReactDOM.unstable_batchedUpdates(() => renderer?.settings.handleAction(action)),
    [renderer],
  );

  // Maintain the settings tree
  const [settingsTree, setSettingsTree] = useState<SettingsTreeNodes | undefined>(undefined);
  const updateSettingsTree = useCallback(
    (curRenderer: Renderer) => setSettingsTree(curRenderer.settings.tree()),
    [],
  );
  useRendererEvent("settingsTreeChange", updateSettingsTree, renderer);

  // Save the panel configuration when it changes
  const updateConfig = useCallback((curRenderer: Renderer) => setConfig(curRenderer.config), []);
  useRendererEvent("configChange", updateConfig, renderer);

  // Write to a global variable when the current selection changes
  const updateSelectedRenderable = useCallback(
    (selection: PickedRenderable | undefined) => {
      const id = (selection?.renderable.details() as { id?: number | string } | undefined)?.id;
      context.setVariable(SELECTED_ID_VARIABLE, id ?? ReactNull);
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
    (newConfig: RendererConfig) => saveState(newConfig),
    1000,
    { leading: false, trailing: true, maxWait: 1000 },
  );
  useEffect(() => throttledSave(config), [config, throttledSave]);

  // Dispose of the renderer (and associated GPU resources) on teardown
  useCleanup(() => renderer?.dispose());

  // Establish a connection to the message pipeline with context.watch and context.onRender
  useLayoutEffect(() => {
    context.onRender = (renderState: RenderState, done) => {
      ReactDOM.unstable_batchedUpdates(() => {
        if (renderState.currentTime) {
          setCurrentTime(toNanoSec(renderState.currentTime));
        }

        // Check if didSeek is set to true to reset the preloadedMessageTime and
        // trigger a state flush in Renderer
        if (renderState.didSeek === true) {
          lastPreloadedMessageTimeRef.current = TIME_ZERO;
          setDidSeek(true);
        }

        // Set the done callback into a state variable to trigger a re-render
        setRenderDone(() => done);

        // Keep UI elements and the renderer aware of the current color scheme
        setColorScheme(renderState.colorScheme);

        // We may have new topics - since we are also watching for messages in
        // the current frame, topics may not have changed
        setTopics(renderState.topics);

        // Watch for any changes in the map of observed parameters
        setParameters(renderState.parameters);

        // Watch for any changes in the map of global variables
        setVariables(renderState.variables);

        // currentFrame has messages on subscribed topics since the last render call
        deepParseMessageEvents(renderState.currentFrame);
        setMessages(renderState.currentFrame);

        // allFrames has messages on preloaded topics across all frames (as they are loaded)
        deepParseMessageEvents(renderState.allFrames);
        setPreloadedMessages(renderState.allFrames);
      });
    };

    context.watch("allFrames");
    context.watch("colorScheme");
    context.watch("currentFrame");
    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("parameters");
    context.watch("variables");
    context.watch("topics");
  }, [context]);

  // Build a list of topics to subscribe to
  const [topicsToSubscribe, setTopicsToSubscribe] = useState<SubscriptionWithOptions[] | undefined>(
    undefined,
  );
  useEffect(() => {
    const subscriptions = new Map<string, SubscriptionWithOptions>();
    if (!topics) {
      setTopicsToSubscribe(undefined);
      return;
    }

    const updateSubscriptions = (topic: string, rendererSubscription: RendererSubscription) => {
      let topicSubscription = subscriptions.get(topic);
      if (!topicSubscription) {
        topicSubscription = {
          topic,
          forced: rendererSubscription.forced ?? false,
          preload: rendererSubscription.preload ?? false,
        };
        subscriptions.set(topic, topicSubscription);
      }
      topicSubscription.preload ||= rendererSubscription.preload ?? false;
      topicSubscription.forced ||= rendererSubscription.forced ?? false;
    };

    for (const topic of topics) {
      for (const rendererSubscription of topicHandlers.get(topic.name) ?? []) {
        updateSubscriptions(topic.name, rendererSubscription);
      }
      for (const rendererSubscription of datatypeHandlers.get(topic.datatype) ?? []) {
        updateSubscriptions(topic.name, rendererSubscription);
      }
    }

    const newTopics = [...subscriptions.values()]
      // Only subscribe if the subscription is forced or topic visibility has been toggled on
      .filter((a) => a.forced || config.topics[a.topic]?.visible === true)
      // Sort the list to make comparisons stable
      .sort((a, b) => a.topic.localeCompare(b.topic));
    setTopicsToSubscribe((prev) => (areSubscriptionsEqual(prev, newTopics) ? prev : newTopics));
  }, [topics, config.topics, datatypeHandlers, topicHandlers]);

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
  }, [variables, renderer, context]);

  // Keep the renderer currentTime up to date
  useEffect(() => {
    if (renderer && currentTime != undefined) {
      renderer.currentTime = currentTime;
      renderRef.current.needsRender = true;
    }
  }, [currentTime, renderer]);

  // Flush the renderer's state when the seek count changes
  useEffect(() => {
    if (renderer && didSeek) {
      renderer.clear();
      setDidSeek(false);
    }
  }, [renderer, didSeek]);

  // Keep the renderer colorScheme and backgroundColor up to date
  useEffect(() => {
    if (colorScheme && renderer) {
      renderer.setColorScheme(colorScheme, backgroundColor);
      renderRef.current.needsRender = true;
    }
  }, [backgroundColor, colorScheme, renderer]);

  // Handle preloaded messages and render a frame if new messages are available
  useEffect(() => {
    if (!renderer || !preloadedMessages) {
      return;
    }

    for (const message of preloadedMessages) {
      // Skip preloaded messages before the last receiveTime we've previously processed
      if (isLessThan(message.receiveTime, lastPreloadedMessageTimeRef.current)) {
        continue;
      }

      const datatype = topicsToDatatypes.get(message.topic);
      if (!datatype) {
        continue;
      }

      renderer.addMessageEvent(message, datatype);
    }

    const lastMessage = preloadedMessages[preloadedMessages.length - 1];
    if (lastMessage) {
      lastPreloadedMessageTimeRef.current = lastMessage.receiveTime;
    }

    renderRef.current.needsRender = true;
  }, [preloadedMessages, renderer, topicsToDatatypes]);

  // Handle messages and render a frame if new messages are available
  useEffect(() => {
    if (!renderer || !messages) {
      return;
    }

    for (const message of messages) {
      const datatype = topicsToDatatypes.get(message.topic);
      if (!datatype) {
        continue;
      }

      renderer.addMessageEvent(message, datatype);
    }

    renderRef.current.needsRender = true;
  }, [messages, renderer, topicsToDatatypes]);

  // Update the renderer when the camera moves
  useEffect(() => {
    if (!isEqual(cameraState, renderer?.getCameraState())) {
      renderer?.setCameraState(cameraState);
      renderRef.current.needsRender = true;
    }
  }, [cameraState, renderer]);

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
      const frameId = renderer?.fixedFrameId;
      if (frameId == undefined) {
        log.warn("Unable to publish, fixedFrameId is not set");
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
    renderer?.fixedFrameId,
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
    setConfig((prevConfig) => ({
      ...prevConfig,
      cameraState: { ...prevConfig.cameraState, perspective: !prevConfig.cameraState.perspective },
    }));
    // Wait for the setConfig to propagate to the renderer before updating the settings tree
    setTimeout(() => renderer?.updateCoreSettings(), 0);
  }, [renderer]);

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
          />
        </RendererContext.Provider>
      </div>
    </ThemeProvider>
  );
}

function deepParseMessageEvents(
  messageEvents: ReadonlyArray<MessageEvent<unknown>> | undefined,
): void {
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

function areSubscriptionsEqual(
  a: SubscriptionWithOptions[] | undefined,
  b: SubscriptionWithOptions[],
): boolean {
  if (a == undefined || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const aI = a[i]!;
    const bI = b[i]!;
    if (aI.topic !== bI.topic || aI.preload !== bI.preload || aI.forced !== bI.forced) {
      return false;
    }
  }
  return true;
}
