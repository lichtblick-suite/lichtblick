// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import css from "@emotion/css";
import produce from "immer";
import { cloneDeep, merge, set } from "lodash";
import React, { useCallback, useRef, useLayoutEffect, useEffect, useState, useMemo } from "react";
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
import { PanelExtensionContext, RenderState, Topic, MessageEvent } from "@foxglove/studio";
import { SettingsTreeAction } from "@foxglove/studio-base/components/SettingsTreeEditor/types";
import useCleanup from "@foxglove/studio-base/hooks/useCleanup";
import { normalizeMarker } from "@foxglove/studio-base/panels/ThreeDeeRender/normalizeMessages";

import { DebugGui } from "./DebugGui";
import { setOverlayPosition } from "./LabelOverlay";
import { Renderer } from "./Renderer";
import { RendererContext, useRenderer, useRendererEvent } from "./RendererContext";
import { Stats } from "./Stats";
import {
  TRANSFORM_STAMPED_DATATYPES,
  TF_DATATYPES,
  MARKER_DATATYPES,
  MARKER_ARRAY_DATATYPES,
  TF,
  Marker,
  PointCloud2,
  POINTCLOUD_DATATYPES,
  OccupancyGrid,
  OCCUPANCY_GRID_DATATYPES,
} from "./ros";
import { buildSettingsTree, ThreeDeeRenderConfig } from "./settings";

const SHOW_DEBUG: true | false = false;

const SUPPORTED_DATATYPES = new Set<string>();
mergeSetInto(SUPPORTED_DATATYPES, TRANSFORM_STAMPED_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, TF_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, MARKER_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, MARKER_ARRAY_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, OCCUPANCY_GRID_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, POINTCLOUD_DATATYPES);

const log = Logger.getLogger(__filename);

const labelLight = css`
  position: relative;
  color: #27272b;
  background-color: #ececec99;
`;

const labelDark = css`
  position: relative;
  color: #e1e1e4;
  background-color: #181818cc;
`;

function RendererOverlay(props: {
  colorScheme: "dark" | "light" | undefined;
  enableStats: boolean;
}): JSX.Element {
  const colorScheme = props.colorScheme;
  const [_selectedRenderable, setSelectedRenderable] = useState<THREE.Object3D | undefined>(
    undefined,
  );
  const [labelsMap, setLabelsMap] = useState(new Map<string, Marker>());
  const labelsRef = useRef<HTMLDivElement>(ReactNull);
  const renderer = useRenderer();

  useRendererEvent("renderableSelected", (renderable) => setSelectedRenderable(renderable));

  useRendererEvent("showLabel", (labelId: string, labelMarker: Marker) => {
    const curLabelMarker = labelsMap.get(labelId);
    if (curLabelMarker === labelMarker) {
      return;
    }
    setLabelsMap(new Map(labelsMap.set(labelId, labelMarker)));
  });

  useRendererEvent("removeLabel", (labelId: string) => {
    if (!labelsMap.has(labelId)) {
      return;
    }
    labelsMap.delete(labelId);
    setLabelsMap(new Map(labelsMap));
  });

  useRendererEvent("endFrame", (_, curRenderer) => {
    if (labelsRef.current) {
      for (const labelId of labelsMap.keys()) {
        const labelEl = document.getElementById(`label-${labelId}`);
        if (labelEl) {
          const worldPosition = curRenderer.markerWorldPosition(labelId);
          if (worldPosition) {
            setOverlayPosition(
              labelEl.style,
              worldPosition,
              curRenderer.input.canvasSize,
              curRenderer.camera,
            );
          }
        }
      }
    }
  });

  // Create a div for each label
  const labelElements = useMemo(() => {
    const newLabelElements: JSX.Element[] = [];
    if (!renderer) {
      return newLabelElements;
    }
    const style = { left: "", top: "", transform: "" };
    const labelCss = colorScheme === "dark" ? labelDark : labelLight;
    for (const [labelId, labelMarker] of labelsMap) {
      const worldPosition = renderer.markerWorldPosition(labelId);
      if (worldPosition) {
        setOverlayPosition(style, worldPosition, renderer.input.canvasSize, renderer.camera);
        newLabelElements.push(
          <div id={`label-${labelId}`} key={labelId} className={labelCss.name} style={style}>
            {labelMarker.text}
          </div>,
        );
      }
    }
    return newLabelElements;
  }, [renderer, labelsMap, colorScheme]);

  const labels = (
    <div id="labels" ref={labelsRef} style={{ position: "absolute", top: 0 }}>
      {labelElements}
    </div>
  );

  const stats = props.enableStats ? (
    <div id="stats" style={{ position: "absolute", top: 0 }}>
      <Stats />
    </div>
  ) : undefined;

  const debug = SHOW_DEBUG ? (
    <div id="debug" style={{ position: "absolute", top: 60 }}>
      <DebugGui />
    </div>
  ) : undefined;

  return (
    <React.Fragment>
      {labels}
      {stats}
      {debug}
    </React.Fragment>
  );
}

export function ThreeDeeRender({ context }: { context: PanelExtensionContext }): JSX.Element {
  const { initialState, saveState } = context;

  // Load and save the persisted panel configuration
  const [config, setConfig] = useState<ThreeDeeRenderConfig>(() => {
    const partialConfig = initialState as DeepPartial<ThreeDeeRenderConfig> | undefined;
    const cameraState: CameraState = merge(
      cloneDeep(DEFAULT_CAMERA_STATE),
      partialConfig?.cameraState,
    );

    return {
      cameraState,
      enableStats: partialConfig?.enableStats ?? true,
      followTf: partialConfig?.followTf,
    };
  });
  const { cameraState, followTf } = config;

  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);
  const [renderer, setRenderer] = useState<Renderer | ReactNull>(ReactNull);
  useEffect(() => setRenderer(canvas ? new Renderer(canvas) : ReactNull), [canvas]);

  const [colorScheme, setColorScheme] = useState<"dark" | "light" | undefined>();
  const [topics, setTopics] = useState<ReadonlyArray<Topic> | undefined>();
  const [messages, setMessages] = useState<ReadonlyArray<MessageEvent<unknown>> | undefined>();
  const [currentTime, setCurrentTime] = useState<bigint | undefined>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  // Config cameraState
  const setCameraState = useCallback((state: CameraState) => {
    setConfig((prevConfig) => ({ ...prevConfig, cameraState: state }));
  }, []);
  const [cameraStore] = useState(() => new CameraStore(setCameraState, cameraState));

  const actionHandler = useCallback((action: SettingsTreeAction) => {
    setConfig((oldConfig) =>
      produce(oldConfig, (draft) => {
        set(draft, action.payload.path, action.payload.value);
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
    (context as unknown as any).__updatePanelSettingsTree({
      actionHandler,
      settings: buildSettingsTree(config, topics ?? []),
    });
  }, [actionHandler, config, context, topics]);

  // Config followTf
  useEffect(() => {
    if (renderer && followTf != undefined) {
      renderer.renderFrameId = followTf;
    }
  }, [followTf, renderer]);

  // Save panel settings whenever they change
  const throttledSave = useDebouncedCallback(
    (newConfig: ThreeDeeRenderConfig) => saveState(newConfig),
    1000,
  );
  useEffect(() => throttledSave(config), [config, throttledSave]);

  // Dispose of the renderer (and associated GPU resources) on teardown
  useCleanup(() => renderer?.dispose());

  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {
    // The render handler is run by the broader studio system during playback when your panel
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // You can only setup one render handler - usually early on in setting up your panel.
    //
    // Without a render handler your panel will never receive updates.
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    context.onRender = (renderState: RenderState, done) => {
      if (renderState.currentTime) {
        setCurrentTime(toNanoSec(renderState.currentTime));
      }

      // render functions receive a _done_ callback. You MUST call this callback to indicate your panel has finished rendering.
      // Your panel will not receive another render callback until _done_ is called from a prior render. If your panel is not done
      // rendering before the next render call, studio shows a notification to the user that your panel is delayed.
      //
      // Set the done callback into a state variable to trigger a re-render
      setRenderDone(done);

      // Keep UI elements and the renderer aware of the current color scheme
      setColorScheme(renderState.colorScheme);

      // We may have new topics - since we are also watching for messages in the current frame, topics may not have changed
      // It is up to you to determine the correct action when state has not changed
      setTopics(renderState.topics);

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
    };

    context.watch("currentTime");
    context.watch("colorScheme");
    context.watch("topics");
    context.watch("currentFrame");
  }, [context]);

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

  // Build a list of topics to subscribe to
  const topicsToSubscribe = useMemo(() => {
    const subscriptionList: string[] = [];
    if (!topics) {
      return undefined;
    }

    for (const topic of topics) {
      // Subscribe to all transform topics
      if (TF_DATATYPES.has(topic.datatype) || TRANSFORM_STAMPED_DATATYPES.has(topic.datatype)) {
        subscriptionList.push(topic.name);
      }

      // TODO: Allow disabling of subscriptions to non-TF topics
      if (SUPPORTED_DATATYPES.has(topic.datatype)) {
        subscriptionList.push(topic.name);
      }
    }

    return subscriptionList;
  }, [topics]);

  // Notify the extension context when our subscription list changes
  useEffect(() => {
    if (!topicsToSubscribe) {
      return;
    }
    log.debug(`Subscribing to [${topicsToSubscribe.join(", ")}]`);
    context.subscribe(topicsToSubscribe);
  }, [context, topicsToSubscribe]);

  // Keep the renderer currentTime up to date
  useEffect(() => {
    if (renderer && currentTime != undefined) {
      renderer.currentTime = currentTime;
    }
  }, [currentTime, renderer]);

  useEffect(() => {
    if (colorScheme && renderer) {
      renderer.setColorScheme(colorScheme);
    }
  }, [colorScheme, renderer]);

  // Handle messages and render a frame if the camera has moved or new messages
  // are available
  useEffect(() => {
    if (!renderer) {
      return;
    }
    renderer.setCameraState(cameraState);

    if (!messages) {
      renderer.animationFrame();
      return;
    }

    for (const message of messages) {
      const datatype = topicsToDatatypes.get(message.topic);
      if (!datatype) {
        continue;
      }

      if (TF_DATATYPES.has(datatype)) {
        // tf2_msgs/TFMessage - Ingest the list of transforms into our TF tree
        const tfMessage = message.message as { transforms: TF[] };
        for (const tf of tfMessage.transforms) {
          renderer.addTransformMessage(tf);
        }
      } else if (TRANSFORM_STAMPED_DATATYPES.has(datatype)) {
        // geometry_msgs/TransformStamped - Ingest this single transform into our TF tree
        const tf = message.message as TF;
        renderer.addTransformMessage(tf);
      } else if (MARKER_ARRAY_DATATYPES.has(datatype)) {
        // visualization_msgs/MarkerArray - Ingest the list of markers
        const markerArray = message.message as { markers: Marker[] };
        for (const marker of markerArray.markers) {
          renderer.addMarkerMessage(message.topic, marker);
        }
      } else if (MARKER_DATATYPES.has(datatype)) {
        // visualization_msgs/Marker - Ingest this single marker
        const marker = normalizeMarker(message.message as DeepPartial<Marker>);
        renderer.addMarkerMessage(message.topic, marker);
      } else if (OCCUPANCY_GRID_DATATYPES.has(datatype)) {
        // nav_msgs/OccupancyGrid - Ingest this occupancy grid
        const occupancyGrid = message.message as OccupancyGrid;
        renderer.addOccupancyGridMessage(message.topic, occupancyGrid);
      } else if (POINTCLOUD_DATATYPES.has(datatype)) {
        // sensor_msgs/PointCloud2 - Ingest this point cloud
        const pointCloud = message.message as PointCloud2;
        renderer.addPointCloud2Message(message.topic, pointCloud);
      }
    }

    renderer.animationFrame();
  }, [cameraState, messages, renderer, topicsToDatatypes]);

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
  return (
    <div style={{ width: "100%", height: "100%", display: "flex" }} ref={resizeRef}>
      <CameraListener cameraStore={cameraStore} shiftKeys={true}>
        <div
          // This element forces CameraListener to fill its container. We need this instead of just
          // the canvas since three.js manages the size of the canvas element and we use position:absolute.
          style={{ width, height }}
        />
        <canvas ref={setCanvas} style={{ position: "absolute", top: 0, left: 0 }} />
      </CameraListener>
      <RendererContext.Provider value={renderer}>
        <RendererOverlay colorScheme={colorScheme} enableStats={config.enableStats} />
      </RendererContext.Provider>
    </div>
  );
}

function mergeSetInto(output: Set<string>, input: ReadonlySet<string>) {
  for (const value of input) {
    output.add(value);
  }
}
