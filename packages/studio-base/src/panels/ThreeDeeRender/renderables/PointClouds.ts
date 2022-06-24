// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeAction, SettingsTreeFields, SettingsTreeNode, Topic } from "@foxglove/studio";

import { DynamicBufferGeometry } from "../DynamicBufferGeometry";
import { MaterialCache, PointCloudColor } from "../MaterialCache";
import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { rgbaToCssString, stringToRgba } from "../color";
import { normalizeByteArray, normalizeHeader } from "../normalizeMessages";
import { PointCloud2, POINTCLOUD_DATATYPES, PointField, PointFieldType } from "../ros";
import { BaseSettings } from "../settings";
import { makePose } from "../transforms";
import { getColorConverter } from "./pointClouds/colors";
import { FieldReader, getReader } from "./pointClouds/fieldReaders";

export type LayerSettingsPointCloud2 = BaseSettings & {
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

const DEFAULT_POINT_SIZE = 1.5;
const DEFAULT_POINT_SHAPE = "circle";
const DEFAULT_COLOR_MAP = "turbo";
const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
const DEFAULT_MIN_COLOR = { r: 100, g: 47, b: 105, a: 1 };
const DEFAULT_MAX_COLOR = { r: 227, g: 177, b: 135, a: 1 };
const DEFAULT_RGB_BYTE_ORDER = "rgba";

const DEFAULT_SETTINGS: LayerSettingsPointCloud2 = {
  visible: true,
  pointSize: DEFAULT_POINT_SIZE,
  pointShape: DEFAULT_POINT_SHAPE,
  decayTime: 0,
  colorMode: "flat",
  flatColor: rgbaToCssString(DEFAULT_FLAT_COLOR),
  colorField: undefined,
  gradient: [rgbaToCssString(DEFAULT_MIN_COLOR), rgbaToCssString(DEFAULT_MAX_COLOR)],
  colorMap: DEFAULT_COLOR_MAP,
  rgbByteOrder: DEFAULT_RGB_BYTE_ORDER,
  minValue: undefined,
  maxValue: undefined,
};

const POINT_SHAPE_OPTIONS = [
  { label: "Circle", value: "circle" },
  { label: "Square", value: "square" },
];
const POINTCLOUD_REQUIRED_FIELDS = ["x", "y", "z"];

const COLOR_FIELDS = new Set<string>(["rgb", "rgba", "bgr", "bgra", "abgr", "color"]);
const INTENSITY_FIELDS = new Set<string>(["intensity", "i"]);

const INVALID_POINT_CLOUD = "INVALID_POINT_CLOUD";

const tempColor = { r: 0, g: 0, b: 0, a: 0 };

export type PointCloudUserData = BaseUserData & {
  settings: LayerSettingsPointCloud2;
  topic: string;
  pointCloud: PointCloud2;
  geometry: DynamicBufferGeometry<Float32Array, Float32ArrayConstructor>;
  points: THREE.Points;
  pickingMaterial: THREE.ShaderMaterial;
};

export class PointCloudRenderable extends Renderable<PointCloudUserData> {
  override dispose(): void {
    releasePointsMaterial(this.userData.settings, this.renderer.materialCache);
    this.userData.geometry.dispose();
    this.userData.pickingMaterial.dispose();
    super.dispose();
  }
}

export class PointClouds extends SceneExtension<PointCloudRenderable> {
  pointCloudFieldsByTopic = new Map<string, string[]>();

  constructor(renderer: Renderer) {
    super("foxglove.PointClouds", renderer);

    renderer.addDatatypeSubscriptions(POINTCLOUD_DATATYPES, this.handlePointCloud);
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (POINTCLOUD_DATATYPES.has(topic.datatype)) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsPointCloud2>;
        const node: SettingsTreeNodeWithActionHandler = settingsNode(
          this.pointCloudFieldsByTopic,
          config,
          topic,
        );
        node.handler = handler;
        entries.push({ path: ["topics", topic.name], node });
      }
    }
    return entries;
  }

  handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);

    // Update the renderable
    const topicName = path[1]!;
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      releasePointsMaterial(renderable.userData.settings, this.renderer.materialCache);
      const settings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsPointCloud2>
        | undefined;
      renderable.userData.settings = { ...renderable.userData.settings, ...settings };
      renderable.userData.points.material = pointsMaterial(
        renderable.userData.settings,
        this.renderer.materialCache,
      );
      this._updatePointCloudRenderable(
        renderable,
        renderable.userData.pointCloud,
        renderable.userData.receiveTime,
      );
    }
  };

  handlePointCloud = (messageEvent: PartialMessageEvent<PointCloud2>): void => {
    const topic = messageEvent.topic;
    const pointCloud = normalizePointCloud2(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPointCloud2>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };
      if (settings.colorField == undefined) {
        autoSelectColorField(settings, pointCloud);

        // Update user settings with the newly selected color field
        this.renderer.updateConfig((draft) => {
          const updatedUserSettings = { ...userSettings };
          updatedUserSettings.colorField = settings.colorField;
          updatedUserSettings.colorMode = settings.colorMode;
          updatedUserSettings.colorMap = settings.colorMap;
          draft.topics[topic] = updatedUserSettings;
        });
      }

      const geometry = new DynamicBufferGeometry(Float32Array);
      geometry.name = `${topic}:PointCloud2:geometry`;
      geometry.createAttribute("position", 3);
      geometry.createAttribute("color", 4);

      const material = pointsMaterial(settings, this.renderer.materialCache);
      const pickingMaterial = createPickingMaterial(settings);
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.name = `${topic}:PointCloud2:points`;
      points.userData.pickingMaterial = pickingMaterial;

      renderable = new PointCloudRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(pointCloud.header.stamp),
        frameId: pointCloud.header.frame_id,
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        pointCloud,
        geometry,
        points,
        pickingMaterial,
      });
      renderable.add(points);

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    // Update the mapping of topic to point cloud field names if necessary
    let fields = this.pointCloudFieldsByTopic.get(topic);
    if (!fields || fields.length !== pointCloud.fields.length) {
      fields = pointCloud.fields.map((field) => field.name);
      this.pointCloudFieldsByTopic.set(topic, fields);
      this.updateSettingsTree();
    }

    this._updatePointCloudRenderable(renderable, pointCloud, receiveTime);
  };

  _updatePointCloudRenderable(
    renderable: PointCloudRenderable,
    pointCloud: PointCloud2,
    receiveTime: bigint,
  ): void {
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(pointCloud.header.stamp);
    renderable.userData.frameId = pointCloud.header.frame_id;
    renderable.userData.pointCloud = pointCloud;

    const settings = renderable.userData.settings;
    const data = pointCloud.data;
    const pointCount = Math.trunc(data.length / pointCloud.point_step);

    // Invalid point cloud checks
    if (pointCloud.is_bigendian) {
      const message = `PointCloud2 is_bigendian=true is not supported`;
      invalidPointCloudError(this.renderer, renderable, message);
      return;
    } else if (data.length % pointCloud.point_step !== 0) {
      const message = `PointCloud2 data length ${data.length} is not a multiple of point_step ${pointCloud.point_step}`;
      invalidPointCloudError(this.renderer, renderable, message);
      return;
    } else if (pointCloud.fields.length === 0) {
      const message = `PointCloud2 has no fields`;
      invalidPointCloudError(this.renderer, renderable, message);
      return;
    } else if (data.length < pointCloud.height * pointCloud.row_step) {
      const message = `PointCloud2 data length ${data.length} is less than height ${pointCloud.height} * row_step ${pointCloud.row_step}`;
      this.renderer.settings.errors.addToTopic(
        renderable.userData.topic,
        INVALID_POINT_CLOUD,
        message,
      );
      // Allow this error for now since we currently ignore row_step
    } else if (pointCloud.width * pointCloud.point_step > pointCloud.row_step) {
      const message = `PointCloud2 width ${pointCloud.width} * point_step ${pointCloud.point_step} is greater than row_step ${pointCloud.row_step}`;
      this.renderer.settings.errors.addToTopic(
        renderable.userData.topic,
        INVALID_POINT_CLOUD,
        message,
      );
      // Allow this error for now since we currently ignore row_step
    }

    // Determine the minimum bytes needed per point based on offset/size of each
    // field, so we can ensure point_step is >= this value
    let minBytesPerPoint = 0;

    // Parse the fields and create typed readers for x/y/z and color
    let xReader: FieldReader | undefined;
    let yReader: FieldReader | undefined;
    let zReader: FieldReader | undefined;
    let colorReader: FieldReader | undefined;
    for (let i = 0; i < pointCloud.fields.length; i++) {
      const field = pointCloud.fields[i]!;

      if (field.count !== 1) {
        const message = `PointCloud2 field "${field.name}" has invalid count ${field.count}. Only 1 is supported`;
        invalidPointCloudError(this.renderer, renderable, message);
        return;
      } else if (field.offset < 0) {
        const message = `PointCloud2 field "${field.name}" has invalid offset ${field.offset}. Must be >= 0`;
        invalidPointCloudError(this.renderer, renderable, message);
        return;
      }

      if (field.name === "x") {
        xReader = getReader(field, pointCloud.point_step);
        if (!xReader) {
          const typeName = pointFieldTypeName(field.datatype);
          const message = `PointCloud2 field "x" is invalid. type=${typeName}, offset=${field.offset}, point_step=${pointCloud.point_step}`;
          invalidPointCloudError(this.renderer, renderable, message);
          return;
        }
      } else if (field.name === "y") {
        yReader = getReader(field, pointCloud.point_step);
        if (!yReader) {
          const typeName = pointFieldTypeName(field.datatype);
          const message = `PointCloud2 field "y" is invalid. type=${typeName}, offset=${field.offset}, point_step=${pointCloud.point_step}`;
          invalidPointCloudError(this.renderer, renderable, message);
          return;
        }
      } else if (field.name === "z") {
        zReader = getReader(field, pointCloud.point_step);
        if (!zReader) {
          const typeName = pointFieldTypeName(field.datatype);
          const message = `PointCloud2 field "z" is invalid. type=${typeName}, offset=${field.offset}, point_step=${pointCloud.point_step}`;
          invalidPointCloudError(this.renderer, renderable, message);
          return;
        }
      }

      const byteWidth = pointFieldWidth(field.datatype);
      minBytesPerPoint = Math.max(minBytesPerPoint, field.offset + byteWidth);

      if (field.name === settings.colorField) {
        // If the selected color mode is rgb/rgba and the field only has one channel with at least a
        // four byte width, force the color data to be interpreted as four individual bytes. This
        // overcomes a common problem where the color field data type is set to float32 or something
        // other than uint32
        const forceType =
          (settings.colorMode === "rgb" || settings.colorMode === "rgba") && byteWidth >= 4
            ? PointFieldType.UINT32
            : undefined;
        colorReader = getReader(field, pointCloud.point_step, forceType);
        if (!colorReader) {
          const typeName = pointFieldTypeName(field.datatype);
          const message = `PointCloud2 field "${field.name}" is invalid. type=${typeName}, offset=${field.offset}, point_step=${pointCloud.point_step}`;
          invalidPointCloudError(this.renderer, renderable, message);
          return;
        }
      }
    }

    if (minBytesPerPoint > pointCloud.point_step) {
      const message = `PointCloud2 point_step ${pointCloud.point_step} is less than minimum bytes per point ${minBytesPerPoint}`;
      invalidPointCloudError(this.renderer, renderable, message);
      return;
    }

    const positionReaderCount = (xReader ? 1 : 0) + (yReader ? 1 : 0) + (zReader ? 1 : 0);
    if (positionReaderCount < 2) {
      const message = `PointCloud2 must contain at least two of x/y/z fields`;
      invalidPointCloudError(this.renderer, renderable, message);
      return;
    }

    colorReader ??= xReader ?? yReader ?? zReader ?? zeroReader;
    xReader ??= zeroReader;
    yReader ??= zeroReader;
    zReader ??= zeroReader;

    const geometry = renderable.userData.geometry;
    geometry.resize(pointCount);
    const positionAttribute = geometry.attributes.position!;
    const colorAttribute = geometry.attributes.color!;

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    // Iterate the point cloud data to determine min/max color values (if needed)
    let minColorValue = settings.minValue ?? Number.POSITIVE_INFINITY;
    let maxColorValue = settings.maxValue ?? Number.NEGATIVE_INFINITY;
    if (settings.minValue == undefined || settings.maxValue == undefined) {
      for (let i = 0; i < pointCount; i++) {
        const pointOffset = i * pointCloud.point_step;
        const colorValue = colorReader!(view, pointOffset);
        minColorValue = Math.min(minColorValue, colorValue);
        maxColorValue = Math.max(maxColorValue, colorValue);
      }
      minColorValue = settings.minValue ?? minColorValue;
      maxColorValue = settings.maxValue ?? maxColorValue;
    }

    // Build a method to convert raw color field values to RGBA
    const colorConverter = getColorConverter(settings, minColorValue, maxColorValue);

    // Iterate the point cloud data to update position and color attributes
    for (let i = 0; i < pointCount; i++) {
      const pointOffset = i * pointCloud.point_step;

      // Update position attribute
      const x = xReader(view, pointOffset);
      const y = yReader(view, pointOffset);
      const z = zReader(view, pointOffset);
      positionAttribute.setXYZ(i, x, y, z);

      // Update color attribute
      const colorValue = colorReader!(view, pointOffset);
      colorConverter(tempColor, colorValue);
      colorAttribute.setXYZW(i, tempColor.r, tempColor.g, tempColor.b, tempColor.a);
    }

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  }
}

function pointsMaterial(
  settings: LayerSettingsPointCloud2,
  materialCache: MaterialCache,
): THREE.PointsMaterial {
  const transparent = pointCloudHasTransparency(settings);
  const encoding = pointCloudColorEncoding(settings);
  const scale = settings.pointSize;
  return materialCache.acquire(
    PointCloudColor.id(settings.pointShape, encoding, scale, transparent),
    () => PointCloudColor.create(settings.pointShape, encoding, scale, transparent),
    PointCloudColor.dispose,
  );
}

function releasePointsMaterial(
  settings: LayerSettingsPointCloud2,
  materialCache: MaterialCache,
): void {
  const transparent = pointCloudHasTransparency(settings);
  const encoding = pointCloudColorEncoding(settings);
  const scale = settings.pointSize;
  materialCache.release(PointCloudColor.id(settings.pointShape, encoding, scale, transparent));
}

function createPickingMaterial(settings: LayerSettingsPointCloud2): THREE.ShaderMaterial {
  const MIN_PICKING_POINT_SIZE = 8;

  // Use a custom shader for picking that sets a minimum point size to make
  // individual points easier to click on
  const pointSize = Math.max(settings.pointSize, MIN_PICKING_POINT_SIZE);
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform float pointSize;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pointSize;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec4 objectId;
      void main() {
        gl_FragColor = objectId;
      }
    `,
    side: THREE.DoubleSide,
    uniforms: { pointSize: { value: pointSize }, objectId: { value: [NaN, NaN, NaN, NaN] } },
  });
}

function pointCloudHasTransparency(settings: LayerSettingsPointCloud2): boolean {
  switch (settings.colorMode) {
    case "flat":
      return stringToRgba(tempColor, settings.flatColor).a < 1.0;
    case "gradient":
      return (
        stringToRgba(tempColor, settings.gradient[0]).a < 1.0 ||
        stringToRgba(tempColor, settings.gradient[1]).a < 1.0
      );
    case "colormap":
    case "rgb":
      return false;
    case "rgba":
      // It's too expensive to check the alpha value of each color. Just assume it's transparent
      return true;
  }
}

function pointCloudColorEncoding(settings: LayerSettingsPointCloud2): "srgb" | "linear" {
  switch (settings.colorMode) {
    case "flat":
    case "colormap":
    case "gradient":
      return "linear";
    case "rgb":
    case "rgba":
      return "srgb";
  }
}

function autoSelectColorField(output: LayerSettingsPointCloud2, pointCloud: PointCloud2): void {
  // Prefer color fields first
  for (const field of pointCloud.fields) {
    const fieldNameLower = field.name.toLowerCase();
    if (COLOR_FIELDS.has(fieldNameLower)) {
      output.colorField = field.name;
      switch (fieldNameLower) {
        case "rgb":
          output.colorMode = "rgb";
          // PointCloud2 messages follow a convention of obeying `is_bigendian`
          // for the byte ordering of rgb/rgba fields
          output.rgbByteOrder = pointCloud.is_bigendian ? "rgba" : "abgr";
          break;
        default:
        case "rgba":
          output.colorMode = "rgba";
          output.rgbByteOrder = pointCloud.is_bigendian ? "rgba" : "abgr";
          break;
        case "bgr":
          output.colorMode = "rgb";
          output.rgbByteOrder = "bgra";
          break;
        case "bgra":
          output.colorMode = "rgba";
          output.rgbByteOrder = "bgra";
          break;
        case "abgr":
          output.colorMode = "rgba";
          output.rgbByteOrder = "abgr";
          break;
      }
      return;
    }
  }

  // Intensity fields are second priority
  for (const field of pointCloud.fields) {
    if (INTENSITY_FIELDS.has(field.name)) {
      output.colorField = field.name;
      output.colorMode = "colormap";
      output.colorMap = "turbo";
      return;
    }
  }

  // Fall back to using the first point cloud field
  if (pointCloud.fields.length > 0) {
    const firstField = pointCloud.fields[0]!;
    output.colorField = firstField.name;
    output.colorMode = "colormap";
    output.colorMap = "turbo";
    return;
  }
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

function settingsNode(
  pclFieldsByTopic: Map<string, string[]>,
  config: Partial<LayerSettingsPointCloud2>,
  topic: Topic,
): SettingsTreeNode {
  const pclFields = pclFieldsByTopic.get(topic.name) ?? POINTCLOUD_REQUIRED_FIELDS;
  const pointSize = config.pointSize;
  const pointShape = config.pointShape ?? "circle";
  const decayTime = config.decayTime;
  const colorMode = config.colorMode ?? "flat";
  const flatColor = config.flatColor ?? "#ffffff";
  const colorField = config.colorField ?? bestColorByField(pclFields);
  const colorFieldOptions = pclFields.map((field) => ({ label: field, value: field }));
  const gradient = config.gradient;
  const colorMap = config.colorMap ?? "turbo";
  const rgbByteOrder = config.rgbByteOrder ?? "rgba";
  const minValue = config.minValue;
  const maxValue = config.maxValue;

  const fields: SettingsTreeFields = {};
  fields.pointSize = {
    label: "Point size",
    input: "number",
    step: 1,
    placeholder: "2",
    precision: 2,
    value: pointSize,
  };
  fields.pointShape = {
    label: "Point shape",
    input: "select",
    options: POINT_SHAPE_OPTIONS,
    value: pointShape,
  };
  fields.decayTime = {
    label: "Decay time",
    input: "number",
    step: 0.5,
    placeholder: "0 seconds",
    precision: 3,
    value: decayTime,
  };
  fields.colorMode = {
    label: "Color mode",
    input: "select",
    options: [
      { label: "Flat", value: "flat" },
      { label: "Color map", value: "colormap" },
      { label: "Gradient", value: "gradient" },
      { label: "RGB", value: "rgb" },
      { label: "RGBA", value: "rgba" },
    ],
    value: colorMode,
  };
  if (colorMode === "flat") {
    fields.flatColor = { label: "Flat color", input: "rgba", value: flatColor };
  } else {
    fields.colorField = {
      label: "Color by",
      input: "select",
      options: colorFieldOptions,
      value: colorField,
    };

    switch (colorMode) {
      case "gradient":
        fields.gradient = {
          label: "Gradient",
          input: "gradient",
          value: gradient ?? DEFAULT_SETTINGS.gradient,
        };
        break;
      case "colormap":
        fields.colorMap = {
          label: "Color map",
          input: "select",
          options: [
            { label: "Turbo", value: "turbo" },
            { label: "Rainbow", value: "rainbow" },
          ],
          value: colorMap,
        };
        break;
      case "rgb":
        fields.rgbByteOrder = {
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
        fields.rgbByteOrder = {
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

    fields.minValue = {
      label: "Value min",
      input: "number",
      placeholder: "auto",
      precision: 4,
      value: minValue,
    };
    fields.maxValue = {
      label: "Value max",
      input: "number",
      placeholder: "auto",
      precision: 4,
      value: maxValue,
    };
  }

  return {
    icon: "Points",
    fields,
    order: topic.name.toLocaleLowerCase(),
    visible: config.visible ?? true,
  };
}

function pointFieldTypeName(type: PointFieldType): string {
  return PointFieldType[type] ?? `${type}`;
}

function pointFieldWidth(type: PointFieldType): number {
  switch (type) {
    case PointFieldType.INT8:
    case PointFieldType.UINT8:
      return 1;
    case PointFieldType.INT16:
    case PointFieldType.UINT16:
      return 2;
    case PointFieldType.INT32:
    case PointFieldType.UINT32:
    case PointFieldType.FLOAT32:
      return 4;
    case PointFieldType.FLOAT64:
      return 8;
    default:
      return 0;
  }
}

function invalidPointCloudError(
  renderer: Renderer,
  renderable: PointCloudRenderable,
  message: string,
): void {
  renderer.settings.errors.addToTopic(renderable.userData.topic, INVALID_POINT_CLOUD, message);
  renderable.userData.geometry.resize(0);
}

function zeroReader(): number {
  return 0;
}

function normalizePointField(field: PartialMessage<PointField> | undefined): PointField {
  if (!field) {
    return { name: "", offset: 0, datatype: PointFieldType.UNKNOWN, count: 0 };
  }
  return {
    name: field.name ?? "",
    offset: field.offset ?? 0,
    datatype: field.datatype ?? PointFieldType.UNKNOWN,
    count: field.count ?? 0,
  };
}

function normalizePointCloud2(message: PartialMessage<PointCloud2>): PointCloud2 {
  return {
    header: normalizeHeader(message.header),
    height: message.height ?? 0,
    width: message.width ?? 0,
    fields: message.fields?.map(normalizePointField) ?? [],
    is_bigendian: message.is_bigendian ?? false,
    point_step: message.point_step ?? 0,
    row_step: message.row_step ?? 0,
    data: normalizeByteArray(message.data),
    is_dense: message.is_dense ?? false,
  };
}
