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

import { groupBy } from "lodash";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useResizeDetector } from "react-resize-detector";
import {
  Worldview,
  PolygonBuilder,
  DrawPolygons,
  CameraState,
  ReglClickInfo,
  MouseEventObject,
  Polygon,
} from "regl-worldview";
import { Time } from "rosbag";
import { useDebouncedCallback } from "use-debounce";

import useDataSourceInfo from "@foxglove-studio/app/PanelAPI/useDataSourceInfo";
import KeyListener from "@foxglove-studio/app/components/KeyListener";
import Modal from "@foxglove-studio/app/components/Modal";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import { useExperimentalFeature } from "@foxglove-studio/app/context/ExperimentalFeaturesContext";
import useGlobalVariables from "@foxglove-studio/app/hooks/useGlobalVariables";
import useShallowMemo from "@foxglove-studio/app/hooks/useShallowMemo";
import { Save3DConfig } from "@foxglove-studio/app/panels/ThreeDimensionalViz";
import DebugStats from "@foxglove-studio/app/panels/ThreeDimensionalViz/DebugStats";
import {
  POLYGON_TAB_TYPE,
  DrawingTabType,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/DrawingTools";
import MeasuringTool, {
  MeasureInfo,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/DrawingTools/MeasuringTool";
import GridBuilder from "@foxglove-studio/app/panels/ThreeDimensionalViz/GridBuilder";
import {
  InteractionContextMenu,
  OBJECT_TAB_TYPE,
  TabType,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions";
import useLinkedGlobalVariables from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import styles from "@foxglove-studio/app/panels/ThreeDimensionalViz/Layout.module.scss";
import LayoutToolbar from "@foxglove-studio/app/panels/ThreeDimensionalViz/LayoutToolbar";
import PanelToolbarMenu from "@foxglove-studio/app/panels/ThreeDimensionalViz/PanelToolbarMenu";
import SceneBuilder from "@foxglove-studio/app/panels/ThreeDimensionalViz/SceneBuilder";
import sceneBuilderHooks from "@foxglove-studio/app/panels/ThreeDimensionalViz/SceneBuilder/defaultHooks";
import { useSearchText } from "@foxglove-studio/app/panels/ThreeDimensionalViz/SearchText";
import {
  MarkerMatcher,
  ThreeDimensionalVizContext,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import { ColorPickerSettingsPanel } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicSettingsEditor/ColorPickerForTopicSettings";
import TopicSettingsModal from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/TopicSettingsModal";
import TopicTree from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/TopicTree";
import { TOPIC_DISPLAY_MODES } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/TopicViewModeSelector";
import { TopicDisplayMode } from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/types";
import useSceneBuilderAndTransformsData from "@foxglove-studio/app/panels/ThreeDimensionalViz/TopicTree/useSceneBuilderAndTransformsData";
import Transforms, {
  DEFAULT_ROOT_FRAME_IDS,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/Transforms";
import TransformsBuilder from "@foxglove-studio/app/panels/ThreeDimensionalViz/TransformsBuilder";
import World from "@foxglove-studio/app/panels/ThreeDimensionalViz/World";
import {
  TargetPose,
  getInteractionData,
  getObject,
  getUpdatedGlobalVariablesBySelectedObject,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { ThreeDimensionalVizConfig } from "@foxglove-studio/app/panels/ThreeDimensionalViz/types";
import { Frame, Topic } from "@foxglove-studio/app/players/types";
import inScreenshotTests from "@foxglove-studio/app/stories/inScreenshotTests";
import { Color } from "@foxglove-studio/app/types/Messages";
import { isNonEmptyOrUndefined } from "@foxglove-studio/app/util/emptyOrUndefined";
import filterMap from "@foxglove-studio/app/util/filterMap";
import {
  COLOR_RGBA_DATATYPE,
  FOXGLOVE_GRID_TOPIC,
  GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE,
  NAV_MSGS_OCCUPANCY_GRID_DATATYPE,
  NAV_MSGS_PATH_DATATYPE,
  POINT_CLOUD_DATATYPE,
  POSE_STAMPED_DATATYPE,
  SECOND_SOURCE_PREFIX,
  SENSOR_MSGS_LASER_SCAN_DATATYPE,
  TF_DATATYPE,
  TF2_DATATYPE,
  TRANSFORM_TOPIC,
  VELODYNE_SCAN_DATATYPE,
  VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
  VISUALIZATION_MSGS_MARKER_DATATYPE,
  WEBVIZ_MARKER_ARRAY_DATATYPE,
  WEBVIZ_MARKER_DATATYPE,
  TRANSFORM_STAMPED_DATATYPE,
} from "@foxglove-studio/app/util/globalConstants";
import { inVideoRecordingMode } from "@foxglove-studio/app/util/inAutomatedRunMode";
import { getTopicsByTopicName } from "@foxglove-studio/app/util/selectors";
import { joinTopics } from "@foxglove-studio/app/util/topicUtils";

import useTopicTree, { TopicTreeContext } from "./useTopicTree";

type EventName = "onDoubleClick" | "onMouseMove" | "onMouseDown" | "onMouseUp";
export type ClickedPosition = { clientX: number; clientY: number };

export type LayoutToolbarSharedProps = {
  cameraState: CameraState;
  followOrientation: boolean;
  followTf?: string | false;
  onAlignXYAxis: () => void;
  onCameraStateChange: (arg0: CameraState) => void;
  onFollowChange: (followTf?: string | false, followOrientation?: boolean) => void;
  saveConfig: Save3DConfig;
  targetPose?: TargetPose;
  transforms: Transforms;
  isPlaying?: boolean;
};

export type LayoutTopicSettingsSharedProps = {
  transforms: Transforms;
  topics: Topic[];
  saveConfig: Save3DConfig;
};

type Props = LayoutToolbarSharedProps &
  LayoutTopicSettingsSharedProps & {
    children?: Node;
    cleared?: boolean;
    currentTime: Time;
    frame?: Frame;
    helpContent: Node | string;
    isPlaying?: boolean;
    config: ThreeDimensionalVizConfig;
    saveConfig: Save3DConfig;
    setSubscriptions: (subscriptions: string[]) => void;
    topics: Topic[];
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

export type EditTopicState = { tooltipPosX: number; topic: Topic };

type GlobalVariableName = string;
export type ColorOverride = {
  color?: Color;
  active?: boolean;
};
export type ColorOverrideBySourceIdxByVariable = Record<GlobalVariableName, ColorOverride[]>;

const SUPPORTED_MARKER_DATATYPES = {
  // generally supported datatypes
  VISUALIZATION_MSGS_MARKER_DATATYPE,
  VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
  WEBVIZ_MARKER_DATATYPE,
  WEBVIZ_MARKER_ARRAY_DATATYPE,
  POSE_STAMPED_DATATYPE,
  POINT_CLOUD_DATATYPE,
  VELODYNE_SCAN_DATATYPE,
  SENSOR_MSGS_LASER_SCAN_DATATYPE,
  COLOR_RGBA_DATATYPE,
  NAV_MSGS_OCCUPANCY_GRID_DATATYPE,
  NAV_MSGS_PATH_DATATYPE,
  GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE,
  TF_DATATYPE,
  TF2_DATATYPE,
};
const SUPPORTED_MARKER_DATATYPES_SET = new Set(Object.values(SUPPORTED_MARKER_DATATYPES));

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
  cleared = false,
  currentTime,
  followOrientation,
  followTf,
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
    selectedPolygonEditFormat = "yaml",
    showCrosshair,
    autoSyncCameraState = false,
    topicDisplayMode = TOPIC_DISPLAY_MODES.SHOW_ALL.value as TopicDisplayMode,
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
  const [editingNamespace, setEditingNamespace] = useState<
    | {
        namespaceKey: string;
        namespaceColor?: string;
      }
    | undefined
  >();

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
  const [interactionsTabType, setInteractionsTabType] = useState<DrawingTabType | undefined>(
    undefined,
  );

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
      supportedMarkerDatatypesSet: new Set([
        VISUALIZATION_MSGS_MARKER_DATATYPE,
        VISUALIZATION_MSGS_MARKER_ARRAY_DATATYPE,
        WEBVIZ_MARKER_DATATYPE,
        WEBVIZ_MARKER_ARRAY_DATATYPE,
        POSE_STAMPED_DATATYPE,
        POINT_CLOUD_DATATYPE,
        VELODYNE_SCAN_DATATYPE,
        SENSOR_MSGS_LASER_SCAN_DATATYPE,
        NAV_MSGS_OCCUPANCY_GRID_DATATYPE,
        NAV_MSGS_PATH_DATATYPE,
        GEOMETRY_MSGS_POLYGON_STAMPED_DATATYPE,
        TF_DATATYPE,
        TF2_DATATYPE,
      ]),
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

  const {
    availableNamespacesByTopic,
    sceneErrorsByKey: sceneErrorsByTopicKey,
  } = useSceneBuilderAndTransformsData({
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
        topic.datatype === TF_DATATYPE ||
        topic.datatype === TF2_DATATYPE ||
        topic.datatype === TRANSFORM_STAMPED_DATATYPE
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
      const marker = getObject(selectedObject);
      const topic = getInteractionData(selectedObject)?.topic;
      return marker && isNonEmptyOrUndefined(topic)
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

  useEffect(() => {
    sceneBuilder.setPlayerId(playerId);
  }, [playerId, sceneBuilder]);

  useEffect(() => {
    if (!isNonEmptyOrUndefined(rootTf)) {
      return;
    }
    sceneBuilder.setTransforms(transforms, rootTf);
  }, [rootTf, sceneBuilder, transforms]);

  useMemo(() => {
    gridBuilder.setVisible(selectedTopicNames.includes(FOXGLOVE_GRID_TOPIC));
    gridBuilder.setSettingsByKey(settingsByKey);

    // TODO(Audrey): add tests for the clearing behavior
    if (cleared) {
      sceneBuilder.clear();
    }
    if (!frame) {
      return;
    }
    // Toggle scene builder topics based on visible topic nodes in the tree
    const topicsByTopicName = getTopicsByTopicName(topics);
    const selectedTopics = filterMap(selectedTopicNames, (name) => topicsByTopicName[name]);

    sceneBuilder.setFlattenMarkers(flattenMarkers);
    sceneBuilder.setSelectedNamespacesByTopic(selectedNamespacesByTopic);
    sceneBuilder.setSettingsByKey(settingsByKey);
    sceneBuilder.setTopics(selectedTopics);
    sceneBuilder.setGlobalVariables({ globalVariables });
    sceneBuilder.setHighlightedMatchers(highlightMarkerMatchers);
    sceneBuilder.setColorOverrideMatchers(colorOverrideMarkerMatchers);
    sceneBuilder.setFrame(frame);
    sceneBuilder.setCurrentTime(currentTime);
    sceneBuilder.render();

    // update the transforms and set the selected ones to render
    if (isNonEmptyOrUndefined(rootTf)) {
      transformsBuilder.setTransforms(transforms, rootTf);
    }
    transformsBuilder.setSelectedTransforms(selectedNamespacesByTopic[TRANSFORM_TOPIC] ?? []);
  }, [
    cleared,
    colorOverrideMarkerMatchers,
    currentTime,
    flattenMarkers,
    frame,
    globalVariables,
    gridBuilder,
    highlightMarkerMatchers,
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
    (eventName: EventName, ev: MouseEvent, args?: ReglClickInfo) => {
      (polygonBuilder as any)[eventName](ev, args);
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
    autoSyncCameraState: autoSyncCameraState,
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
    autoSyncCameraState: autoSyncCameraState,
    isDrawing,
  };

  const setColorOverrideBySourceIdxByVariable = useCallback(
    (_colorOverrideBySourceIdxByVariable) => {
      callbackInputsRef.current.saveConfig({
        colorOverrideBySourceIdxByVariable: _colorOverrideBySourceIdxByVariable,
      });
    },
    [],
  );

  const handleEvent = useCallback((eventName: EventName, ev: MouseEvent, args?: ReglClickInfo) => {
    if (!args) {
      return;
    }
    const {
      drawingTabType: currentDrawingTabType,
      handleDrawPolygons: currentHandleDrawPolygons,
    } = callbackInputsRef.current;
    const measuringHandler = measuringElRef.current && (measuringElRef.current as any)[eventName];
    const measureActive = measuringElRef.current?.measureActive ?? false;
    if (measuringHandler && measureActive) {
      return measuringHandler(ev, args);
    } else if (currentDrawingTabType === POLYGON_TAB_TYPE) {
      currentHandleDrawPolygons(eventName, ev, args);
    }
  }, []);

  const updateGlobalVariablesFromSelection = useCallback(
    (newSelectedObject: MouseEventObject) => {
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
        const shouldBeOpen = newSelectedObject && !disableAutoOpenClickedObject;
        setInteractionsTabType(shouldBeOpen ? (OBJECT_TAB_TYPE as any) : undefined);
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
      onClick: (ev: MouseEvent, args?: ReglClickInfo & { objects: MouseEventObject[] }) => {
        // Don't set any clicked objects when measuring distance or drawing polygons.
        if (callbackInputsRef.current.isDrawing) {
          return;
        }
        const newClickedObjects = args?.objects ?? ([] as MouseEventObject[]);
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
      onDoubleClick: (ev: MouseEvent, args?: ReglClickInfo) =>
        handleEvent("onDoubleClick", ev, args),
      onExitTopicTreeFocus: () => {
        if (containerRef.current) {
          containerRef.current.focus();
        }
      },
      onMouseDown: (ev: MouseEvent, args?: ReglClickInfo) => handleEvent("onMouseDown", ev, args),
      onMouseMove: (ev: MouseEvent, args?: ReglClickInfo) => handleEvent("onMouseMove", ev, args),
      onMouseUp: (ev: MouseEvent, args?: ReglClickInfo) => handleEvent("onMouseUp", ev, args),
      onSetPolygons: (polygons: Polygon[]) => setPolygonBuilder(new PolygonBuilder(polygons)),
      toggleDebug: () => setDebug(!callbackInputsRef.current.debug),
      toggleCameraMode: () => {
        const {
          cameraState: currentCameraState,
          saveConfig: currentSaveConfig,
        } = callbackInputsRef.current;
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
    if (!showTopicTree && worldRef.current) {
      worldRef.current.focus();
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

  const markerProviders = useMemo(() => [gridBuilder, sceneBuilder, transformsBuilder], [
    gridBuilder,
    sceneBuilder,
    transformsBuilder,
  ]);

  const cursorType = isDrawing ? "crosshair" : "";
  const { isHovered = false } = useContext(PanelContext) ?? {};
  const isDemoMode = useExperimentalFeature("demoMode");
  const isHidden = isDemoMode && !isHovered;

  const { videoRecordingStyle } = useMemo(
    () => ({
      videoRecordingStyle: { visibility: inVideoRecordingMode() ? "hidden" : "visible" },
    }),
    [],
  );

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

  const {
    width: containerWidth,
    height: containerHeight,
    ref: topicTreeSizeRef,
  } = useResizeDetector();

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
          <PanelToolbarMenu
            autoTextBackgroundColor={autoTextBackgroundColor}
            checkedKeys={checkedKeys}
            flattenMarkers={!!flattenMarkers}
            helpContent={helpContent}
            saveConfig={saveConfig}
            settingsByKey={settingsByKey}
          />
          <div style={{ position: "absolute", width: "100%", height: "100%" }}>
            <div
              style={
                {
                  ...videoRecordingStyle,
                  position: "relative",
                  width: "100%",
                  height: "100%",
                } as React.CSSProperties
              }
              ref={topicTreeSizeRef}
            >
              {(!isDemoMode || (isDemoMode && isHovered)) && (
                <TopicTree
                  allKeys={allKeys}
                  availableNamespacesByTopic={availableNamespacesByTopic}
                  checkedKeys={checkedKeys}
                  containerHeight={containerHeight ?? 0}
                  containerWidth={containerWidth ?? 0}
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
                  setEditingNamespace={setEditingNamespace}
                  setFilterText={setFilterText}
                  setShowTopicTree={setShowTopicTree}
                  shouldExpandAllKeys={shouldExpandAllKeys}
                  showTopicTree={showTopicTree}
                  topicDisplayMode={topicDisplayMode}
                  visibleTopicsCountByKey={visibleTopicsCountByKey}
                />
              )}
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
              {editingNamespace && (
                <RenderToBodyComponent>
                  <Modal
                    onRequestClose={() => setEditingNamespace(undefined)}
                    contentStyle={{
                      maxHeight: "calc(100vh - 200px)",
                      maxWidth: 480,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <ColorPickerSettingsPanel
                      color={settingsByKey[editingNamespace.namespaceKey]?.overrideColor}
                      onChange={(newColor) =>
                        onNamespaceOverrideColorChange(newColor, editingNamespace.namespaceKey)
                      }
                    />
                  </Modal>
                </RenderToBodyComponent>
              )}
            </div>
          </div>
          <div className={styles.world}>
            <World
              key={`${callbackInputsRef.current.autoSyncCameraState ? "synced" : "not-synced"}`}
              autoTextBackgroundColor={autoTextBackgroundColor}
              cameraState={cameraState}
              isPlaying={isPlaying}
              isDemoMode={isDemoMode}
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
              <div style={videoRecordingStyle as React.CSSProperties}>
                <LayoutToolbar
                  cameraState={cameraState}
                  interactionsTabType={interactionsTabType as TabType | undefined}
                  setInteractionsTabType={
                    setInteractionsTabType as React.Dispatch<
                      React.SetStateAction<TabType | undefined>
                    >
                  }
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
                  selectedPolygonEditFormat={selectedPolygonEditFormat}
                  setMeasureInfo={setMeasureInfo}
                  showCrosshair={showCrosshair}
                  targetPose={targetPose}
                  transforms={transforms}
                  rootTf={rootTf}
                  isHidden={isHidden}
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
