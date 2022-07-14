// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RulerIcon from "@mdi/svg/svg/ruler.svg";
import { IconButton, Paper } from "@mui/material";
import { isEqual, cloneDeep, merge } from "lodash";
import React, { useCallback, useLayoutEffect, useEffect, useState, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { useResizeDetector } from "react-resize-detector";
import { DeepPartial } from "ts-essentials";
import { useDebouncedCallback } from "use-debounce";

import Logger from "@foxglove/log";
import {
  CameraListener,
  CameraState,
  CameraStore,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/regl-worldview";
import { toNanoSec } from "@foxglove/rostime";
import {
  LayoutActions,
  MessageEvent,
  PanelExtensionContext,
  RenderState,
  SettingsTreeAction,
  SettingsTreeNodes,
  Topic,
} from "@foxglove/studio";
import useCleanup from "@foxglove/studio-base/hooks/useCleanup";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import { DebugGui } from "./DebugGui";
import Interactions, {
  InteractionContextMenu,
  OBJECT_TAB_TYPE,
  SelectionObject,
  TabType,
} from "./Interactions";
import type { Renderable } from "./Renderable";
import { MessageHandler, Renderer, RendererConfig } from "./Renderer";
import { RendererContext, useRenderer, useRendererEvent } from "./RendererContext";
import { Stats } from "./Stats";
import { FRAME_TRANSFORM_DATATYPES } from "./foxglove";
import type { MarkerUserData } from "./renderables/markers/RenderableMarker";
import { TF_DATATYPES, TRANSFORM_STAMPED_DATATYPES } from "./ros";

const log = Logger.getLogger(__filename);

const SHOW_DEBUG: true | false = false;
const PANEL_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  position: "relative",
};

/**
 * Provides DOM overlay elements on top of the 3D scene (e.g. stats, debug GUI).
 */
function RendererOverlay(props: {
  addPanel: LayoutActions["addPanel"];
  enableStats: boolean;
  measureActive: boolean;
  measureDistance?: number;
  onClickMeasure: () => void;
}): JSX.Element {
  const [selectedRenderable, setSelectedRenderable] = useState<Renderable | undefined>(undefined);
  const [interactionsTabType, setInteractionsTabType] = useState<TabType | undefined>(undefined);
  const renderer = useRenderer();

  // Toggle object selection mode on/off in the renderer
  useEffect(() => {
    if (renderer) {
      renderer.setPickingEnabled(interactionsTabType != undefined);
    }
  }, [interactionsTabType, renderer]);

  useRendererEvent("renderableSelected", (renderable) => {
    setSelectedRenderable(renderable);
    if (renderable) {
      setInteractionsTabType(OBJECT_TAB_TYPE);
    }
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

  const selectedObject = useMemo<SelectionObject | undefined>(() => {
    if (!selectedRenderable) {
      return undefined;
    }

    // Retrieve the original message for Markers. This needs to be rethought for
    // other renderables that are generated from received messages
    const maybeMarkerUserData = selectedRenderable.userData as Partial<MarkerUserData>;
    const topic = maybeMarkerUserData.topic ?? selectedRenderable.name;
    const originalMessage = selectedRenderable.details();

    return {
      object: {
        pose: selectedRenderable.userData.pose,
        interactionData: {
          topic,
          highlighted: true,
          originalMessage,
        },
      },
      instanceIndex: undefined,
    };
  }, [selectedRenderable]);

  const clickedObjects = useMemo<SelectionObject[]>(() => {
    return [];
  }, []);

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
        }}
      >
        <Interactions
          addPanel={props.addPanel}
          selectedObject={selectedObject}
          interactionsTabType={interactionsTabType}
          setInteractionsTabType={setInteractionsTabType}
        />
        <Paper square={false} elevation={4}>
          <IconButton
            data-test="measure-button"
            color={props.measureActive ? "info" : "inherit"}
            title={props.measureActive ? "Cancel measuring" : "Measure distance"}
            onClick={props.onClickMeasure}
          >
            <RulerIcon style={{ width: 16, height: 16 }} />
          </IconButton>
        </Paper>
        <div>{props.measureDistance?.toFixed(2)}</div>
      </div>
      {clickedObjects.length > 1 && !selectedObject && (
        <InteractionContextMenu
          clickedPosition={{ clientX: 0, clientY: 0 }}
          clickedObjects={[]}
          selectObject={() => {}}
        />
      )}
      {stats}
      {debug}
    </React.Fragment>
  );
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

    return {
      cameraState,
      followTf: partialConfig?.followTf,
      scene: partialConfig?.scene ?? {},
      transforms: partialConfig?.transforms ?? {},
      topics: partialConfig?.topics ?? {},
      layers: partialConfig?.layers ?? {},
    };
  });
  const configRef = useRef(config);
  const { cameraState } = config;
  const backgroundColor = config.scene.backgroundColor;

  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);
  const [renderer, setRenderer] = useState<Renderer | ReactNull>(ReactNull);
  useEffect(
    () => setRenderer(canvas ? new Renderer(canvas, configRef.current) : ReactNull),
    [canvas],
  );

  const [colorScheme, setColorScheme] = useState<"dark" | "light" | undefined>();
  const [topics, setTopics] = useState<ReadonlyArray<Topic> | undefined>();
  const [parameters, setParameters] = useState<ReadonlyMap<string, unknown> | undefined>();
  const [messages, setMessages] = useState<ReadonlyArray<MessageEvent<unknown>> | undefined>();
  const [currentTime, setCurrentTime] = useState<bigint | undefined>();
  const [didSeek, setDidSeek] = useState<boolean>(false);

  const renderRef = useRef({ needsRender: false });
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const datatypeHandlers = useMemo(
    () => renderer?.datatypeHandlers ?? new Map<string, MessageHandler[]>(),
    [renderer],
  );

  const topicHandlers = useMemo(
    () => renderer?.topicHandlers ?? new Map<string, MessageHandler[]>(),
    [renderer],
  );

  // Config cameraState
  const setCameraState = useCallback((state: CameraState) => {
    setConfig((prevConfig) => ({ ...prevConfig, cameraState: state }));
  }, []);
  const [cameraStore] = useState(() => new CameraStore(setCameraState, cameraState));

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
    (action: SettingsTreeAction) => renderer?.settings.handleAction(action),
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

  // Rebuild the settings sidebar tree as needed
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler,
      enableFilter: true,
      nodes: settingsTree ?? {},
    });
  }, [actionHandler, context, settingsTree]);

  // Update the renderer's reference to `config` when it changes
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

        // Increment the seek count if didSeek is set to true, to trigger a
        // state flush in Renderer
        if (renderState.didSeek === true) {
          setDidSeek(true);
        }

        // Set the done callback into a state variable to trigger a re-render
        setRenderDone(done);

        // Keep UI elements and the renderer aware of the current color scheme
        setColorScheme(renderState.colorScheme);

        // We may have new topics - since we are also watching for messages in
        // the current frame, topics may not have changed
        setTopics(renderState.topics);

        // Watch for any changes in the map of observed parameters
        setParameters(renderState.parameters);

        // currentFrame has messages on subscribed topics since the last render call
        if (renderState.currentFrame) {
          // Fully parse lazy messages
          for (const messageEvent of renderState.currentFrame) {
            const maybeLazy = messageEvent.message as { toJSON?: () => unknown };
            if ("toJSON" in maybeLazy) {
              (messageEvent as { message: unknown }).message = maybeLazy.toJSON!();
            }
          }
        }
        setMessages(renderState.currentFrame);
      });
    };

    context.watch("colorScheme");
    context.watch("currentFrame");
    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("parameters");
    context.watch("topics");
  }, [context]);

  // Build a list of topics to subscribe to
  const [topicsToSubscribe, setTopicsToSubscribe] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    const subscriptions = new Set<string>();
    if (!topics) {
      setTopicsToSubscribe(undefined);
      return;
    }

    for (const topic of topics) {
      if (
        FRAME_TRANSFORM_DATATYPES.has(topic.datatype) ||
        TF_DATATYPES.has(topic.datatype) ||
        TRANSFORM_STAMPED_DATATYPES.has(topic.datatype)
      ) {
        // Subscribe to all transform topics
        subscriptions.add(topic.name);
      } else if (config.topics[topic.name]?.visible === true) {
        // Subscribe if the topic is visible
        subscriptions.add(topic.name);
      } else if (
        // prettier-ignore
        (topicHandlers.get(topic.name)?.length ?? 0) +
        (datatypeHandlers.get(topic.datatype)?.length ?? 0) > 1
      ) {
        // Subscribe if there are multiple handlers registered for this topic
        subscriptions.add(topic.name);
      }
    }

    const newTopics = Array.from(subscriptions.keys()).sort();
    setTopicsToSubscribe((prevTopics) => (isEqual(prevTopics, newTopics) ? prevTopics : newTopics));
  }, [topics, config.topics, datatypeHandlers, topicHandlers]);

  // Notify the extension context when our subscription list changes
  useEffect(() => {
    if (!topicsToSubscribe) {
      return;
    }
    log.debug(`Subscribing to [${topicsToSubscribe.join(", ")}]`);
    context.subscribe(topicsToSubscribe.map((topic) => ({ topic, preload: false })));
  }, [context, topicsToSubscribe]);

  // Keep the renderer parameters up to date
  useEffect(() => {
    if (renderer) {
      renderer.setParameters(parameters);
    }
  }, [parameters, renderer]);

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
    cameraStore.setCameraState(cameraState);
    renderer?.setCameraState(cameraState);
    renderRef.current.needsRender = true;
  }, [cameraState, cameraStore, renderer]);

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

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    ref: resizeRef,
    width,
    height,
  } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  // Create a useCallback wrapper for adding a new panel to the layout, used to open the
  // "Raw Messages" panel from the object inspector
  const addPanel = useCallback(
    (params: Parameters<LayoutActions["addPanel"]>[0]) => context.layout.addPanel(params),
    [context.layout],
  );

  const [measureActive, setMeasureActive] = useState(false);
  const [measureDistance, setMeasureDistance] = useState<number | undefined>();
  useEffect(() => {
    const onStart = () => setMeasureActive(true);
    const onChange = () => setMeasureDistance(renderer?.measurementTool.distance);
    const onEnd = () => setMeasureActive(false);
    renderer?.measurementTool.addEventListener("foxglove.measure-start", onStart);
    renderer?.measurementTool.addEventListener("foxglove.measure-change", onChange);
    renderer?.measurementTool.addEventListener("foxglove.measure-end", onEnd);
    return () => {
      renderer?.measurementTool.removeEventListener("foxglove.measure-start", onStart);
      renderer?.measurementTool.removeEventListener("foxglove.measure-change", onChange);
      renderer?.measurementTool.removeEventListener("foxglove.measure-end", onEnd);
    };
  }, [renderer?.measurementTool]);

  const onClickMeasure = useCallback(() => {
    if (measureActive) {
      renderer?.measurementTool.stopMeasuring();
    } else {
      renderer?.measurementTool.startMeasuring();
    }
  }, [measureActive, renderer?.measurementTool]);

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <div style={PANEL_STYLE} ref={resizeRef}>
        <CameraListener cameraStore={cameraStore} shiftKeys={true}>
          <div
            // This element forces CameraListener to fill its container. We need this instead of just
            // the canvas since three.js manages the size of the canvas element and we use
            // position:absolute
            style={{ width, height }}
          />
          <canvas
            ref={setCanvas}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              ...(measureActive && { cursor: "crosshair" }),
            }}
          />
        </CameraListener>
        <RendererContext.Provider value={renderer}>
          <RendererOverlay
            addPanel={addPanel}
            enableStats={config.scene.enableStats ?? false}
            measureActive={measureActive}
            measureDistance={measureDistance}
            onClickMeasure={onClickMeasure}
          />
        </RendererContext.Provider>
      </div>
    </ThemeProvider>
  );
}
