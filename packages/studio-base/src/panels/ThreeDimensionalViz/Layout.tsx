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

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  useTheme,
} from "@mui/material";
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
import { useLatest } from "react-use";
import { makeStyles } from "tss-react/mui";
import { useDebouncedCallback } from "use-debounce";
import { useImmerReducer } from "use-immer";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import { Worldview, CameraState, ReglClickInfo, MouseEventObject } from "@foxglove/regl-worldview";
import { Time } from "@foxglove/rostime";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { Save3DConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz";
import DebugStats from "@foxglove/studio-base/panels/ThreeDimensionalViz/DebugStats";
import GridBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/GridBuilder";
import {
  interactionStateReducer,
  makeInitialInteractionState,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/InteractionState";
import {
  InteractionContextMenu,
  OBJECT_TAB_TYPE,
  TabType,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions";
import useLinkedGlobalVariables from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import LayoutToolbar from "@foxglove/studio-base/panels/ThreeDimensionalViz/LayoutToolbar";
import SceneBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder";
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
import TransformsBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/TransformsBuilder";
import UrdfBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/UrdfBuilder";
import World from "@foxglove/studio-base/panels/ThreeDimensionalViz/World";
import {
  TF_DATATYPES,
  TRANSFORM_STAMPED_DATATYPES,
  TRANSFORM_TOPIC,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import {
  getInteractionData,
  getObject,
  getUpdatedGlobalVariablesBySelectedObject,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import {
  IImmutableCoordinateFrame,
  IImmutableTransformTree,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import {
  FollowMode,
  ReglMouseEventHandler,
  MouseEventName,
  ThreeDimensionalVizConfig,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { Frame } from "@foxglove/studio-base/panels/ThreeDimensionalViz/useFrame";
import { Topic } from "@foxglove/studio-base/players/types";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import { Color, Marker } from "@foxglove/studio-base/types/Messages";
import {
  FOXGLOVE_GRID_TOPIC,
  ROBOT_DESCRIPTION_PARAM,
  URDF_TOPIC,
} from "@foxglove/studio-base/util/globalConstants";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";

export type ClickedPosition = { clientX: number; clientY: number };

export type LayoutToolbarSharedProps = {
  cameraState: CameraState;
  followMode: "follow" | "no-follow" | "follow-orientation";
  followTf?: string;
  onAlignXYAxis: () => void;
  onCameraStateChange: (arg0: CameraState) => void;
  onFollowChange: (followTf?: string, followMode?: FollowMode) => void;
  saveConfig: Save3DConfig;
  transforms: IImmutableTransformTree;
  isPlaying?: boolean;
};

export type LayoutTopicSettingsSharedProps = {
  transforms: IImmutableTransformTree;
  topics: readonly Topic[];
  saveConfig: Save3DConfig;
};

type Props = LayoutToolbarSharedProps &
  LayoutTopicSettingsSharedProps & {
    children?: React.ReactNode;
    renderFrame: IImmutableCoordinateFrame;
    fixedFrame: IImmutableCoordinateFrame;
    currentTime: Time;
    resetFrame: boolean;
    frame: Frame;
    helpContent: React.ReactNode | string;
    isPlaying?: boolean;
    config: ThreeDimensionalVizConfig;
    urdfBuilder: UrdfBuilder;
    saveConfig: Save3DConfig;
    setSubscriptions: (subscriptions: string[]) => void;
    topics: readonly Topic[];
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
export type ColorOverrideByVariable = Record<GlobalVariableName, ColorOverride>;

const useStyles = makeStyles()({
  container: {
    display: "flex",
    flexDirection: "column",
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
  "ros.visualization_msgs.Marker",
  "visualization_msgs/MarkerArray",
  "visualization_msgs/msg/MarkerArray",
  "ros.visualization_msgs.MarkerArray",
  "geometry_msgs/PoseArray",
  "geometry_msgs/msg/PoseArray",
  "ros.geometry_msgs.PoseArray",
  "foxglove_msgs/PosesInFrame",
  "foxglove_msgs/msg/PosesInFrame",
  "foxglove.PosesInFrame",
  "geometry_msgs/PoseStamped",
  "geometry_msgs/msg/PoseStamped",
  "ros.geometry_msgs.PoseStamped",
  "foxglove_msgs/PoseInFrame",
  "foxglove_msgs/msg/PoseInFrame",
  "foxglove.PoseInFrame",
  "sensor_msgs/PointCloud2",
  "sensor_msgs/msg/PointCloud2",
  "ros.sensor_msgs.PointCloud2",
  "foxglove_msgs/PointCloud",
  "foxglove_msgs/msg/PointCloud",
  "foxglove.PointCloud",
  "velodyne_msgs/VelodyneScan",
  "velodyne_msgs/msg/VelodyneScan",
  "ros.velodyne_msgs.VelodyneScan",
  "sensor_msgs/LaserScan",
  "sensor_msgs/msg/LaserScan",
  "ros.sensor_msgs.LaserScan",
  "foxglove_msgs/LaserScan",
  "foxglove_msgs/msg/LaserScan",
  "foxglove.LaserScan",
  "std_msgs/ColorRGBA",
  "std_msgs/msg/ColorRGBA",
  "ros.std_msgs.ColorRGBA",
  "foxglove_msgs/Color",
  "foxglove_msgs/msg/Color",
  "foxglove.Color",
  "nav_msgs/OccupancyGrid",
  "nav_msgs/msg/OccupancyGrid",
  "ros.nav_msgs.OccupancyGrid",
  "foxglove_msgs/Grid",
  "foxglove_msgs/msg/Grid",
  "foxglove.Grid",
  "nav_msgs/Path",
  "nav_msgs/msg/Path",
  "ros.nav_msgs.Path",
  "geometry_msgs/PolygonStamped",
  "geometry_msgs/msg/PolygonStamped",
  "ros.geometry_msgs.PolygonStamped",
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
  renderFrame,
  fixedFrame,
  currentTime,
  followMode,
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
  transforms,
  setSubscriptions,
  urdfBuilder,
  config,
  config: {
    autoTextBackgroundColor = false,
    checkedKeys,
    expandedKeys,
    flattenMarkers = false,
    modifiedNamespaceTopics,
    pinTopics,
    showCrosshair,
    autoSyncCameraState = false,
    topicDisplayMode = TOPIC_DISPLAY_MODES.SHOW_ALL.value,
    settingsByKey,
    colorOverrideByVariable,
    disableAutoOpenClickedObject = false,
    useThemeBackgroundColor,
    customBackgroundColor,
    ignoreColladaUpAxis = false,
  },
}: Props): React.ReactElement {
  const { classes } = useStyles();
  const [filterText, setFilterText] = useState(""); // Topic tree text for filtering to see certain topics.
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const { linkedGlobalVariables } = useLinkedGlobalVariables();
  const { globalVariables, setGlobalVariables } = useGlobalVariables();
  const [debug, setDebug] = useState(false);
  const [showTopicTree, setShowTopicTree] = useState<boolean>(false);
  const [interactionState, interactionStateDispatch] = useImmerReducer(
    interactionStateReducer,
    makeInitialInteractionState(),
  );

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

  const isDrawing = useMemo(() => interactionState.tool !== "idle", [interactionState.tool]);

  const { gridBuilder, sceneBuilder, transformsBuilder } = useMemo(
    () => ({
      gridBuilder: new GridBuilder(),
      sceneBuilder: new SceneBuilder(),
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
            name: "3D Model",
            topicName: URDF_TOPIC,
            children: [],
            description: "Visualize a 3D model",
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

    const variables = Object.entries(colorOverrideByVariable ?? {});
    return variables.reduce((activeColorOverrideMatchers, [variable, override]) => {
      return override.active ?? false
        ? [
            ...activeColorOverrideMatchers,
            ...(linkedGlobalVariablesByName[variable] ?? []).map(({ topic, markerKeyPath }) => {
              const baseTopic = topic;
              return {
                topic: baseTopic,
                checks: [
                  {
                    markerKeyPath,
                    value: globalVariables[variable],
                  },
                ],
                color: override.color,
              };
            }),
          ]
        : activeColorOverrideMatchers;
    }, [] as MarkerMatcher[]);
  }, [colorOverrideByVariable, globalVariables, linkedGlobalVariables]);

  const [robotDescriptionParam] = PanelAPI.useParameter<string>(ROBOT_DESCRIPTION_PARAM);

  useMemo(() => {
    gridBuilder.setVisible(selectedTopicNames.includes(FOXGLOVE_GRID_TOPIC));
    gridBuilder.setSettingsByKey(settingsByKey);

    if (resetFrame) {
      sceneBuilder.clear();
    }

    urdfBuilder.setUrdfData(robotDescriptionParam);
    urdfBuilder.setVisible(selectedTopicNames.includes(URDF_TOPIC));
    urdfBuilder.setSettingsByKey(settingsByKey);

    // Toggle scene builder topics based on visible topic nodes in the tree
    const topicsByTopicName = getTopicsByTopicName(topics);
    const selectedTopics = filterMap(selectedTopicNames, (name) => topicsByTopicName[name]);

    sceneBuilder.setPlayerId(playerId);
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
    robotDescriptionParam,
    sceneBuilder,
    selectedNamespacesByTopic,
    selectedTopicNames,
    settingsByKey,
    topics,
    transformsBuilder,
    urdfBuilder,
  ]);

  // use callbackInputsRef to prevent unnecessary callback changes
  const callbackInputsRef = useRef({
    cameraState,
    debug,
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
    showTopicTree,
    saveConfig,
    selectionState,
    topics,
    autoSyncCameraState,
    isDrawing,
  };

  const setColorOverrideByVariable = useCallback((newValue: ColorOverrideByVariable) => {
    callbackInputsRef.current.saveConfig({
      colorOverrideByVariable: newValue,
    });
  }, []);

  const eventHandlers = useRef(new Map<MouseEventName, Set<ReglMouseEventHandler>>());

  const addMouseEventHandler = useCallback(
    (eventName: MouseEventName, handler: ReglMouseEventHandler) => {
      if (!eventHandlers.current.has(eventName)) {
        eventHandlers.current.set(eventName, new Set());
      }
      eventHandlers.current.get(eventName)?.add(handler);
    },
    [],
  );

  const removeMouseEventHandler = useCallback(
    (eventName: MouseEventName, handler: ReglMouseEventHandler) => {
      eventHandlers.current.get(eventName)?.delete(handler);
    },
    [],
  );

  const handleEvent = useCallback(
    (eventName: MouseEventName, ev: React.MouseEvent, click?: ReglClickInfo) => {
      if (click) {
        eventHandlers.current.get(eventName)?.forEach((handler) => handler(ev, click));
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
        clickedObjects: [],
        clickedPosition: { clientX: 0, clientY: 0 },
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

        // With multiple objects we update the selection state with all possible objects
        if (newClickedObjects.length > 1) {
          setSelectionState((prevState) => {
            return {
              ...prevState,
              selectedObject: undefined,
              clickedObjects: newClickedObjects,
              clickedPosition: {
                clientX: ev.clientX,
                clientY: ev.clientY,
              },
            };
          });
          return;
        }

        selectObject(newClickedObjects[0]);
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
      toggleDebug: () => setDebug(!callbackInputsRef.current.debug),
      toggleCameraMode: () => {
        const { cameraState: currentCameraState, saveConfig: currentSaveConfig } =
          callbackInputsRef.current;
        currentSaveConfig({
          cameraState: { ...currentCameraState, perspective: !currentCameraState.perspective },
        });
        if (currentCameraState.perspective) {
          interactionStateDispatch({ action: "reset" });
        }
      },
    };
  }, [handleEvent, interactionStateDispatch, selectObject]);

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
      "3": (ev) => {
        if (ev.metaKey || ev.ctrlKey) {
          return false;
        }
        toggleCameraMode();
        return true;
      },
      Escape: () => {
        setShowTopicTree(false);
        searchTextProps.toggleSearchTextOpen(false);
        if (document.activeElement && document.activeElement === containerRef.current) {
          (document.activeElement as HTMLElement).blur();
        }
      },
      t: () => {
        // Unpin before enabling keyboard toggle open/close.
        if (pinTopics) {
          saveConfig({ pinTopics: false });
          return;
        }
        setShowTopicTree((shown) => !shown);
      },
      f: (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          searchTextProps.toggleSearchTextOpen(true);
          if (!searchTextProps.searchInputRef.current) {
            return true;
          }
          searchTextProps.searchInputRef.current.select();
          return true;
        } else {
          return false;
        }
      },
    };
    return handlers;
  }, [pinTopics, saveConfig, searchTextProps, toggleCameraMode]);

  const markerProviders = useMemo(
    () => [gridBuilder, sceneBuilder, transformsBuilder, urdfBuilder],
    [gridBuilder, sceneBuilder, transformsBuilder, urdfBuilder],
  );

  const cursorType = isDrawing ? "crosshair" : "";

  // Memoize the threeDimensionalVizContextValue to avoid returning a new object every time
  const threeDimensionalVizContextValue = useMemo(
    () => ({
      setColorOverrideByVariable,
      setHoveredMarkerMatchers: setHoveredMarkerMatchersDebounced,
      colorOverrideByVariable: colorOverrideByVariable ?? {},
    }),
    [colorOverrideByVariable, setColorOverrideByVariable, setHoveredMarkerMatchersDebounced],
  );

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    width: containerWidth,
    height: containerHeight,
    ref: topicTreeSizeRef,
  } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  const theme = useTheme();
  const canvasBackgroundColor = useThemeBackgroundColor
    ? theme.palette.mode === "dark"
      ? "#000000"
      : "#303030"
    : customBackgroundColor;

  const loadModelOptions = useMemo(() => ({ ignoreColladaUpAxis }), [ignoreColladaUpAxis]);

  const [closedBanner, setClosedBanner] = useAppConfigurationValue<boolean>(
    AppSetting.CLOSED_OLD3D_DEPRECATION_BANNER,
  );
  const [showUpgradeConfirmDialog, setShowUpgradeConfirmDialog] = useState(false);

  const deprecationBanner =
    closedBanner === true ? undefined : (
      <Alert severity="info" color="warning" onClose={() => void setClosedBanner(true)}>
        The 3D (Legacy) panel is now deprecated.{" "}
        <Link color="inherit" onClick={() => setShowUpgradeConfirmDialog(true)}>
          Upgrade to the new 3D panel
        </Link>
        .
      </Alert>
    );

  const panelContext = useContext(PanelContext);
  const latestConfig = useLatest(config);
  const latestTransforms = useLatest(transforms);
  const upgradeConfirmDialog = useMemo(
    () => (
      <Dialog open={showUpgradeConfirmDialog} onClose={() => setShowUpgradeConfirmDialog(false)}>
        <DialogTitle>Upgrade to the new 3D panel?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            After upgrading this panel, you will need to reconfigure your selected topics.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowUpgradeConfirmDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              panelContext?.replacePanel("3D", {
                followTf: latestConfig.current.followTf,
                followMode:
                  latestConfig.current.followMode === "follow-orientation"
                    ? "follow-pose"
                    : latestConfig.current.followMode === "follow"
                    ? "follow-position"
                    : "follow-none",
                cameraState: {
                  ...latestConfig.current.cameraState,
                  phi: ((latestConfig.current.cameraState.phi ?? Math.PI / 3) * 180) / Math.PI,
                  thetaOffset:
                    ((latestConfig.current.cameraState.thetaOffset ?? 0) * 180) / Math.PI,
                  fovy: ((latestConfig.current.cameraState.fovy ?? Math.PI / 4) * 180) / Math.PI,
                },
                publish: {
                  poseTopic: latestConfig.current.clickToPublishPoseTopic,
                  pointTopic: latestConfig.current.clickToPublishPointTopic,
                  poseEstimateTopic: latestConfig.current.clickToPublishPoseEstimateTopic,
                  poseEstimateXDeviation: latestConfig.current.clickToPublishPoseEstimateXDeviation,
                  poseEstimateYDeviation: latestConfig.current.clickToPublishPoseEstimateYDeviation,
                  poseEstimateThetaDeviation:
                    latestConfig.current.clickToPublishPoseEstimateThetaDeviation,
                },
                topics: Object.fromEntries(
                  filterMap(latestConfig.current.checkedKeys, (key) =>
                    key.startsWith("t:")
                      ? [key.substring("t:".length), { visible: true }]
                      : undefined,
                  ),
                ),
                transforms: Object.fromEntries([
                  ...Array.from(latestTransforms.current.frames().keys(), (id) => [
                    `frame:${id}`,
                    { visible: false },
                  ]),
                  ...filterMap(latestConfig.current.checkedKeys, (key) =>
                    key.startsWith("ns:/tf:")
                      ? ["frame:" + key.substring("ns:/tf:".length), { visible: true }]
                      : undefined,
                  ),
                ]),
              });
              setShowUpgradeConfirmDialog(false);
            }}
          >
            Replace panel
          </Button>
        </DialogActions>
      </Dialog>
    ),
    [latestConfig, latestTransforms, panelContext, showUpgradeConfirmDialog],
  );

  return (
    <ThreeDimensionalVizContext.Provider value={threeDimensionalVizContextValue}>
      <TopicTreeContext.Provider value={topicTreeData}>
        <PanelToolbar helpContent={helpContent} />
        {deprecationBanner}
        {upgradeConfirmDialog}
        <div
          ref={containerRef}
          onClick={onControlsOverlayClick}
          tabIndex={-1}
          className={classes.container}
          style={{ cursor: cursorType }}
          data-testid="3dviz-layout"
        >
          <KeyListener keyDownHandlers={keyDownHandlers} />
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
                derivedCustomSettingsByKey={derivedCustomSettingsByKey}
                expandedKeys={expandedKeys}
                filterText={filterText}
                getIsNamespaceCheckedByDefault={getIsNamespaceCheckedByDefault}
                getIsTreeNodeVisibleInScene={getIsTreeNodeVisibleInScene}
                getIsTreeNodeVisibleInTree={getIsTreeNodeVisibleInTree}
                onExitTopicTreeFocus={onExitTopicTreeFocus}
                onNamespaceOverrideColorChange={onNamespaceOverrideColorChange}
                pinTopics={pinTopics}
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
          <div className={classes.world}>
            <World
              key={`${callbackInputsRef.current.autoSyncCameraState ? "synced" : "not-synced"}`}
              canvasBackgroundColor={canvasBackgroundColor}
              autoTextBackgroundColor={autoTextBackgroundColor}
              cameraState={cameraState}
              isPlaying={isPlaying}
              transforms={transforms}
              renderFrame={renderFrame}
              fixedFrame={fixedFrame}
              currentTime={currentTime}
              markerProviders={markerProviders}
              onCameraStateChange={onCameraStateChange}
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
              loadModelOptions={loadModelOptions}
            >
              {children}
              <div>
                <LayoutToolbar
                  addMouseEventHandler={addMouseEventHandler}
                  autoSyncCameraState={!!autoSyncCameraState}
                  cameraState={cameraState}
                  config={config}
                  currentTime={currentTime}
                  debug={debug}
                  fixedFrameId={fixedFrame.id}
                  followMode={followMode}
                  followTf={followTf}
                  interactionsTabType={interactionsTabType}
                  interactionState={interactionState}
                  interactionStateDispatch={interactionStateDispatch}
                  isPlaying={isPlaying}
                  onAlignXYAxis={onAlignXYAxis}
                  onCameraStateChange={onCameraStateChange}
                  onFollowChange={onFollowChange}
                  onToggleCameraMode={toggleCameraMode}
                  onToggleDebug={toggleDebug}
                  removeMouseEventHandler={removeMouseEventHandler}
                  renderFrameId={renderFrame.id}
                  saveConfig={saveConfig}
                  selectedObject={selectedObject}
                  setInteractionsTabType={setInteractionsTabType}
                  showCrosshair={showCrosshair}
                  transforms={transforms}
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
