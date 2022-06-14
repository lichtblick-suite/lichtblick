// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { v4 as uuidv4 } from "uuid";

import { CameraState, DEFAULT_CAMERA_STATE } from "@foxglove/regl-worldview";
import { Topic } from "@foxglove/studio";
import {
  SettingsTreeChildren,
  SettingsTreeNode,
  SettingsTreeRoots,
} from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import { NodeError } from "./LayerErrors";

export type LayerSettingsTransform = {
  visible: boolean;
};

export type SelectEntry = { label: string; value: string };

export type LayerSettingsMarkerNamespace = {
  visible: boolean;
};

export type LayerSettingsMarker = {
  visible: boolean;
  namespaces: Record<string, LayerSettingsMarkerNamespace>;
};

export type LayerSettingsOccupancyGrid = {
  visible: boolean;
  minColor: string;
  maxColor: string;
  unknownColor: string;
  invalidColor: string;
  frameLocked: boolean;
};

export type LayerSettingsPointCloud2 = {
  visible: boolean;
  pointSize: number;
  pointShape: "circle" | "square";
  decayTime: number;
  colorMode: "flat" | "gradient" | "colormap" | "rgb" | "rgba";
  flatColor: string;
  colorField: string | undefined;
  gradient: [string, string];
  colorMap: "turbo" | "rainbow";
  rgbByteOrder: "rgba" | "bgra" | "abgr";
  minValue: number | undefined;
  maxValue: number | undefined;
};

export type LayerSettingsPolygon = {
  visible: boolean;
  lineWidth: number;
  color: string;
};

export type LayerSettingsPose = {
  visible: boolean;
  scale: [number, number, number];
  color: string;
  showCovariance: boolean;
  covarianceColor: string;
};

export type LayerSettingsCameraInfo = {
  visible: boolean;
  distance: number;
  width: number;
  color: string;
};

export type LayerSettingsImage = {
  visible: boolean;
  cameraInfoTopic: string | undefined;
  distance: number;
  color: string;
};

export type CustomLayerSettings = {
  visible: boolean;
  label: string;
  type: LayerType;
};

export type LayerSettingsGrid = CustomLayerSettings & {
  type: LayerType.Grid;
  frameId: string | undefined;
  size: number;
  divisions: number;
  lineWidth: number;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

export type LayerSettings =
  | LayerSettingsMarker
  | LayerSettingsOccupancyGrid
  | LayerSettingsPointCloud2
  | LayerSettingsPose
  | LayerSettingsCameraInfo
  | LayerSettingsImage;

export enum LayerType {
  Transform,
  Marker,
  OccupancyGrid,
  PointCloud,
  Polygon,
  Pose,
  CameraInfo,
  Image,
  Grid,
}

export type ThreeDeeRenderConfig = {
  cameraState: CameraState;
  followTf: string | undefined;
  scene: {
    enableStats?: boolean;
    backgroundColor?: string;
  };
  transforms: Record<string, LayerSettingsTransform>;
  topics: Record<string, Record<string, unknown> | undefined>;
  layers: Record<string, CustomLayerSettings>;
};

export type SettingsNodeProvider = (
  topicConfig: Partial<LayerSettings>,
  topic: Topic,
) => SettingsTreeNode;

export const PRECISION_DISTANCE = 3; // [1mm]
export const PRECISION_DEGREES = 1;

const ONE_DEGREE = Math.PI / 180;

// This is the unused topic parameter passed to the SettingsNodeProvider for
// LayerType.Transform, since transforms do not map 1:1 to topics, and custom
// layers which do not have a topic name or datatype
const EMPTY_TOPIC = { name: "", datatype: "" };

const PATH_GENERAL = ["general"];
const PATH_SCENE = ["scene"];
const PATH_CAMERA_STATE = ["cameraState"];
const PATH_TRANSFORMS = ["transforms"];
const PATH_TOPICS = ["topics"];
const PATH_LAYERS = ["layers"];

export type SettingsTreeOptions = {
  config: ThreeDeeRenderConfig;
  coordinateFrames: ReadonlyArray<SelectEntry>;
  layerErrors: NodeError;
  followTf: string | undefined;
  topics: ReadonlyArray<Topic>;
  topicsToLayerTypes: Map<string, LayerType>;
  settingsNodeProviders: Map<LayerType, SettingsNodeProvider>;
};

function buildTransformNode(
  tfConfig: Partial<LayerSettingsTransform>,
  frameId: string,
  frameDisplayName: string,
  settingsNodeProvider: SettingsNodeProvider,
): undefined | SettingsTreeNode {
  const node = settingsNodeProvider(tfConfig, { name: frameId, datatype: "" });
  node.label ??= frameDisplayName;
  node.visible ??= tfConfig.visible ?? true;
  node.defaultExpansionState ??= "collapsed";
  return node;
}

function buildTopicNode(
  topicConfig: Partial<LayerSettings>,
  topic: Topic,
  layerType: LayerType,
  settingsNodeProvider: SettingsNodeProvider,
  coordinateFrames: ReadonlyArray<SelectEntry>,
): undefined | SettingsTreeNode {
  // Transform settings are handled elsewhere
  if (layerType === LayerType.Transform) {
    return;
  }

  const node = settingsNodeProvider(topicConfig, topic);
  node.label ??= topic.name;
  node.visible ??= topicConfig.visible ?? true;
  node.defaultExpansionState ??= "collapsed";

  // Populate coordinateFrames into options for the "frameId" field
  const frameIdField = node.fields?.["frameId"];
  if (frameIdField && frameIdField.input === "select") {
    frameIdField.options = [...frameIdField.options, ...coordinateFrames] as SelectEntry[];
  }

  return node;
}

function buildLayerNode(
  layer: CustomLayerSettings,
  settingsNodeProvider: SettingsNodeProvider,
  coordinateFrames: ReadonlyArray<SelectEntry>,
): undefined | SettingsTreeNode {
  const node = settingsNodeProvider(layer, EMPTY_TOPIC);
  node.label ??= layer.label;
  node.visible ??= layer.visible;
  node.defaultExpansionState ??= "collapsed";

  // Populate coordinateFrames into options for the "frameId" field
  const frameIdField = node.fields?.["frameId"];
  if (frameIdField && frameIdField.input === "select") {
    frameIdField.options = [...frameIdField.options, ...coordinateFrames] as SelectEntry[];
  }

  return node;
}

export function buildSettingsTree(options: SettingsTreeOptions): SettingsTreeRoots {
  const {
    config,
    coordinateFrames,
    layerErrors,
    followTf,
    topics,
    topicsToLayerTypes,
    settingsNodeProviders,
  } = options;
  const { cameraState, scene } = config;
  const { backgroundColor } = scene;

  // Build the settings tree for transforms
  const transformsChildren: SettingsTreeChildren = {};
  const tfSettingsNodeProvider = settingsNodeProviders.get(LayerType.Transform);
  if (tfSettingsNodeProvider != undefined) {
    for (const { label: frameName, value: frameId } of options.coordinateFrames) {
      const transformConfig = config.transforms[frameId] ?? {};
      const newNode = buildTransformNode(
        transformConfig,
        frameId,
        frameName,
        tfSettingsNodeProvider,
      );
      if (newNode) {
        newNode.error = layerErrors.errorAtPath(["transforms", frameId]);
        transformsChildren[frameId] = newNode;
      }
    }
  }

  // Build the settings tree for topics
  const topicsChildren: SettingsTreeChildren = {};
  const sortedTopics = sorted(topics, (a, b) => a.name.localeCompare(b.name));
  for (const topic of sortedTopics) {
    const layerType = topicsToLayerTypes.get(topic.name);
    if (layerType == undefined) {
      continue;
    }
    const settingsNodeProvider = settingsNodeProviders.get(layerType);
    if (settingsNodeProvider == undefined) {
      continue;
    }
    const topicConfig = config.topics[topic.name] ?? {};
    const newNode = buildTopicNode(
      topicConfig,
      topic,
      layerType,
      settingsNodeProvider,
      coordinateFrames,
    );
    if (newNode) {
      newNode.error = layerErrors.errorAtPath(["topics", topic.name]);
      topicsChildren[topic.name] = newNode;
    }
  }

  // Build the settings tree for custom layers
  const layersChildren: SettingsTreeChildren = {};
  for (const [layerId, layer] of Object.entries(config.layers)) {
    const layerType = layer.type;
    const settingsNodeProvider = settingsNodeProviders.get(layerType);
    if (settingsNodeProvider == undefined) {
      continue;
    }
    const newNode = buildLayerNode(layer, settingsNodeProvider, coordinateFrames);
    if (newNode) {
      newNode.error = layerErrors.errorAtPath(["layers", layerId]);
      newNode.actions ??= [];
      if (
        newNode.actions.find((action) => action.type === "action" && action.id === "delete") ==
        undefined
      ) {
        newNode.actions.push({ type: "action", id: "delete", label: "Delete" });
      }
      layersChildren[layerId] = newNode;
    }
  }

  return {
    general: {
      error: layerErrors.errorAtPath(PATH_GENERAL),
      label: "General",
      icon: "Settings",
      fields: {
        followTf: { label: "Frame", input: "select", options: coordinateFrames, value: followTf },
      },
    },
    scene: {
      error: layerErrors.errorAtPath(PATH_SCENE),
      label: "Scene",
      fields: {
        enableStats: { label: "Render stats", input: "boolean", value: config.scene.enableStats },
        backgroundColor: { label: "Color", input: "rgb", value: backgroundColor },
      },
      defaultExpansionState: "collapsed",
    },
    cameraState: {
      error: layerErrors.errorAtPath(PATH_CAMERA_STATE),
      label: "Camera",
      fields: {
        distance: { label: "Distance", input: "number", value: cameraState.distance, step: 1 },
        perspective: { label: "Perspective", input: "boolean", value: cameraState.perspective },
        targetOffset: {
          label: "Target",
          input: "vec3",
          labels: ["X", "Y", "Z"],
          value: cameraState.targetOffset,
        },
        thetaOffset: {
          label: "Theta",
          input: "number",
          value: cameraState.thetaOffset,
          step: ONE_DEGREE,
        },
        phi: { label: "Phi", input: "number", value: cameraState.phi, step: ONE_DEGREE },
        fovy: { label: "Y-Axis FOV", input: "number", value: cameraState.fovy, step: ONE_DEGREE },
        near: {
          label: "Near",
          input: "number",
          value: cameraState.near,
          step: DEFAULT_CAMERA_STATE.near,
        },
        far: { label: "Far", input: "number", value: cameraState.far, step: 1 },
      },
      defaultExpansionState: "collapsed",
    },
    transforms: {
      error: layerErrors.errorAtPath(PATH_TRANSFORMS),
      label: "Transforms",
      children: transformsChildren,
      defaultExpansionState: "expanded",
    },
    topics: {
      error: layerErrors.errorAtPath(PATH_TOPICS),
      label: "Topics",
      children: topicsChildren,
      defaultExpansionState: "expanded",
    },
    layers: {
      error: layerErrors.errorAtPath(PATH_LAYERS),
      label: "Custom Layers",
      children: layersChildren,
      defaultExpansionState: "expanded",
      actions: [{ type: "action", id: "add-grid " + uuidv4(), label: "Add Grid", icon: "Grid" }],
    },
  };
}

function sorted<T>(array: ReadonlyArray<T>, compare: (a: T, b: T) => number): Array<T> {
  return array.slice().sort(compare);
}
