// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { memoize } from "lodash";

import { CameraState, DEFAULT_CAMERA_STATE } from "@foxglove/regl-worldview";
import { Topic } from "@foxglove/studio";
import {
  SettingsTreeChildren,
  SettingsTreeFields,
  SettingsTreeNode,
} from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import {
  MARKER_ARRAY_DATATYPES,
  MARKER_DATATYPES,
  OCCUPANCY_GRID_DATATYPES,
  POINTCLOUD_DATATYPES,
  TF_DATATYPES,
  TRANSFORM_STAMPED_DATATYPES,
} from "./ros";

export type ThreeDeeRenderConfig = {
  cameraState: CameraState;
  enableStats: boolean;
  followTf: string | undefined;
  scene: {
    backgroundColor?: string;
  };
  topics: Record<string, Record<string, unknown> | undefined>;
};

export type SelectEntry = { label: string; value: string };

export type LayerSettingsMarker = {
  visible: boolean;
  color: string | undefined;
};

export type LayerSettingsOccupancyGrid = {
  visible: boolean;
  frameLock: boolean;
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

export const SUPPORTED_DATATYPES = new Set<string>();
mergeSetInto(SUPPORTED_DATATYPES, TRANSFORM_STAMPED_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, TF_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, MARKER_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, MARKER_ARRAY_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, OCCUPANCY_GRID_DATATYPES);
mergeSetInto(SUPPORTED_DATATYPES, POINTCLOUD_DATATYPES);

const ONE_DEGREE = Math.PI / 180;

const POINT_SHAPE_OPTIONS = [
  { label: "Circle", value: "circle" },
  { label: "Square", value: "square" },
];
const POINTCLOUD_REQUIRED_FIELDS = ["x", "y", "z"];
const COLOR_FIELDS = new Set<string>(["rgb", "rgba", "bgr", "bgra", "abgr", "color"]);
const INTENSITY_FIELDS = new Set<string>(["intensity", "i"]);

export type SettingsTreeOptions = {
  config: ThreeDeeRenderConfig;
  coordinateFrames: ReadonlyArray<SelectEntry>;
  followTf: string | undefined;
  topics: ReadonlyArray<Topic>;
  pclFieldsByTopic: Map<string, string[]>;
};

function buildTopicNode(
  topicConfigOrTopicName: string | Record<string, unknown>,
  topic: Topic,
  pclFieldsByTopic: Map<string, string[]>,
): undefined | SettingsTreeNode {
  const { datatype } = topic;
  if (
    !SUPPORTED_DATATYPES.has(datatype) ||
    TF_DATATYPES.has(datatype) ||
    TRANSFORM_STAMPED_DATATYPES.has(datatype)
  ) {
    return;
  }

  type SettingsTreeNodeWithFields = SettingsTreeNode & { fields: SettingsTreeFields };
  const topicConfig = typeof topicConfigOrTopicName === "string" ? {} : topicConfigOrTopicName;
  const visible = Boolean(topicConfig["visible"] ?? true);
  const node: SettingsTreeNodeWithFields = { label: topic.name, fields: {}, visible };

  if (MARKER_DATATYPES.has(datatype) || MARKER_ARRAY_DATATYPES.has(datatype)) {
    const cur = topicConfig as Partial<LayerSettingsMarker> | undefined;
    const color = cur?.color;
    node.fields.color = { label: "Color", input: "rgba", value: color };
  } else if (OCCUPANCY_GRID_DATATYPES.has(datatype)) {
    const cur = topicConfig as Partial<LayerSettingsOccupancyGrid> | undefined;
    const frameLock = cur?.frameLock ?? false;
    node.fields.frameLock = { label: "Frame lock", input: "boolean", value: frameLock };
  } else if (POINTCLOUD_DATATYPES.has(datatype)) {
    const cur = topicConfig as Partial<LayerSettingsPointCloud2> | undefined;
    const pclFields = pclFieldsByTopic.get(topic.name) ?? POINTCLOUD_REQUIRED_FIELDS;
    const pointSize = cur?.pointSize;
    const pointShape = cur?.pointShape ?? "circle";
    const decayTime = cur?.decayTime;
    const colorMode = cur?.colorMode ?? "flat";
    const flatColor = cur?.flatColor ?? "#ffffff";
    const colorField = cur?.colorField ?? bestColorByField(pclFields);
    const colorFieldOptions = pclFields.map((field) => ({ label: field, value: field }));
    // const gradient = cur?.gradient;
    const colorMap = cur?.colorMap ?? "turbo";
    const rgbByteOrder = cur?.rgbByteOrder ?? "rgba";
    const minValue = cur?.minValue;
    const maxValue = cur?.maxValue;

    node.fields.pointSize = {
      label: "Point size",
      input: "number",
      value: pointSize,
      placeholder: "2",
    };
    node.fields.pointShape = {
      label: "Point shape",
      input: "select",
      options: POINT_SHAPE_OPTIONS,
      value: pointShape,
    };
    node.fields.decayTime = {
      label: "Decay time",
      input: "number",
      value: decayTime,
      step: 0.5,
      placeholder: "0 seconds",
    };
    node.fields.colorMode = {
      label: "Color mode",
      input: "select",
      options: [
        { label: "Flat", value: "flat" },
        { label: "Color Map", value: "colormap" },
        { label: "Gradient", value: "gradient" },
        { label: "RGB", value: "rgb" },
        { label: "RGBA", value: "rgba" },
      ],
      value: colorMode,
    };
    if (colorMode === "flat") {
      node.fields.flatColor = { label: "Flat color", input: "rgba", value: flatColor };
    } else {
      node.fields.colorField = {
        label: "Color by",
        input: "select",
        options: colorFieldOptions,
        value: colorField,
      };

      switch (colorMode) {
        case "gradient":
          // node.fields.gradient = { label: "Gradient", input: "gradient", value: gradient };
          break;
        case "colormap":
          node.fields.colorMap = {
            label: "Color map",
            input: "select",
            options: [
              { label: "Turbo", value: "turbo" },
              { label: "Rainbow", value: "rainbow" },
              { label: "Gradient", value: "gradient" },
            ],
            value: colorMap,
          };
          break;
        case "rgb":
          node.fields.rgbByteOrder = {
            label: "RGB byte order",
            input: "select",
            options: [
              { label: "RGB", value: "rgba" },
              { label: "BGR", value: "bgra" },
              { label: "XBGR", value: "abgr" },
            ],
            value: rgbByteOrder,
          };
          break;
        case "rgba":
          node.fields.rgbByteOrder = {
            label: "RGBA byte order",
            input: "select",
            options: [
              { label: "RGBA", value: "rgba" },
              { label: "BGRA", value: "bgra" },
              { label: "ABGR", value: "abgr" },
            ],
            value: rgbByteOrder,
          };
          break;
      }

      node.fields.minValue = {
        label: "Value min",
        input: "number",
        value: minValue,
        placeholder: "auto",
      };
      node.fields.maxValue = {
        label: "Value max",
        input: "number",
        value: maxValue,
        placeholder: "auto",
      };
    }
  }

  return node;
}

const memoBuildTopicNode = memoize(buildTopicNode);

export function buildSettingsTree(options: SettingsTreeOptions): SettingsTreeNode {
  const { config, coordinateFrames, followTf, topics, pclFieldsByTopic } = options;
  const { cameraState, scene } = config;
  const { backgroundColor } = scene;

  const topicsChildren: SettingsTreeChildren = {};

  const sortedTopics = sorted(topics, (a, b) => a.name.localeCompare(b.name));
  for (const topic of sortedTopics) {
    // We key our memoized function by the first argument. Since the config
    // maybe be undefined we use the config or the topic name.
    const topicConfig = config.topics[topic.name] ?? topic.name;
    const newNode = memoBuildTopicNode(topicConfig, topic, pclFieldsByTopic);
    if (newNode) {
      topicsChildren[topic.name] = newNode;
    }
  }

  // prettier-ignore
  return {
    fields: {
      followTf: { label: "Coordinate frame", input: "select", options: coordinateFrames, value: followTf },
      enableStats: { label: "Enable stats", input: "boolean", value: config.enableStats },
    },
    children: {
      scene: {
        label: "Scene",
        fields: {
          backgroundColor: { label: "Color", input: "rgb", value: backgroundColor },
        },
      },
      cameraState: {
        label: "Camera",
        fields: {
          distance: { label: "Distance", input: "number", value: cameraState.distance, step: 1 },
          perspective: { label: "Perspective", input: "boolean", value: cameraState.perspective },
          targetOffset: { label: "Target", input: "vec3", labels: ["X", "Y", "Z"], value: cameraState.targetOffset },
          thetaOffset: { label: "Theta", input: "number", value: cameraState.thetaOffset, step: ONE_DEGREE },
          phi: { label: "Phi", input: "number", value: cameraState.phi, step: ONE_DEGREE },
          fovy: { label: "Y-Axis FOV", input: "number", value: cameraState.fovy, step: ONE_DEGREE },
          near: { label: "Near", input: "number", value: cameraState.near, step: DEFAULT_CAMERA_STATE.near },
          far: { label: "Far", input: "number", value: cameraState.far, step: 1 },
        },
      },
      topics: {
        label: "Topics",
        children: topicsChildren,
      },
    },
  };
}

function mergeSetInto(output: Set<string>, input: ReadonlySet<string>) {
  for (const value of input) {
    output.add(value);
  }
}

function sorted<T>(array: ReadonlyArray<T>, compare: (a: T, b: T) => number): Array<T> {
  return array.slice().sort(compare);
}

function bestColorByField(pclFields: string[]): string {
  for (const field of pclFields) {
    if (COLOR_FIELDS.has(field)) {
      return field;
    }
  }
  for (const field of pclFields) {
    if (INTENSITY_FIELDS.has(field)) {
      return field;
    }
  }
  return "x";
}
