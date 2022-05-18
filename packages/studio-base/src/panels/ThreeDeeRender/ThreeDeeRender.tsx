// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import produce from "immer";
// eslint-disable-next-line no-restricted-imports
import { cloneDeep, merge, get, set } from "lodash";
import React, { useCallback, useLayoutEffect, useEffect, useState, useMemo, useRef } from "react";
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

import { DebugGui } from "./DebugGui";
import { Renderer } from "./Renderer";
import { RendererContext, useRendererEvent } from "./RendererContext";
import { Stats } from "./Stats";
import {
  normalizeCameraInfo,
  normalizeMarker,
  normalizePoseStamped,
  normalizePoseWithCovarianceStamped,
} from "./normalizeMessages";
import {
  TRANSFORM_STAMPED_DATATYPES,
  TF_DATATYPES,
  MARKER_DATATYPES,
  MARKER_ARRAY_DATATYPES,
  TF,
  Marker,
  MarkerArray,
  PointCloud2,
  POINTCLOUD_DATATYPES,
  OccupancyGrid,
  OCCUPANCY_GRID_DATATYPES,
  POSE_STAMPED_DATATYPES,
  POSE_WITH_COVARIANCE_STAMPED_DATATYPES,
  PoseStamped,
  PoseWithCovarianceStamped,
  CameraInfo,
  CAMERA_INFO_DATATYPES,
} from "./ros";
import {
  buildSettingsTree,
  LayerType,
  SelectEntry,
  SUPPORTED_DATATYPES,
  ThreeDeeRenderConfig,
} from "./settings";

const SHOW_DEBUG: true | false = false;
const DEFAULT_FRAME_IDS = ["base_link", "odom", "map", "earth"];

const log = Logger.getLogger(__filename);

function RendererOverlay(props: { enableStats: boolean }): JSX.Element {
  const [_, setSelectedRenderable] = useState<THREE.Object3D | undefined>(undefined);

  useRendererEvent("renderableSelected", (renderable) => setSelectedRenderable(renderable));

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
      followTf: partialConfig?.followTf,
      scene: partialConfig?.scene ?? {},
      topics: partialConfig?.topics ?? {},
    };
  });
  const { cameraState, followTf: configFollowTf } = config;
  const backgroundColor = config.scene.backgroundColor;

  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);
  const [renderer, setRenderer] = useState<Renderer | ReactNull>(ReactNull);
  useEffect(() => setRenderer(canvas ? new Renderer(canvas) : ReactNull), [canvas]);

  const [colorScheme, setColorScheme] = useState<"dark" | "light" | undefined>();
  const [topics, setTopics] = useState<ReadonlyArray<Topic> | undefined>();
  const [messages, setMessages] = useState<ReadonlyArray<MessageEvent<unknown>> | undefined>();
  const [currentTime, setCurrentTime] = useState<bigint | undefined>();

  const renderRef = useRef({ needsRender: false });
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

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

  // Build a map from (renderable) topic name to LayerType enum
  const topicsToLayerTypes = useMemo(() => buildTopicsToLayerTypes(topics), [topics]);

  // Handle user changes in the settings sidebar
  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((oldConfig) => {
        const newConfig = produce(oldConfig, (draft) => {
          set(draft, action.payload.path, action.payload.value);
        });

        // If a topic setting was changed, inform the renderer about it and
        // draw a new frame
        if (renderer && action.payload.path[0] === "topics") {
          const topic = action.payload.path[1]!;
          const layerType = topicsToLayerTypes.get(topic);
          if (layerType != undefined) {
            updateTopicSettings(renderer, topic, layerType, newConfig);
            renderRef.current.needsRender = true;
          }
        }

        return newConfig;
      });
    },
    [renderer, topicsToLayerTypes],
  );

  // Handle internal changes to the settings sidebar
  useRendererEvent(
    "settingsTreeChange",
    (update) => {
      setConfig((oldConfig) => {
        const newConfig = produce(oldConfig, (draft) => {
          const entry = get(draft, update.path);
          set(draft, update.path, { ...entry });
        });

        return newConfig;
      });
    },
    renderer,
  );

  // Maintain a list of coordinate frames for the settings sidebar
  const [coordinateFrames, setCoordinateFrames] = useState<SelectEntry[]>(
    coordinateFrameList(renderer),
  );
  const [defaultFrame, setDefaultFrame] = useState<string | undefined>(undefined);
  const updateCoordinateFrames = useCallback(
    (curRenderer: Renderer) => {
      setCoordinateFrames(coordinateFrameList(curRenderer));

      // Prefer frames from [REP-105](https://www.ros.org/reps/rep-0105.html)
      for (const frameId of DEFAULT_FRAME_IDS) {
        if (curRenderer.transformTree.hasFrame(frameId)) {
          setDefaultFrame(frameId);
          return;
        }
      }

      // Choose the root frame with the most children
      const rootsToCounts = new Map<string, number>();
      for (const frame of curRenderer.transformTree.frames().values()) {
        const rootId = frame.root().id;
        rootsToCounts.set(rootId, (rootsToCounts.get(rootId) ?? 0) + 1);
      }
      const rootsArray = Array.from(rootsToCounts.entries());
      const rootId = rootsArray.sort((a, b) => b[1] - a[1])[0]?.[0];
      if (rootId != undefined) {
        setDefaultFrame(rootId);
      }
    },
    [setDefaultFrame],
  );
  useEffect(() => {
    renderer?.addListener("transformTreeUpdated", updateCoordinateFrames);
    return () => void renderer?.removeListener("transformTreeUpdated", updateCoordinateFrames);
  }, [renderer, updateCoordinateFrames]);

  // Set the rendering frame (aka followTf) based on the configured frame, falling back to a
  // heuristically chosen best frame for the current scene (defaultFrame)
  const followTf = useMemo(
    () =>
      configFollowTf != undefined && renderer && renderer.transformTree.hasFrame(configFollowTf)
        ? configFollowTf
        : defaultFrame,
    [configFollowTf, defaultFrame, renderer],
  );

  const settingsNodeProviders = renderer?.settingsNodeProviders;

  useEffect(() => {
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
    (context as unknown as any).__updatePanelSettingsTree({
      actionHandler,
      roots: buildSettingsTree({
        config,
        coordinateFrames,
        followTf,
        topics: topics ?? [],
        topicsToLayerTypes,
        settingsNodeProviders: settingsNodeProviders ?? new Map(),
      }),
    });
  }, [
    actionHandler,
    config,
    context,
    coordinateFrames,
    followTf,
    settingsNodeProviders,
    topics,
    topicsToLayerTypes,
  ]);

  // Update the renderer's reference to `config` when it changes
  useEffect(() => {
    if (renderer) {
      renderer.config = config;
    }
  }, [config, renderer]);

  // Update renderer and draw a new frame when followTf changes
  useEffect(() => {
    if (renderer?.config && followTf != undefined) {
      renderer.renderFrameId = followTf;
      renderer.animationFrame();
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
      } else if (SUPPORTED_DATATYPES.has(topic.datatype)) {
        // TODO: Allow disabling of subscriptions to non-TF topics
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
        const markerArray = message.message as DeepPartial<MarkerArray>;
        for (const markerMsg of markerArray.markers ?? []) {
          const marker = normalizeMarker(markerMsg);
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
      } else if (POSE_STAMPED_DATATYPES.has(datatype)) {
        const poseMesage = normalizePoseStamped(message.message as DeepPartial<PoseStamped>);
        renderer.addPoseMessage(message.topic, poseMesage);
      } else if (POSE_WITH_COVARIANCE_STAMPED_DATATYPES.has(datatype)) {
        const poseMessage = normalizePoseWithCovarianceStamped(
          message.message as DeepPartial<PoseWithCovarianceStamped>,
        );
        renderer.addPoseMessage(message.topic, poseMessage);
      } else if (CAMERA_INFO_DATATYPES.has(datatype)) {
        const cameraInfo = normalizeCameraInfo(message.message as DeepPartial<CameraInfo>);
        renderer.addCameraInfoMessage(message.topic, cameraInfo);
      }
    }

    renderRef.current.needsRender = true;
  }, [messages, renderer, topicsToDatatypes]);

  // Update the renderer when the camera moves
  useEffect(() => {
    renderer?.setCameraState(cameraState);
    renderRef.current.needsRender = true;
  }, [cameraState, renderer]);

  // Render a new frame if requested
  if (renderer && renderRef.current.needsRender) {
    renderer.animationFrame();
    renderRef.current.needsRender = false;
  }

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
    <div
      style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}
      ref={resizeRef}
    >
      <CameraListener cameraStore={cameraStore} shiftKeys={true}>
        <div
          // This element forces CameraListener to fill its container. We need this instead of just
          // the canvas since three.js manages the size of the canvas element and we use position:absolute.
          style={{ width, height }}
        />
        <canvas ref={setCanvas} style={{ position: "absolute", top: 0, left: 0 }} />
      </CameraListener>
      <RendererContext.Provider value={renderer}>
        <RendererOverlay enableStats={config.scene.enableStats ?? true} />
      </RendererContext.Provider>
    </div>
  );
}

function coordinateFrameList(renderer: Renderer | ReactNull | undefined): SelectEntry[] {
  if (!renderer) {
    return [];
  }

  type FrameEntry = { id: string; children: FrameEntry[] };

  const frames = Array.from(renderer.transformTree.frames().values());
  const frameMap = new Map<string, FrameEntry>(
    frames.map((frame) => [frame.id, { id: frame.id, children: [] }]),
  );

  // Create a hierarchy of coordinate frames
  const rootFrames: FrameEntry[] = [];
  for (const frame of frames) {
    const frameEntry = frameMap.get(frame.id)!;
    const parentId = frame.parent()?.id;
    if (parentId == undefined) {
      rootFrames.push(frameEntry);
    } else {
      const parent = frameMap.get(parentId);
      if (parent == undefined) {
        continue;
      }
      parent.children.push(frameEntry);
    }
  }

  // Convert the `rootFrames` hierarchy into a flat list of coordinate frames with depth
  const output: SelectEntry[] = [];

  function addFrame(frame: FrameEntry, depth: number) {
    const frameName =
      frame.id === "" || frame.id.startsWith(" ") || frame.id.endsWith(" ")
        ? `"${frame.id}"`
        : frame.id;
    output.push({
      value: frame.id,
      label: `${"\u00A0\u00A0".repeat(depth)}${frameName}`,
    });
    frame.children.sort((a, b) => a.id.localeCompare(b.id));
    for (const child of frame.children) {
      addFrame(child, depth + 1);
    }
  }

  rootFrames.sort((a, b) => a.id.localeCompare(b.id));
  for (const entry of rootFrames) {
    addFrame(entry, 0);
  }

  return output;
}

function buildTopicsToLayerTypes(topics: ReadonlyArray<Topic> | undefined): Map<string, LayerType> {
  const map = new Map<string, LayerType>();
  if (!topics) {
    return map;
  }
  for (const topic of topics) {
    const datatype = topic.datatype;
    if (SUPPORTED_DATATYPES.has(datatype)) {
      if (TF_DATATYPES.has(datatype) || TRANSFORM_STAMPED_DATATYPES.has(datatype)) {
        map.set(topic.name, LayerType.Transform);
      } else if (MARKER_DATATYPES.has(datatype) || MARKER_ARRAY_DATATYPES.has(datatype)) {
        map.set(topic.name, LayerType.Marker);
      } else if (OCCUPANCY_GRID_DATATYPES.has(datatype)) {
        map.set(topic.name, LayerType.OccupancyGrid);
      } else if (POINTCLOUD_DATATYPES.has(datatype)) {
        map.set(topic.name, LayerType.PointCloud);
      } else if (
        POSE_STAMPED_DATATYPES.has(datatype) ||
        POSE_WITH_COVARIANCE_STAMPED_DATATYPES.has(datatype)
      ) {
        map.set(topic.name, LayerType.Pose);
      } else if (CAMERA_INFO_DATATYPES.has(datatype)) {
        map.set(topic.name, LayerType.CameraInfo);
      }
    }
  }
  return map;
}

function updateTopicSettings(
  renderer: Renderer,
  topic: string,
  layerType: LayerType,
  config: ThreeDeeRenderConfig,
) {
  const topicConfig = config.topics[topic];
  if (!topicConfig) {
    return;
  }

  switch (layerType) {
    case LayerType.Transform:
      throw new Error(`Attempted to update topic settings for Transform "${topic}"`);
    case LayerType.Marker:
      renderer.setMarkerSettings(topic, topicConfig);
      break;
    case LayerType.OccupancyGrid:
      renderer.setOccupancyGridSettings(topic, topicConfig);
      break;
    case LayerType.PointCloud:
      renderer.setPointCloud2Settings(topic, topicConfig);
      break;
    case LayerType.Pose:
      renderer.setPoseSettings(topic, topicConfig);
      break;
    case LayerType.CameraInfo:
      renderer.setCameraInfoSettings(topic, topicConfig);
      break;
  }
}
