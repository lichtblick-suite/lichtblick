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

import { mergeStyleSets } from "@fluentui/react";
import { groupBy } from "lodash";
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import { useDebouncedCallback } from "use-debounce";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import {
  Worldview,
  PolygonBuilder,
  DrawPolygons,
  CameraState,
  ReglClickInfo,
  MouseEventObject,
  Polygon,
} from "@foxglove/regl-worldview";
import { Time } from "@foxglove/rostime";
import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { Save3DConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz";
import DebugStats from "@foxglove/studio-base/panels/ThreeDimensionalViz/DebugStats";
import {
  POLYGON_TAB_TYPE,
  DrawingTabType,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/DrawingTools";
import MeasuringTool, {
  MeasureInfo,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/DrawingTools/MeasuringTool";
import GridBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/GridBuilder";
import {
  InteractionContextMenu,
  OBJECT_TAB_TYPE,
  TabType,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions";
import useLinkedGlobalVariables from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import LayoutToolbar from "@foxglove/studio-base/panels/ThreeDimensionalViz/LayoutToolbar";
import SceneBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
import sceneBuilderHooks from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder/defaultHooks";
import { useSearchText } from "@foxglove/studio-base/panels/ThreeDimensionalViz/SearchText";
import {
  MarkerMatcher,
  ThreeDimensionalVizContext,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import TopicSettingsModal from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/TopicSettingsModal";
import TopicTree from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/TopicTree";
import { TOPIC_DISPLAY_MODES } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import useSceneBuilderAndTransformsData from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/useSceneBuilderAndTransformsData";
import useTopicTree, {
  TopicTreeContext,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/useTopicTree";
import Transforms, {
  DEFAULT_ROOT_FRAME_IDS,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/Transforms";
import TransformsBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/TransformsBuilder";
import World from "@foxglove/studio-base/panels/ThreeDimensionalViz/World";
import {
  TF_DATATYPES,
  TRANSFORM_STAMPED_DATATYPES,
  TRANSFORM_TOPIC,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import {
  TargetPose,
  getInteractionData,
  getObject,
  getUpdatedGlobalVariablesBySelectedObject,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { ThreeDimensionalVizConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { Frame, Topic } from "@foxglove/studio-base/players/types";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import { Color, Marker } from "@foxglove/studio-base/types/Messages";
import {
  FOXGLOVE_GRID_TOPIC,
  SECOND_SOURCE_PREFIX,
} from "@foxglove/studio-base/util/globalConstants";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";
import { joinTopics } from "@foxglove/studio-base/util/topicUtils";

type EventName = "onDoubleClick" | "onMouseMove" | "onMouseDown" | "onMouseUp";
export type ClickedPosition = { clientX: number; clientY: number };

export type LayoutToolbarSharedProps = {
  cameraState: CameraState;
  followOrientation: boolean;
  followTf?: string | false;
  onAlignXYAxis: () => void;
  onCameraStateChange: (arg0: CameraState) => void;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  onFollowChange: (followTf?: string | false, followOrientation?: boolean) => void;
  saveConfig: Save3DConfig;
  targetPose?: TargetPose;
  transforms: Transforms;
  isPlaying?: boolean;
};

export type LayoutTopicSettingsSharedProps = {
  transforms: Transforms;
  topics: readonly Topic[];
  saveConfig: Save3DConfig;
};

type Props = LayoutToolbarSharedProps &
  LayoutTopicSettingsSharedProps & {
    children?: React.ReactNode;
    currentTime: Time;
    resetFrame: boolean;
    frame: Frame;
    helpContent: React.ReactNode | string;
    isPlaying?: boolean;
    config: ThreeDimensionalVizConfig;
    saveConfig: Save3DConfig;
    setSubscriptions: (subscriptions: string[]) => void;
    topics: readonly Topic[];
    transforms: Transforms;
  };

export type UserSelectionState = {
  // These objects are shown in the context menu
  clickedObjects: MouseEventObject[];
  // The x,y position used to position the context menu
  clickedPosition: ClickedPosition;
  // The object shown in the Interactions menu; also used to update global variables
  selectedObject?: MouseEventObject;
};

type GlobalVariableName = string;
export type ColorOverride = {
  color?: Color;
  active?: boolean;
};
export type ColorOverrideBySourceIdxByVariable = Record<GlobalVariableName, ColorOverride[]>;

const styles = mergeStyleSets({
  container: {
    display: "flex",
    flex: "1 1 auto",
    position: "relative",
    width: "100%",
    height: "100%",
  },
  world: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
});

// generally supported datatypes
const SUPPORTED_MARKER_DATATYPES_SET = new Set([
  "visualization_msgs/Marker",
  "visualization_msgs/msg/Marker",
  "visualization_msgs/MarkerArray",
  "visualization_msgs/msg/MarkerArray",
  "geometry_msgs/PoseStamped",
  "geometry_msgs/msg/PoseStamped",
  "sensor_msgs/PointCloud2",
  "sensor_msgs/msg/PointCloud2",
  "velodyne_msgs/VelodyneScan",
  "velodyne_msgs/msg/VelodyneScan",
  "sensor_msgs/LaserScan",
  "sensor_msgs/msg/LaserScan",
  "std_msgs/ColorRGBA",
  "std_msgs/msg/ColorRGBA",
  "nav_msgs/OccupancyGrid",
  "nav_msgs/msg/OccupancyGrid",
  "nav_msgs/Path",
  "nav_msgs/msg/Path",
  "geometry_msgs/PolygonStamped",
  "geometry_msgs/msg/PolygonStamped",
  ...TF_DATATYPES,
]);

function isTopicRenderable(topic: Topic): boolean {
  const datatype = topic.datatype;
  return (
    SUPPORTED_MARKER_DATATYPES_SET.has(datatype) ||
    datatype.endsWith("/Color") ||
    datatype.endsWith("/ColorRGBA")
  );
}

export default function Layout({
  cameraState,
  children,
  currentTime,
  followOrientation,
  followTf,
  resetFrame,
  frame,
  helpContent,
  isPlaying = false,
  onAlignXYAxis,
  onCameraStateChange,
  onFollowChange,
  saveConfig,
  topics,
  targetPose,
  transforms,
  setSubscriptions,
  config: {
    autoTextBackgroundColor = false,
    checkedKeys,
    expandedKeys,
    flattenMarkers = false,
    modifiedNamespaceTopics,
    pinTopics,
    diffModeEnabled,
    showCrosshair,
    autoSyncCameraState = false,
    topicDisplayMode = TOPIC_DISPLAY_MODES.SHOW_ALL.value,
    settingsByKey,
    colorOverrideBySourceIdxByVariable,
    disableAutoOpenClickedObject = false,
  },
}: Props): React.ReactElement {
  const [filterText, setFilterText] = useState(""); // Topic tree text for filtering to see certain topics.
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const { linkedGlobalVariables } = useLinkedGlobalVariables();
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const [debug, setDebug] = useState(false);
  const [showTopicTree, setShowTopicTree] = useState<boolean>(false);
  const [polygonBuilder, setPolygonBuilder] = useState(() => new PolygonBuilder());
  const [measureInfo, setMeasureInfo] = useState<MeasureInfo>({
    measureState: "idle",
    measurePoints: { start: undefined, end: undefined },
  });
  const [currentEditingTopic, setCurrentEditingTopic] = useState<Topic | undefined>(undefined);

  const searchTextProps = useSearchText();
  const {
    searchTextOpen,
    searchText,
    setSearchTextMatches,
    searchTextMatches,
    selectedMatchIndex,
  } = searchTextProps;
  // used for updating DrawPolygon during mouse move and scenebuilder namespace change.
  const [_, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const measuringElRef = useRef<MeasuringTool>(ReactNull);
  const [drawingTabType, setDrawingTabType] = useState<DrawingTabType | undefined>(undefined);
  const [interactionsTabType, setInteractionsTabType] = useState<TabType | undefined>(undefined);

  const [selectionState, setSelectionState] = useState<UserSelectionState>({
    clickedObjects: [],
    clickedPosition: { clientX: 0, clientY: 0 },
    selectedObject: undefined,
  });
  const { selectedObject, clickedObjects, clickedPosition } = selectionState;

  // Since the highlightedMarkerMatchers are updated by mouse events, we wait
  // a short amount of time to prevent excessive re-rendering of the 3D panel
  const [hoveredMarkerMatchers, setHoveredMarkerMatchers] = useState<MarkerMatcher[]>([]);
  const setHoveredMarkerMatchersDebounced = useDebouncedCallback(setHoveredMarkerMatchers, 100);

  const isDrawing = useMemo(
    () => measureInfo.measureState !== "idle" || drawingTabType === POLYGON_TAB_TYPE,
    [drawingTabType, measureInfo.measureState],
  );

  // initialize the GridBuilder, SceneBuilder, and TransformsBuilder
  const { gridBuilder, sceneBuilder, transformsBuilder } = useMemo(
    () => ({
      gridBuilder: new GridBuilder(),
      sceneBuilder: new SceneBuilder(sceneBuilderHooks),
      transformsBuilder: new TransformsBuilder(),
    }),
    [],
  );

  // Ensure that we show new namespaces and errors any time scenebuilder adds them.
  useMemo(() => {
    sceneBuilder.setOnForceUpdate(forceUpdate);
  }, [sceneBuilder, forceUpdate]);

  const {
    blacklistTopicsSet,
    topicTreeConfig,
    staticallyAvailableNamespacesByTopic,
    defaultTopicSettings,
    uncategorizedGroupName,
  } = useMemo(
    () => ({
      blacklistTopicsSet: new Set(),
      topicTreeConfig: {
        name: "root",
        children: [
          {
            name: "Grid",
            topicName: FOXGLOVE_GRID_TOPIC,
            children: [],
            description: "Draws a reference grid.",
          },
          {
            name: "TF",
            topicName: "/tf",
            children: [],
            description: "Visualize relationships between /tf frames.",
          },
        ],
      },
      staticallyAvailableNamespacesByTopic: {},
      defaultTopicSettings: {},
      uncategorizedGroupName: "Topics",
    }),
    [],
  );

  const { availableNamespacesByTopic, sceneErrorsByKey: sceneErrorsByTopicKey } =
    useSceneBuilderAndTransformsData({
      sceneBuilder,
      staticallyAvailableNamespacesByTopic,
      transforms,
    });

  // Use deep compare so that we only regenerate rootTreeNode when topics change.
  const memoizedTopics = useShallowMemo(topics);
  // Only show topics with supported datatype and that are not blacklisted as available in topic tree.
  const topicTreeTopics = useMemo(
    () =>
      memoizedTopics.filter(
        (topic) => isTopicRenderable(topic) && !blacklistTopicsSet.has(topic.name),
      ),
    [blacklistTopicsSet, memoizedTopics],
  );

  const topicTreeData = useTopicTree({
    availableNamespacesByTopic,
    checkedKeys,
    defaultTopicSettings,
    expandedKeys,
    filterText,
    modifiedNamespaceTopics: modifiedNamespaceTopics ?? [],
    providerTopics: topicTreeTopics,
    saveConfig,
    sceneErrorsByTopicKey,
    topicDisplayMode,
    settingsByKey,
    topicTreeConfig,
    uncategorizedGroupName,
  });
  const {
    allKeys,
    derivedCustomSettingsByKey,
    getIsNamespaceCheckedByDefault,
    getIsTreeNodeVisibleInScene,
    getIsTreeNodeVisibleInTree,
    hasFeatureColumn,
    onNamespaceOverrideColorChange,
    rootTreeNode,
    sceneErrorsByKey,
    selectedNamespacesByTopic,
    selectedTopicNames,
    shouldExpandAllKeys,
    visibleTopicsCountByKey,
  } = topicTreeData;

  const subscribedTopics = useMemo(() => {
    const allTopics = new Set<string>(selectedTopicNames);

    // Subscribe to all TF topics
    for (const topic of memoizedTopics) {
      if (
        TF_DATATYPES.includes(topic.datatype) ||
        TRANSFORM_STAMPED_DATATYPES.includes(topic.datatype)
      ) {
        allTopics.add(topic.name);
      }
    }

    return Array.from(allTopics.values());
  }, [memoizedTopics, selectedTopicNames]);

  useEffect(() => setSubscriptions(subscribedTopics), [subscribedTopics, setSubscriptions]);
  const { playerId } = useDataSourceInfo();

  // If a user selects a marker or hovers over a TopicPicker row, highlight relevant markers
  const highlightMarkerMatchers = useMemo(() => {
    if (isDrawing) {
      return [];
    }
    if (hoveredMarkerMatchers.length > 0) {
      return hoveredMarkerMatchers;
    }
    // Highlight the selected object if the interactionsTab popout is open
    if (selectedObject && interactionsTabType != undefined) {
      const marker = getObject(selectedObject) as Marker | undefined;
      const topic = getInteractionData(selectedObject)?.topic;
      return marker && topic
        ? [
            {
              topic,
              checks: [
                {
                  markerKeyPath: ["id"],
                  value: marker.id,
                },
                {
                  markerKeyPath: ["ns"],
                  value: marker.ns,
                },
              ],
            },
          ]
        : [];
    }
    return [];
  }, [hoveredMarkerMatchers, interactionsTabType, isDrawing, selectedObject]);

  const colorOverrideMarkerMatchers = useMemo(() => {
    // Transform linkedGlobalVariables and overridesByGlobalVariable into markerMatchers for SceneBuilder
    const linkedGlobalVariablesByName = groupBy(linkedGlobalVariables, ({ name }) => name);
    return Object.keys(
      colorOverrideBySourceIdxByVariable ?? ({} as ColorOverrideBySourceIdxByVariable),
    ).reduce((activeColorOverrideMatchers, name) => {
      return (colorOverrideBySourceIdxByVariable?.[name] ?? ([] as ColorOverride[])).flatMap(
        (override, i) =>
          override?.active ?? false
            ? [
                ...activeColorOverrideMatchers,
                ...(linkedGlobalVariablesByName[name] ?? []).map(({ topic, markerKeyPath }) => {
                  const baseTopic = topic.replace(SECOND_SOURCE_PREFIX, "");
                  return {
                    topic: i === 0 ? baseTopic : joinTopics(SECOND_SOURCE_PREFIX, baseTopic),
                    checks: [
                      {
                        markerKeyPath,
                        value: globalVariables[name],
                      },
                    ],
                    color: override.color,
                  };
                }),
              ]
            : activeColorOverrideMatchers,
      );
    }, [] as MarkerMatcher[]);
  }, [colorOverrideBySourceIdxByVariable, globalVariables, linkedGlobalVariables]);

  const rootTf = useMemo(() => {
    // If the user specified a followTf we will only return the root frame from their followTf
    if (typeof followTf === "string" && followTf.length > 0) {
      if (transforms.has(followTf)) {
        return transforms.rootOfTransform(followTf).id;
      }
      return undefined;
    }

    const tfStore = transforms.storage.entries();

    // Try the conventional list of root frame transform ids
    for (const frameId of DEFAULT_ROOT_FRAME_IDS) {
      const tf = tfStore.get(frameId);
      if (tf != undefined) {
        return tf.id;
      }
    }

    // Fall back to the root of the first transform (lexicographically), if any
    const firstFrameId = Array.from(tfStore.keys()).sort()[0];
    return firstFrameId != undefined ? tfStore.get(firstFrameId)?.rootTransform().id : undefined;
  }, [transforms, followTf]);

  useMemo(() => {
    gridBuilder.setVisible(selectedTopicNames.includes(FOXGLOVE_GRID_TOPIC));
    gridBuilder.setSettingsByKey(settingsByKey);

    if (resetFrame) {
      sceneBuilder.clear();
    }

    sceneBuilder.setPlayerId(playerId);

    if (rootTf) {
      sceneBuilder.setTransforms(transforms, rootTf);
    }

    // Toggle scene builder topics based on visible topic nodes in the tree
    const topicsByTopicName = getTopicsByTopicName(topics);
    const selectedTopics = filterMap(selectedTopicNames, (name) => topicsByTopicName[name]);

    sceneBuilder.setFlattenMarkers(flattenMarkers);
    sceneBuilder.setSelectedNamespacesByTopic(selectedNamespacesByTopic);
    sceneBuilder.setSettingsByKey(settingsByKey);
    sceneBuilder.setTopics(selectedTopics);
    sceneBuilder.setHighlightedMatchers(highlightMarkerMatchers);
    sceneBuilder.setColorOverrideMatchers(colorOverrideMarkerMatchers);
    sceneBuilder.setFrame(frame);
    sceneBuilder.setCurrentTime(currentTime);
    sceneBuilder.render();

    // update the transforms and set the selected ones to render
    if (rootTf) {
      transformsBuilder.setTransforms(transforms, rootTf);
    }
    transformsBuilder.setSelectedTransforms(selectedNamespacesByTopic[TRANSFORM_TOPIC] ?? []);
  }, [
    colorOverrideMarkerMatchers,
    currentTime,
    flattenMarkers,
    frame,
    gridBuilder,
    highlightMarkerMatchers,
    playerId,
    resetFrame,
    rootTf,
    sceneBuilder,
    selectedNamespacesByTopic,
    selectedTopicNames,
    settingsByKey,
    topics,
    transforms,
    transformsBuilder,
  ]);

  const handleDrawPolygons = useCallback(
    (eventName: EventName, ev: React.MouseEvent, args: ReglClickInfo) => {
      polygonBuilder[eventName](ev, args);
      forceUpdate();
    },
    [polygonBuilder],
  );

  // use callbackInputsRef to prevent unnecessary callback changes
  const callbackInputsRef = useRef({
    cameraState,
    debug,
    drawingTabType,
    handleDrawPolygons,
    showTopicTree,
    saveConfig,
    selectionState,
    topics,
    autoSyncCameraState,
    isDrawing,
  });
  callbackInputsRef.current = {
    cameraState,
    debug,
    drawingTabType,
    handleDrawPolygons,
    showTopicTree,
    saveConfig,
    selectionState,
    topics,
    autoSyncCameraState,
    isDrawing,
  };

  const setColorOverrideBySourceIdxByVariable = useCallback(
    (newValue: ColorOverrideBySourceIdxByVariable) => {
      callbackInputsRef.current.saveConfig({
        colorOverrideBySourceIdxByVariable: newValue,
      });
    },
    [],
  );

  const handleEvent = useCallback(
    (eventName: EventName, ev: React.MouseEvent, args?: ReglClickInfo) => {
      if (!args) {
        return;
      }
      const {
        drawingTabType: currentDrawingTabType,
        handleDrawPolygons: currentHandleDrawPolygons,
      } = callbackInputsRef.current;
      const measuringHandler =
        eventName === "onDoubleClick" ? undefined : measuringElRef.current?.[eventName];
      const measureActive = measuringElRef.current?.measureActive ?? false;
      if (measuringHandler && measureActive) {
        return measuringHandler(ev.nativeEvent, args);
      } else if (currentDrawingTabType === POLYGON_TAB_TYPE) {
        currentHandleDrawPolygons(eventName, ev, args);
      }
    },
    [],
  );

  const updateGlobalVariablesFromSelection = useCallback(
    (newSelectedObject?: MouseEventObject) => {
      if (newSelectedObject) {
        const newGlobalVariables = getUpdatedGlobalVariablesBySelectedObject(
          newSelectedObject,
          linkedGlobalVariables,
        );
        if (newGlobalVariables) {
          setGlobalVariables(newGlobalVariables);
        }
      }
    },
    [linkedGlobalVariables, setGlobalVariables],
  );

  // Auto open/close the tab when the selectedObject changes as long as
  // we aren't drawing or the disableAutoOpenClickedObject setting is enabled.
  const updateInteractionsTabVisibility = useCallback(
    (newSelectedObject?: MouseEventObject) => {
      if (!isDrawing) {
        const shouldBeOpen = newSelectedObject != undefined && !disableAutoOpenClickedObject;
        setInteractionsTabType(shouldBeOpen ? OBJECT_TAB_TYPE : undefined);
      }
    },
    [disableAutoOpenClickedObject, isDrawing],
  );

  const selectObject = useCallback(
    (newSelectedObject?: MouseEventObject) => {
      setSelectionState({
        ...callbackInputsRef.current.selectionState,
        selectedObject: newSelectedObject,
      });
      updateInteractionsTabVisibility(newSelectedObject);
      updateGlobalVariablesFromSelection(newSelectedObject);
    },
    [updateInteractionsTabVisibility, updateGlobalVariablesFromSelection],
  );

  const {
    onClick,
    onControlsOverlayClick,
    onDoubleClick,
    onExitTopicTreeFocus,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onSetPolygons,
    toggleCameraMode,
    toggleDebug,
  } = useMemo(() => {
    return {
      onClick: (ev: React.MouseEvent, args?: ReglClickInfo) => {
        // Don't set any clicked objects when measuring distance or drawing polygons.
        if (callbackInputsRef.current.isDrawing) {
          return;
        }
        const newClickedObjects =
          (args?.objects as MouseEventObject[] | undefined) ?? ([] as MouseEventObject[]);
        const newClickedPosition = { clientX: ev.clientX, clientY: ev.clientY };
        const newSelectedObject = newClickedObjects.length === 1 ? newClickedObjects[0] : undefined;

        // Select the object directly if there is only one or open up context menu if there are many.
        setSelectionState({
          ...callbackInputsRef.current.selectionState,
          clickedObjects: newClickedObjects,
          clickedPosition: newClickedPosition,
        });
        selectObject(newSelectedObject);
      },
      onControlsOverlayClick: (ev: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) {
          return;
        }
        const target = ev.target as HTMLElement;
        // Only close if the click target is inside the panel, e.g. don't close when dropdown menus rendered in portals are clicked
        if (containerRef.current.contains(target)) {
          setShowTopicTree(false);
        }
      },
      onDoubleClick: (ev: React.MouseEvent, args?: ReglClickInfo) =>
        handleEvent("onDoubleClick", ev, args),
      onExitTopicTreeFocus: () => {
        if (containerRef.current) {
          containerRef.current.focus();
        }
      },
      onMouseDown: (ev: React.MouseEvent, args?: ReglClickInfo) =>
        handleEvent("onMouseDown", ev, args),
      onMouseMove: (ev: React.MouseEvent, args?: ReglClickInfo) =>
        handleEvent("onMouseMove", ev, args),
      onMouseUp: (ev: React.MouseEvent, args?: ReglClickInfo) => handleEvent("onMouseUp", ev, args),
      onSetPolygons: (polygons: Polygon[]) => setPolygonBuilder(new PolygonBuilder(polygons)),
      toggleDebug: () => setDebug(!callbackInputsRef.current.debug),
      toggleCameraMode: () => {
        const { cameraState: currentCameraState, saveConfig: currentSaveConfig } =
          callbackInputsRef.current;
        currentSaveConfig({
          cameraState: { ...currentCameraState, perspective: !currentCameraState.perspective },
        });
        if (measuringElRef.current && currentCameraState.perspective) {
          measuringElRef.current.reset();
        }
      },
    };
  }, [handleEvent, selectObject]);

  // When the TopicTree is hidden, focus the <World> again so keyboard controls continue to work
  const worldRef = useRef<typeof Worldview | undefined>(ReactNull);
  useEffect(() => {
    if (!showTopicTree) {
      worldRef.current?.focus();
    }
  }, [showTopicTree]);

  const keyDownHandlers = useMemo(() => {
    const handlers: {
      [key: string]: (e: KeyboardEvent) => void;
    } = {
      "3": () => {
        toggleCameraMode();
      },
      Escape: (e) => {
        e.preventDefault();
        setShowTopicTree(false);
        setDrawingTabType(undefined);
        searchTextProps.toggleSearchTextOpen(false);
        if (document.activeElement && document.activeElement === containerRef.current) {
          (document.activeElement as HTMLElement).blur();
        }
      },
      t: (e) => {
        e.preventDefault();
        // Unpin before enabling keyboard toggle open/close.
        if (pinTopics) {
          saveConfig({ pinTopics: false });
          return;
        }
        setShowTopicTree((shown) => !shown);
      },
      f: (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          searchTextProps.toggleSearchTextOpen(true);
          if (!searchTextProps.searchInputRef.current) {
            return;
          }
          searchTextProps.searchInputRef.current.select();
        }
      },
    };
    return handlers;
  }, [pinTopics, saveConfig, searchTextProps, toggleCameraMode]);

  const markerProviders = useMemo(
    () => [gridBuilder, sceneBuilder, transformsBuilder],
    [gridBuilder, sceneBuilder, transformsBuilder],
  );

  const cursorType = isDrawing ? "crosshair" : "";

  // Memoize the threeDimensionalVizContextValue to avoid returning a new object every time
  const threeDimensionalVizContextValue = useMemo(
    () => ({
      setColorOverrideBySourceIdxByVariable,
      setHoveredMarkerMatchers: setHoveredMarkerMatchersDebounced,
      colorOverrideBySourceIdxByVariable: colorOverrideBySourceIdxByVariable ?? {},
    }),
    [
      colorOverrideBySourceIdxByVariable,
      setColorOverrideBySourceIdxByVariable,
      setHoveredMarkerMatchersDebounced,
    ],
  );

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    width: containerWidth,
    height: containerHeight,
    ref: topicTreeSizeRef,
  } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  return (
    <ThreeDimensionalVizContext.Provider value={threeDimensionalVizContextValue}>
      <TopicTreeContext.Provider value={topicTreeData}>
        <div
          ref={containerRef}
          onClick={onControlsOverlayClick}
          tabIndex={-1}
          className={styles.container}
          style={{ cursor: cursorType }}
          data-test="3dviz-layout"
        >
          <KeyListener keyDownHandlers={keyDownHandlers} />
          <PanelToolbar floating helpContent={helpContent} />
          <div style={{ position: "absolute", width: "100%", height: "100%" }}>
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
              }}
              ref={topicTreeSizeRef}
            >
              <TopicTree
                allKeys={allKeys}
                availableNamespacesByTopic={availableNamespacesByTopic}
                checkedKeys={checkedKeys}
                containerHeight={containerHeight ?? 0}
                containerWidth={containerWidth ?? 0}
                settingsByKey={settingsByKey}
                derivedCustomSettingsByKey={derivedCustomSettingsByKey}
                expandedKeys={expandedKeys}
                filterText={filterText}
                getIsNamespaceCheckedByDefault={getIsNamespaceCheckedByDefault}
                getIsTreeNodeVisibleInScene={getIsTreeNodeVisibleInScene}
                getIsTreeNodeVisibleInTree={getIsTreeNodeVisibleInTree}
                hasFeatureColumn={hasFeatureColumn}
                onExitTopicTreeFocus={onExitTopicTreeFocus}
                onNamespaceOverrideColorChange={onNamespaceOverrideColorChange}
                pinTopics={pinTopics}
                diffModeEnabled={diffModeEnabled}
                rootTreeNode={rootTreeNode}
                saveConfig={saveConfig}
                sceneErrorsByKey={sceneErrorsByKey}
                setCurrentEditingTopic={setCurrentEditingTopic}
                setFilterText={setFilterText}
                setShowTopicTree={setShowTopicTree}
                shouldExpandAllKeys={shouldExpandAllKeys}
                showTopicTree={showTopicTree}
                topicDisplayMode={topicDisplayMode}
                visibleTopicsCountByKey={visibleTopicsCountByKey}
              />
              {currentEditingTopic && (
                <TopicSettingsModal
                  currentEditingTopic={currentEditingTopic}
                  hasFeatureColumn={hasFeatureColumn}
                  setCurrentEditingTopic={setCurrentEditingTopic}
                  sceneBuilderMessage={
                    sceneBuilder.collectors[currentEditingTopic.name]?.getMessages()[0]
                  }
                  saveConfig={saveConfig}
                  settingsByKey={settingsByKey}
                />
              )}
            </div>
          </div>
          <div className={styles.world}>
            <World
              key={`${callbackInputsRef.current.autoSyncCameraState ? "synced" : "not-synced"}`}
              autoTextBackgroundColor={autoTextBackgroundColor}
              cameraState={cameraState}
              isPlaying={isPlaying}
              markerProviders={markerProviders}
              onCameraStateChange={onCameraStateChange}
              diffModeEnabled={hasFeatureColumn && diffModeEnabled}
              onClick={onClick}
              onDoubleClick={onDoubleClick}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              searchTextOpen={searchTextOpen}
              searchText={searchText}
              setSearchTextMatches={setSearchTextMatches}
              searchTextMatches={searchTextMatches}
              selectedMatchIndex={selectedMatchIndex}
            >
              {children}
              <DrawPolygons>{polygonBuilder.polygons}</DrawPolygons>
              <div>
                <LayoutToolbar
                  cameraState={cameraState}
                  interactionsTabType={interactionsTabType}
                  setInteractionsTabType={setInteractionsTabType}
                  debug={debug}
                  followOrientation={followOrientation}
                  followTf={followTf}
                  isPlaying={isPlaying}
                  measureInfo={measureInfo}
                  measuringElRef={measuringElRef}
                  onAlignXYAxis={onAlignXYAxis}
                  onCameraStateChange={onCameraStateChange}
                  autoSyncCameraState={!!autoSyncCameraState}
                  onFollowChange={onFollowChange}
                  onSetDrawingTabType={setDrawingTabType}
                  onSetPolygons={onSetPolygons}
                  onToggleCameraMode={toggleCameraMode}
                  onToggleDebug={toggleDebug}
                  polygonBuilder={polygonBuilder}
                  saveConfig={saveConfig}
                  selectedObject={selectedObject}
                  setMeasureInfo={setMeasureInfo}
                  showCrosshair={showCrosshair}
                  targetPose={targetPose}
                  transforms={transforms}
                  rootTf={rootTf}
                  {...searchTextProps}
                />
              </div>
              {clickedObjects.length > 1 && !selectedObject && (
                <InteractionContextMenu
                  clickedPosition={clickedPosition}
                  clickedObjects={clickedObjects}
                  selectObject={selectObject}
                />
              )}
              {process.env.NODE_ENV !== "production" && !inScreenshotTests() && debug && (
                <DebugStats />
              )}
            </World>
          </div>
        </div>
      </TopicTreeContext.Provider>
    </ThreeDimensionalVizContext.Provider>
  );
}
