// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { Time, toNanoSec } from "@foxglove/rostime";
import {
  LaserScan as FoxgloveLaserScan,
  NumericType,
  PackedElementField,
  PointCloud,
} from "@foxglove/schemas";
import { SettingsTreeAction, SettingsTreeFields, SettingsTreeNode, Topic } from "@foxglove/studio";
import type { RosObject, RosValue } from "@foxglove/studio-base/players/types";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

import { DynamicBufferGeometry } from "../DynamicBufferGeometry";
import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { rgbaToCssString } from "../color";
import {
  LASERSCAN_DATATYPES as FOXGLOVE_LASERSCAN_DATATYPES,
  POINTCLOUD_DATATYPES as FOXGLOVE_POINTCLOUD_DATATYPES,
} from "../foxglove";
import {
  normalizeByteArray,
  normalizeHeader,
  normalizeFloat32Array,
  normalizeTime,
  normalizePose,
  numericTypeToPointFieldType,
} from "../normalizeMessages";
import {
  LASERSCAN_DATATYPES as ROS_LASERSCAN_DATATYPES,
  LaserScan as RosLaserScan,
  PointCloud2,
  POINTCLOUD_DATATYPES as ROS_POINTCLOUD_DATATYPES,
  PointField,
  PointFieldType,
} from "../ros";
import { BaseSettings } from "../settings";
import { makePose, MAX_DURATION, Pose } from "../transforms";
import { updatePose } from "../updatePose";
import {
  bestColorByField,
  colorHasTransparency,
  ColorModeSettings,
  COLOR_FIELDS,
  getColorConverter,
  INTENSITY_FIELDS,
} from "./pointClouds/colors";
import { FieldReader, getReader } from "./pointClouds/fieldReaders";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

export type LayerSettingsPointCloudAndLaserScan = BaseSettings &
  ColorModeSettings & {
    pointSize: number;
    pointShape: "circle" | "square";
    decayTime: number;
  };

type Material = THREE.PointsMaterial | LaserScanMaterial;
type Points = THREE.Points<DynamicBufferGeometry, Material>;
type PointsAtTime = { receiveTime: bigint; messageTime: bigint; points: Points };

type PointCloudFieldReaders = {
  xReader: FieldReader;
  yReader: FieldReader;
  zReader: FieldReader;
  colorReader: FieldReader;
};

type NormalizedLaserScan = {
  timestamp: Time;
  frame_id: string;
  pose: Pose;
  start_angle: number;
  end_angle: number;
  range_min: number;
  range_max: number;
  ranges: Float32Array;
  intensities: Float32Array;
};

type PointCloudAndLaserScanUserData = BaseUserData & {
  settings: LayerSettingsPointCloudAndLaserScan;
  topic: string;
  pointCloud?: PointCloud | PointCloud2;
  laserScan?: NormalizedLaserScan;
  originalMessage: Record<string, RosValue> | undefined;
  pointsHistory: PointsAtTime[];
  material: Material;
  pickingMaterial: THREE.ShaderMaterial | LaserScanMaterial;
  instancePickingMaterial: THREE.ShaderMaterial | LaserScanMaterial;
};

const DEFAULT_POINT_SIZE = 1.5;
const DEFAULT_POINT_SHAPE = "circle";
const DEFAULT_COLOR_MAP = "turbo";
const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
const DEFAULT_MIN_COLOR = { r: 100, g: 47, b: 105, a: 1 };
const DEFAULT_MAX_COLOR = { r: 227, g: 177, b: 135, a: 1 };
const DEFAULT_RGB_BYTE_ORDER = "rgba";
const NEEDS_MIN_MAX = ["gradient", "colormap"];

export const DEFAULT_SETTINGS: LayerSettingsPointCloudAndLaserScan = {
  visible: false,
  frameLocked: false,
  pointSize: DEFAULT_POINT_SIZE,
  pointShape: DEFAULT_POINT_SHAPE,
  decayTime: 0,
  colorMode: "flat",
  flatColor: rgbaToCssString(DEFAULT_FLAT_COLOR),
  colorField: undefined,
  gradient: [rgbaToCssString(DEFAULT_MIN_COLOR), rgbaToCssString(DEFAULT_MAX_COLOR)],
  colorMap: DEFAULT_COLOR_MAP,
  explicitAlpha: 1,
  rgbByteOrder: DEFAULT_RGB_BYTE_ORDER,
  minValue: undefined,
  maxValue: undefined,
};

const ALL_POINTCLOUD_DATATYPES = new Set<string>([
  ...FOXGLOVE_POINTCLOUD_DATATYPES,
  ...ROS_POINTCLOUD_DATATYPES,
]);
const ALL_LASERSCAN_DATATYPES = new Set<string>([
  ...FOXGLOVE_LASERSCAN_DATATYPES,
  ...ROS_LASERSCAN_DATATYPES,
]);
const POINT_SHAPE_OPTIONS = [
  { label: "Circle", value: "circle" },
  { label: "Square", value: "square" },
];
const POINTCLOUD_REQUIRED_FIELDS = ["x", "y", "z"];
const LASERSCAN_FIELDS = ["range", "intensity"];

const INVALID_POINTCLOUD_OR_LASERSCAN = "INVALID_POINTCLOUD_OR_LASERSCAN";

const VEC3_ZERO = new THREE.Vector3();

// Fragment shader chunk to convert sRGB to linear RGB. This is used by some
// PointCloud materials to avoid expensive per-point colorspace conversion on
// the CPU. Source: <https://github.com/mrdoob/three.js/blob/13b67d96/src/renderers/shaders/ShaderChunk/encodings_pars_fragment.glsl.js#L16-L18>
const FS_SRGB_TO_LINEAR = /* glsl */ `
vec3 sRGBToLinear(in vec3 value) {
	return vec3(mix(
    pow(value.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)),
    value.rgb * 0.0773993808,
    vec3(lessThanEqual(value.rgb, vec3(0.04045)))
  ));
}

vec4 sRGBToLinear(in vec4 value) {
  return vec4(sRGBToLinear(value.rgb), value.a);
}
`;

// Fragment shader chunk to convert sRGB to linear RGB
const FS_POINTCLOUD_SRGB_TO_LINEAR = /* glsl */ `
outgoingLight = sRGBToLinear(outgoingLight);
`;

// Fragment shader chunk to render a GL_POINT as a circle
const FS_POINTCLOUD_CIRCLE = /* glsl */ `
vec2 cxy = 2.0 * gl_PointCoord - 1.0;
if (dot(cxy, cxy) > 1.0) { discard; }
`;

const tempColor = { r: 0, g: 0, b: 0, a: 0 };
const tempMinMaxColor: THREE.Vector2Tuple = [0, 0];
const tempFieldReaders: PointCloudFieldReaders = {
  xReader: zeroReader,
  yReader: zeroReader,
  zReader: zeroReader,
  colorReader: zeroReader,
};

export function createGeometry(topic: string, usage: THREE.Usage): DynamicBufferGeometry {
  const geometry = new DynamicBufferGeometry(usage);
  geometry.name = `${topic}:PointCloud:geometry`;
  geometry.createAttribute("position", Float32Array, 3);
  geometry.createAttribute("color", Uint8Array, 4, true);
  return geometry;
}

export class PointCloudAndLaserScanRenderable extends Renderable<PointCloudAndLaserScanUserData> {
  public override pickableInstances = true;

  public override dispose(): void {
    this.userData.pointCloud = undefined;
    this.userData.laserScan = undefined;
    this.userData.originalMessage = undefined;
    for (const entry of this.userData.pointsHistory) {
      entry.points.geometry.dispose();
    }
    this.userData.pointsHistory.length = 0;
    this.userData.material.dispose();
    this.userData.pickingMaterial.dispose();
    this.userData.instancePickingMaterial.dispose();
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.originalMessage ?? {};
  }

  public override instanceDetails(instanceId: number): Record<string, RosValue> | undefined {
    if (this.userData.pointCloud) {
      const pointCloud = this.userData.pointCloud;
      const data = pointCloud.data;
      const stride = getStride(pointCloud);
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const pointStep = getStride(pointCloud);
      const details: Record<string, RosValue> = {};

      for (const field of pointCloud.fields) {
        const pointOffset = instanceId * pointStep;
        const reader = getReader(field, stride);
        details[field.name] = reader?.(view, pointOffset);
      }

      return details;
    } else if (this.userData.laserScan) {
      const range =
        instanceId >= 0 && instanceId < this.userData.laserScan.ranges.length
          ? this.userData.laserScan.ranges[instanceId]
          : undefined;
      const intensity =
        instanceId >= 0 && instanceId < this.userData.laserScan.intensities.length
          ? this.userData.laserScan.intensities[instanceId]
          : undefined;
      return { range, intensity };
    } else {
      return undefined;
    }
  }

  public updatePointCloud(
    this: PointCloudAndLaserScanRenderable,
    pointCloud: PointCloud | PointCloud2,
    originalMessage: RosObject | undefined,
    settings: LayerSettingsPointCloudAndLaserScan,
    receiveTime: bigint,
  ): void {
    const messageTime = toNanoSec(getTimestamp(pointCloud));
    this.userData.receiveTime = receiveTime;
    this.userData.messageTime = messageTime;
    this.userData.frameId = this.renderer.normalizeFrameId(getFrameId(pointCloud));
    this.userData.pointCloud = pointCloud;
    this.userData.laserScan = undefined;
    this.userData.originalMessage = originalMessage;

    const prevSettings = this.userData.settings;
    this.userData.settings = settings;

    let material = this.userData.material as THREE.PointsMaterial;
    const needsRebuild =
      colorHasTransparency(settings) !== material.transparent ||
      pointCloudColorEncoding(settings) !== pointCloudColorEncoding(prevSettings) ||
      settings.pointShape !== prevSettings.pointShape;

    if (needsRebuild) {
      material.dispose();
      material = pointCloudMaterial(settings);
      this.userData.material = material;
      for (const entry of this.userData.pointsHistory) {
        entry.points.material = material;
      }
    } else {
      material.size = settings.pointSize;
    }

    // Invalid point cloud checks
    if (!this._validatePointCloud(pointCloud, this)) {
      return;
    }

    // Parse the fields and create typed readers for x/y/z and color
    if (!this._getPointCloudFieldReaders(tempFieldReaders, pointCloud, this, settings)) {
      return;
    }

    const topic = this.userData.topic;
    const pointsHistory = this.userData.pointsHistory;
    const isDecay = settings.decayTime > 0;
    if (isDecay) {
      // Push a new (empty) entry to the history of points
      const geometry = createGeometry(topic, THREE.StaticDrawUsage);
      const points = createPoints(
        topic,
        getPose(pointCloud),
        geometry,
        material,
        this.userData.pickingMaterial,
        undefined,
      );
      pointsHistory.push({ receiveTime, messageTime, points });
      this.add(points);
    }

    const latestEntry = pointsHistory[pointsHistory.length - 1];
    if (!latestEntry) {
      throw new Error(`pointsHistory is empty for ${topic}`);
    }

    latestEntry.receiveTime = receiveTime;
    latestEntry.messageTime = messageTime;

    const pointCount = Math.trunc(pointCloud.data.length / getStride(pointCloud));
    latestEntry.points.geometry.resize(pointCount);
    const positionAttribute = latestEntry.points.geometry.attributes.position!;
    const colorAttribute = latestEntry.points.geometry.attributes.color!;

    // Iterate the point cloud data to update position and color attributes
    this._updatePointCloudBuffers(
      pointCloud,
      tempFieldReaders,
      pointCount,
      settings,
      positionAttribute,
      colorAttribute,
    );
  }

  private _validatePointCloud(
    pointCloud: PointCloud | PointCloud2,
    renderable: PointCloudAndLaserScanRenderable,
  ): boolean {
    const maybeRos = pointCloud as Partial<PointCloud2>;
    return maybeRos.header
      ? this._validateRosPointCloud(pointCloud as PointCloud2, renderable)
      : this._validateFoxglovePointCloud(pointCloud as PointCloud, renderable);
  }

  private _validateFoxglovePointCloud(
    pointCloud: PointCloud,
    renderable: PointCloudAndLaserScanRenderable,
  ): boolean {
    const data = pointCloud.data;

    if (data.length % pointCloud.point_stride !== 0) {
      const message = `PointCloud data length ${data.length} is not a multiple of point_stride ${pointCloud.point_stride}`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return false;
    }

    if (pointCloud.fields.length === 0) {
      const message = `PointCloud has no fields`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return false;
    }

    return true;
  }

  private _validateRosPointCloud(
    pointCloud: PointCloud2,
    renderable: PointCloudAndLaserScanRenderable,
  ): boolean {
    const data = pointCloud.data;

    if (pointCloud.is_bigendian) {
      const message = `PointCloud2 is_bigendian=true is not supported`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return false;
    }

    if (data.length % pointCloud.point_step !== 0) {
      const message = `PointCloud2 data length ${data.length} is not a multiple of point_step ${pointCloud.point_step}`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return false;
    }

    if (pointCloud.fields.length === 0) {
      const message = `PointCloud2 has no fields`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return false;
    }

    if (data.length < pointCloud.height * pointCloud.row_step) {
      const message = `PointCloud2 data length ${data.length} is less than height ${pointCloud.height} * row_step ${pointCloud.row_step}`;
      this.renderer.settings.errors.addToTopic(
        renderable.userData.topic,
        INVALID_POINTCLOUD_OR_LASERSCAN,
        message,
      );
      // Allow this error for now since we currently ignore row_step
    }

    if (pointCloud.width * pointCloud.point_step > pointCloud.row_step) {
      const message = `PointCloud2 width ${pointCloud.width} * point_step ${pointCloud.point_step} is greater than row_step ${pointCloud.row_step}`;
      this.renderer.settings.errors.addToTopic(
        renderable.userData.topic,
        INVALID_POINTCLOUD_OR_LASERSCAN,
        message,
      );
      // Allow this error for now since we currently ignore row_step
    }

    return true;
  }

  private _getPointCloudFieldReaders(
    output: PointCloudFieldReaders,
    pointCloud: PointCloud | PointCloud2,
    renderable: PointCloudAndLaserScanRenderable,
    settings: LayerSettingsPointCloudAndLaserScan,
  ): boolean {
    let xReader: FieldReader | undefined;
    let yReader: FieldReader | undefined;
    let zReader: FieldReader | undefined;
    let colorReader: FieldReader | undefined;

    const stride = getStride(pointCloud);

    // Determine the minimum bytes needed per point based on offset/size of each
    // field, so we can ensure point_step is >= this value
    let minBytesPerPoint = 0;

    for (let i = 0; i < pointCloud.fields.length; i++) {
      const field = pointCloud.fields[i]!;
      const count = (field as Partial<PointField>).count;
      const numericType = (field as Partial<PackedElementField>).type;
      const type =
        numericType != undefined
          ? numericTypeToPointFieldType(numericType)
          : (field as PointField).datatype;

      if (count != undefined && count !== 1) {
        const message = `PointCloud field "${field.name}" has invalid count ${count}. Only 1 is supported`;
        invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
        return false;
      } else if (field.offset < 0) {
        const message = `PointCloud field "${field.name}" has invalid offset ${field.offset}. Must be >= 0`;
        invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
        return false;
      }

      if (field.name === "x") {
        xReader = getReader(field, stride);
        if (!xReader) {
          const typeName = pointFieldTypeName(type);
          const message = `PointCloud field "x" is invalid. type=${typeName}, offset=${field.offset}, stride=${stride}`;
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
          return false;
        }
      } else if (field.name === "y") {
        yReader = getReader(field, stride);
        if (!yReader) {
          const typeName = pointFieldTypeName(type);
          const message = `PointCloud field "y" is invalid. type=${typeName}, offset=${field.offset}, stride=${stride}`;
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
          return false;
        }
      } else if (field.name === "z") {
        zReader = getReader(field, stride);
        if (!zReader) {
          const typeName = pointFieldTypeName(type);
          const message = `PointCloud field "z" is invalid. type=${typeName}, offset=${field.offset}, stride=${stride}`;
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
          return false;
        }
      }

      const byteWidth = pointFieldWidth(type);
      minBytesPerPoint = Math.max(minBytesPerPoint, field.offset + byteWidth);

      if (field.name === settings.colorField) {
        // If the selected color mode is rgb/rgba and the field only has one channel with at least a
        // four byte width, force the color data to be interpreted as four individual bytes. This
        // overcomes a common problem where the color field data type is set to float32 or something
        // other than uint32
        const forceType =
          (settings.colorMode === "rgb" || settings.colorMode === "rgba") && byteWidth >= 4
            ? numericType != undefined
              ? NumericType.UINT32
              : PointFieldType.UINT32
            : undefined;
        colorReader = getReader(field, stride, forceType);
        if (!colorReader) {
          const typeName = pointFieldTypeName(type);
          const message = `PointCloud field "${field.name}" is invalid. type=${typeName}, offset=${field.offset}, stride=${stride}`;
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
          return false;
        }
      }
    }

    if (minBytesPerPoint > stride) {
      const message = `PointCloud stride ${stride} is less than minimum bytes per point ${minBytesPerPoint}`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return false;
    }

    const positionReaderCount = (xReader ? 1 : 0) + (yReader ? 1 : 0) + (zReader ? 1 : 0);
    if (positionReaderCount < 2) {
      const message = `PointCloud must contain at least two of x/y/z fields`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return false;
    }

    output.xReader = xReader ?? zeroReader;
    output.yReader = yReader ?? zeroReader;
    output.zReader = zReader ?? zeroReader;
    output.colorReader = colorReader ?? xReader ?? yReader ?? zReader ?? zeroReader;
    return true;
  }

  private _minMaxColorValues(
    output: THREE.Vector2Tuple,
    colorReader: FieldReader,
    view: DataView,
    pointCount: number,
    pointStep: number,
    settings: LayerSettingsPointCloudAndLaserScan,
  ): void {
    let minColorValue = settings.minValue ?? Number.POSITIVE_INFINITY;
    let maxColorValue = settings.maxValue ?? Number.NEGATIVE_INFINITY;
    if (
      NEEDS_MIN_MAX.includes(settings.colorMode) &&
      (settings.minValue == undefined || settings.maxValue == undefined)
    ) {
      for (let i = 0; i < pointCount; i++) {
        const pointOffset = i * pointStep;
        const colorValue = colorReader(view, pointOffset);
        minColorValue = Math.min(minColorValue, colorValue);
        maxColorValue = Math.max(maxColorValue, colorValue);
      }
      minColorValue = settings.minValue ?? minColorValue;
      maxColorValue = settings.maxValue ?? maxColorValue;
    }

    output[0] = minColorValue;
    output[1] = maxColorValue;
  }

  private _updatePointCloudBuffers(
    pointCloud: PointCloud | PointCloud2,
    readers: PointCloudFieldReaders,
    pointCount: number,
    settings: LayerSettingsPointCloudAndLaserScan,
    positionAttribute: THREE.BufferAttribute,
    colorAttribute: THREE.BufferAttribute,
  ): void {
    const data = pointCloud.data;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const pointStep = getStride(pointCloud);
    const { xReader, yReader, zReader, colorReader } = readers;

    // Iterate the point cloud data to determine min/max color values (if needed)
    this._minMaxColorValues(tempMinMaxColor, colorReader, view, pointCount, pointStep, settings);
    const [minColorValue, maxColorValue] = tempMinMaxColor;

    // Build a method to convert raw color field values to RGBA
    const colorConverter = getColorConverter(settings, minColorValue, maxColorValue);

    for (let i = 0; i < pointCount; i++) {
      const pointOffset = i * pointStep;

      // Update position attribute
      const x = xReader(view, pointOffset);
      const y = yReader(view, pointOffset);
      const z = zReader(view, pointOffset);
      positionAttribute.setXYZ(i, x, y, z);

      // Update color attribute
      const colorValue = colorReader(view, pointOffset);
      colorConverter(tempColor, colorValue);
      colorAttribute.setXYZW(
        i,
        (tempColor.r * 255) | 0,
        (tempColor.g * 255) | 0,
        (tempColor.b * 255) | 0,
        (tempColor.a * 255) | 0,
      );
    }

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  }

  public updateLaserScan(
    laserScan: NormalizedLaserScan,
    originalMessage: RosObject | undefined,
    settings: LayerSettingsPointCloudAndLaserScan,
    receiveTime: bigint,
  ): void {
    const messageTime = toNanoSec(laserScan.timestamp);
    this.userData.receiveTime = receiveTime;
    this.userData.messageTime = messageTime;
    this.userData.frameId = this.renderer.normalizeFrameId(laserScan.frame_id);
    this.userData.pointCloud = undefined;
    this.userData.laserScan = laserScan;
    this.userData.originalMessage = originalMessage;

    this.userData.settings = settings;
    const { colorField } = settings;
    const { intensities, ranges } = laserScan;

    // Invalid laser scan checks
    if (intensities.length !== 0 && intensities.length !== ranges.length) {
      const message = `LaserScan intensities length (${intensities.length}) does not match ranges length (${ranges.length})`;
      invalidPointCloudOrLaserScanError(this.renderer, this, message);
      return;
    }
    if (colorField !== "intensity" && colorField !== "range") {
      const message = `LaserScan color field must be either 'intensity' or 'range', found '${colorField}'`;
      invalidPointCloudOrLaserScanError(this.renderer, this, message);
      return;
    }

    const laserScanMaterial = this.userData.material as LaserScanMaterial;
    const pickingMaterial = this.userData.pickingMaterial as LaserScanMaterial;

    const topic = this.userData.topic;
    const pointsHistory = this.userData.pointsHistory;
    const isDecay = settings.decayTime > 0;
    if (isDecay) {
      // Push a new (empty) entry to the history of points
      const geometry = createGeometry(topic, THREE.StaticDrawUsage);
      const points = createPoints(
        topic,
        laserScan.pose,
        geometry,
        laserScanMaterial,
        pickingMaterial,
        undefined,
      );
      pointsHistory.push({ receiveTime, messageTime, points });
      this.add(points);
    }

    const latestEntry = pointsHistory[pointsHistory.length - 1];
    if (!latestEntry) {
      throw new Error(`pointsHistory is empty for ${topic}`);
    }

    latestEntry.receiveTime = receiveTime;
    latestEntry.messageTime = messageTime;

    const geometry = latestEntry.points.geometry;
    geometry.resize(ranges.length);
    const rangeAttribute = geometry.attributes.position!;
    const colorAttribute = geometry.attributes.color!;
    rangeAttribute.set(ranges);

    // Update material uniforms
    laserScanMaterial.update(settings, laserScan);
    pickingMaterial.update(settings, laserScan);

    // Determine min/max color values (if needed) and max range
    let minColorValue = settings.minValue ?? Number.POSITIVE_INFINITY;
    let maxColorValue = settings.maxValue ?? Number.NEGATIVE_INFINITY;
    if (settings.minValue == undefined || settings.maxValue == undefined) {
      let maxRange = 0;

      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i]!;
        if (Number.isFinite(range)) {
          maxRange = Math.max(maxRange, range);
        }

        const colorValue = colorField === "range" ? range : intensities[i];
        if (Number.isFinite(colorValue)) {
          minColorValue = Math.min(minColorValue, colorValue!);
          maxColorValue = Math.max(maxColorValue, colorValue!);
        }
      }
      minColorValue = settings.minValue ?? minColorValue;
      maxColorValue = settings.maxValue ?? maxColorValue;

      // Update the LaserScan bounding sphere
      latestEntry.points.geometry.boundingSphere ??= new THREE.Sphere();
      latestEntry.points.geometry.boundingSphere.set(VEC3_ZERO, maxRange);
      latestEntry.points.frustumCulled = true;
    } else {
      latestEntry.points.geometry.boundingSphere = ReactNull;
      latestEntry.points.frustumCulled = false;
    }

    // Build a method to convert raw color field values to RGBA
    const colorConverter = getColorConverter(settings, minColorValue, maxColorValue);

    // Iterate the point cloud data to update color attribute
    for (let i = 0; i < ranges.length; i++) {
      const colorValue = colorField === "range" ? ranges[i]! : intensities[i] ?? 0;
      colorConverter(tempColor, colorValue);
      colorAttribute.setXYZW(
        i,
        (tempColor.r * 255) | 0,
        (tempColor.g * 255) | 0,
        (tempColor.b * 255) | 0,
        (tempColor.a * 255) | 0,
      );
    }

    rangeAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  }

  public startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    const path = this.userData.settingsPath;

    this.visible = this.userData.settings.visible;
    if (!this.visible) {
      this.renderer.settings.errors.clearPath(path);
      const pointsHistory = this.userData.pointsHistory;
      for (const entry of pointsHistory.splice(0, pointsHistory.length - 1)) {
        entry.points.geometry.dispose();
        this.remove(entry.points);
      }
      return;
    }

    // Remove expired entries from the history of points when decayTime is enabled
    const pointsHistory = this.userData.pointsHistory;
    const decayTime = this.userData.settings.decayTime;
    const expireTime =
      decayTime > 0 ? currentTime - BigInt(Math.round(decayTime * 1e9)) : MAX_DURATION;
    while (pointsHistory.length > 1 && pointsHistory[0]!.receiveTime < expireTime) {
      const entry = this.userData.pointsHistory.shift()!;
      this.remove(entry.points);
      entry.points.geometry.dispose();
    }

    // Update the pose on each THREE.Points entry
    let hadTfError = false;
    for (const entry of pointsHistory) {
      const srcTime = entry.messageTime;
      const frameId = this.userData.frameId;
      const updated = updatePose(
        entry.points,
        this.renderer.transformTree,
        renderFrameId,
        fixedFrameId,
        frameId,
        currentTime,
        srcTime,
      );
      if (!updated && !hadTfError) {
        const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
        this.renderer.settings.errors.add(path, MISSING_TRANSFORM, message);
        hadTfError = true;
      }
    }

    if (!hadTfError) {
      this.renderer.settings.errors.remove(path, MISSING_TRANSFORM);
    }

    // Update the pixeRatio uniform if the current material is a LaserScanMaterial
    const material = this.userData.material as Partial<LaserScanMaterial>;
    const pixelRatio = material.uniforms?.pixelRatio;
    if (pixelRatio) {
      pixelRatio.value = this.renderer.getPixelRatio();
    }
  }
}

export class PointCloudsAndLaserScans extends SceneExtension<PointCloudAndLaserScanRenderable> {
  private pointCloudFieldsByTopic = new Map<string, string[]>();

  public constructor(renderer: Renderer) {
    super("foxglove.PointCloudsAndLaserScans", renderer);

    renderer.addDatatypeSubscriptions(ROS_POINTCLOUD_DATATYPES, this.handleRosPointCloud);
    renderer.addDatatypeSubscriptions(FOXGLOVE_POINTCLOUD_DATATYPES, this.handleFoxglovePointCloud);
    renderer.addDatatypeSubscriptions(ROS_LASERSCAN_DATATYPES, this.handleLaserScan);
    renderer.addDatatypeSubscriptions(FOXGLOVE_LASERSCAN_DATATYPES, this.handleLaserScan);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      const isPointCloud = ALL_POINTCLOUD_DATATYPES.has(topic.schemaName);
      const isLaserScan = !isPointCloud && ALL_LASERSCAN_DATATYPES.has(topic.schemaName);
      if (isPointCloud || isLaserScan) {
        const config = (configTopics[topic.name] ??
          {}) as Partial<LayerSettingsPointCloudAndLaserScan>;
        const node: SettingsTreeNodeWithActionHandler = pointCloudSettingsNode(
          this.pointCloudFieldsByTopic,
          config,
          topic,
          isPointCloud ? "pointcloud" : "laserscan",
        );
        node.handler = handler;
        entries.push({ path: ["topics", topic.name], node });
      }
    }
    return entries;
  }

  public override startFrame(
    currentTime: bigint,
    renderFrameId: string,
    fixedFrameId: string,
  ): void {
    // Do not call super.startFrame() since we handle updatePose() manually.
    // Instead of updating the pose for each Renderable in this.renderables, we
    // update the pose of each THREE.Points object in the pointsHistory of each
    // renderable

    for (const renderable of this.renderables.values()) {
      renderable.startFrame(currentTime, renderFrameId, fixedFrameId);
    }
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);

    // Update the renderable
    const topicName = path[1]!;
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      const prevSettings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsPointCloudAndLaserScan>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...prevSettings };
      if (renderable.userData.pointCloud) {
        renderable.updatePointCloud(
          renderable.userData.pointCloud,
          renderable.userData.originalMessage,
          settings,
          renderable.userData.receiveTime,
        );
      } else if (renderable.userData.laserScan) {
        renderable.updateLaserScan(
          renderable.userData.laserScan,
          renderable.userData.originalMessage,
          settings,
          renderable.userData.receiveTime,
        );
      }
    }
  };

  private handleFoxglovePointCloud = (messageEvent: PartialMessageEvent<PointCloud>): void => {
    const topic = messageEvent.topic;
    const pointCloud = normalizePointCloud(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPointCloudAndLaserScan>
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

      const isDecay = settings.decayTime > 0;
      const geometry = createGeometry(
        topic,
        isDecay ? THREE.StaticDrawUsage : THREE.DynamicDrawUsage,
      );

      const material = pointCloudMaterial(settings);
      const pickingMaterial = createPickingMaterial(settings);
      const instancePickingMaterial = createInstancePickingMaterial(settings);
      const points = createPoints(
        topic,
        getPose(pointCloud),
        geometry,
        material,
        pickingMaterial,
        instancePickingMaterial,
      );

      const messageTime = toNanoSec(pointCloud.timestamp);
      renderable = new PointCloudAndLaserScanRenderable(topic, this.renderer, {
        receiveTime,
        messageTime,
        frameId: this.renderer.normalizeFrameId(pointCloud.frame_id),
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        pointCloud,
        originalMessage: messageEvent.message as RosObject,
        pointsHistory: [{ receiveTime, messageTime, points }],
        material,
        pickingMaterial,
        instancePickingMaterial,
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

    renderable.updatePointCloud(
      pointCloud,
      messageEvent.message as RosObject,
      renderable.userData.settings,
      receiveTime,
    );
  };

  private handleRosPointCloud = (messageEvent: PartialMessageEvent<PointCloud2>): void => {
    const topic = messageEvent.topic;
    const pointCloud = normalizePointCloud2(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPointCloudAndLaserScan>
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

      const isDecay = settings.decayTime > 0;
      const geometry = createGeometry(
        topic,
        isDecay ? THREE.StaticDrawUsage : THREE.DynamicDrawUsage,
      );

      const material = pointCloudMaterial(settings);
      const pickingMaterial = createPickingMaterial(settings);
      const instancePickingMaterial = createInstancePickingMaterial(settings);
      const points = createPoints(
        topic,
        getPose(pointCloud),
        geometry,
        material,
        pickingMaterial,
        instancePickingMaterial,
      );

      const messageTime = toNanoSec(pointCloud.header.stamp);
      renderable = new PointCloudAndLaserScanRenderable(topic, this.renderer, {
        receiveTime,
        messageTime,
        frameId: this.renderer.normalizeFrameId(pointCloud.header.frame_id),
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        pointCloud,
        originalMessage: messageEvent.message as RosObject,
        pointsHistory: [{ receiveTime, messageTime, points }],
        material,
        pickingMaterial,
        instancePickingMaterial,
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

    renderable.updatePointCloud(
      pointCloud,
      messageEvent.message as RosObject,
      renderable.userData.settings,
      receiveTime,
    );
  };

  private handleLaserScan = (
    messageEvent: PartialMessageEvent<RosLaserScan | FoxgloveLaserScan>,
  ): void => {
    const topic = messageEvent.topic;
    const laserScan =
      "header" in messageEvent.message
        ? normalizeRosLaserScan(messageEvent.message)
        : normalizeFoxgloveLaserScan(messageEvent.message as PartialMessage<FoxgloveLaserScan>);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPointCloudAndLaserScan>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };
      if (settings.colorField == undefined) {
        settings.colorField = "intensity";
        settings.colorMode = "colormap";
        settings.colorMap = "turbo";

        // Update user settings with the newly selected color field
        this.renderer.updateConfig((draft) => {
          const updatedUserSettings = { ...userSettings };
          updatedUserSettings.colorField = settings.colorField;
          updatedUserSettings.colorMode = settings.colorMode;
          updatedUserSettings.colorMap = settings.colorMap;
          draft.topics[topic] = updatedUserSettings;
        });
      }

      const geometry = new DynamicBufferGeometry();
      geometry.name = `${topic}:LaserScan:geometry`;
      // Three.JS doesn't render anything if there is no attribute named position, so we use the name position for the "range" parameter.
      geometry.createAttribute("position", Float32Array, 1);
      geometry.createAttribute("color", Uint8Array, 4, true);

      const material = new LaserScanMaterial();
      const pickingMaterial = new LaserScanMaterial({ picking: true });
      const instancePickingMaterial = new LaserScanInstancePickingMaterial();
      const points = createPoints(
        topic,
        laserScan.pose,
        geometry,
        material,
        pickingMaterial,
        instancePickingMaterial,
      );

      material.update(settings, laserScan);
      pickingMaterial.update(settings, laserScan);

      const messageTime = toNanoSec(laserScan.timestamp);
      renderable = new PointCloudAndLaserScanRenderable(topic, this.renderer, {
        receiveTime,
        messageTime,
        frameId: this.renderer.normalizeFrameId(laserScan.frame_id),
        pose: laserScan.pose,
        settingsPath: ["topics", topic],
        settings,
        topic,
        laserScan,
        originalMessage: messageEvent.message as RosObject,
        pointsHistory: [{ receiveTime, messageTime, points }],
        material,
        pickingMaterial,
        instancePickingMaterial,
      });
      renderable.add(points);

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    renderable.updateLaserScan(
      laserScan,
      messageEvent.message as RosObject,
      renderable.userData.settings,
      receiveTime,
    );
  };
}

export function pointCloudMaterial(
  settings: LayerSettingsPointCloudAndLaserScan,
): THREE.PointsMaterial {
  const transparent = colorHasTransparency(settings);
  const encoding = pointCloudColorEncoding(settings);
  const scale = settings.pointSize;
  const shape = settings.pointShape;

  const material = new THREE.PointsMaterial({
    vertexColors: true,
    size: scale,
    sizeAttenuation: false,
    transparent,
    // The sorting issues caused by writing semi-transparent pixels to the depth buffer are less
    // distracting for point clouds than the self-sorting artifacts when depth writing is disabled
    depthWrite: true,
  });

  // Tell three.js to recompile the shader when `shape` or `encoding` change
  material.customProgramCacheKey = () => `${shape}-${encoding}`;
  material.onBeforeCompile = (shader) => {
    const SEARCH = "#include <output_fragment>";
    if (shape === "circle") {
      // Patch the fragment shader to render points as circles
      shader.fragmentShader =
        FS_SRGB_TO_LINEAR + shader.fragmentShader.replace(SEARCH, FS_POINTCLOUD_CIRCLE + SEARCH);
    }
    if (encoding === "srgb") {
      // Patch the fragment shader to add sRGB->linear color conversion
      shader.fragmentShader = shader.fragmentShader.replace(
        SEARCH,
        FS_POINTCLOUD_SRGB_TO_LINEAR + SEARCH,
      );
    }
  };

  return material;
}

class LaserScanMaterial extends THREE.RawShaderMaterial {
  private static MIN_PICKING_POINT_SIZE = 8;

  public constructor({ picking = false }: { picking?: boolean } = {}) {
    super({
      vertexShader: `\
        #version 300 es
        precision highp float;
        precision highp int;
        uniform mat4 projectionMatrix, modelViewMatrix;

        uniform float pointSize;
        uniform float pixelRatio;
        uniform float angleMin, angleIncrement;
        uniform float rangeMin, rangeMax;
        in float position; // range, but must be named position in order for three.js to render anything
        in mediump vec4 color;
        out mediump vec4 vColor;
        void main() {
          if (position < rangeMin || position > rangeMax) {
            gl_PointSize = 0.0;
            return;
          }
          vColor = color;
          float angle = angleMin + angleIncrement * float(gl_VertexID);
          vec4 pos = vec4(position * cos(angle), position * sin(angle), 0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * pos;
          ${
            picking
              ? `gl_PointSize = pixelRatio * max(pointSize, ${LaserScanMaterial.MIN_PICKING_POINT_SIZE.toFixed(
                  1,
                )});`
              : "gl_PointSize = pixelRatio * pointSize;"
          }

        }
      `,
      fragmentShader: `\
        #version 300 es
        #ifdef GL_FRAGMENT_PRECISION_HIGH
          precision highp float;
        #else
          precision mediump float;
        #endif
        uniform bool isCircle;
        ${picking ? "uniform vec4 objectId;" : "in mediump vec4 vColor;"}
        out vec4 outColor;

        ${THREE.ShaderChunk.encodings_pars_fragment /* for LinearTosRGB() */}

        void main() {
          if (isCircle) {
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            if (dot(cxy, cxy) > 1.0) { discard; }
          }
          ${picking ? "outColor = objectId;" : "outColor = LinearTosRGB(vColor);"}
        }
      `,
    });
    this.uniforms = {
      isCircle: { value: false },
      pointSize: { value: 1 },
      pixelRatio: { value: 1 },
      angleMin: { value: NaN },
      angleIncrement: { value: NaN },
      rangeMin: { value: NaN },
      rangeMax: { value: NaN },
    };
    if (picking) {
      this.uniforms.objectId = { value: [NaN, NaN, NaN, NaN] };
    }
  }

  public update(
    settings: LayerSettingsPointCloudAndLaserScan,
    laserScan: NormalizedLaserScan,
  ): void {
    this.uniforms.isCircle!.value = settings.pointShape === "circle";
    this.uniforms.pointSize!.value = settings.pointSize;
    this.uniforms.angleMin!.value = laserScan.start_angle;
    this.uniforms.angleIncrement!.value =
      (laserScan.end_angle - laserScan.start_angle) / (laserScan.ranges.length - 1);
    this.uniforms.rangeMin!.value = laserScan.range_min;
    this.uniforms.rangeMax!.value = laserScan.range_max;
    this.uniformsNeedUpdate = true;

    const transparent = colorHasTransparency(settings);
    if (transparent !== this.transparent) {
      this.transparent = transparent;
      this.depthWrite = !this.transparent;
      this.needsUpdate = true;
    }
  }
}

class LaserScanInstancePickingMaterial extends THREE.RawShaderMaterial {
  private static MIN_PICKING_POINT_SIZE = 8;

  public constructor() {
    const minPointSize = LaserScanInstancePickingMaterial.MIN_PICKING_POINT_SIZE.toFixed(1);
    super({
      vertexShader: `\
        #version 300 es
        precision highp float;
        precision highp int;
        uniform mat4 projectionMatrix, modelViewMatrix;

        uniform float pointSize;
        uniform float pixelRatio;
        uniform float angleMin, angleIncrement;
        uniform float rangeMin, rangeMax;
        in float position; // range, but must be named position in order for three.js to render anything
        varying vec4 objectId;
        void main() {
          if (position < rangeMin || position > rangeMax) {
            gl_PointSize = 0.0;
            return;
          }
          objectId = vec4(
            float((gl_VertexID >> 24) & 255) / 255.0,
            float((gl_VertexID >> 16) & 255) / 255.0,
            float((gl_VertexID >> 8) & 255) / 255.0,
            float(gl_VertexID & 255) / 255.0);
          float angle = angleMin + angleIncrement * float(gl_VertexID);
          vec4 pos = vec4(position * cos(angle), position * sin(angle), 0, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * pos;
          gl_PointSize = pixelRatio * max(pointSize, ${minPointSize});
        }
      `,
      fragmentShader: `\
        #version 300 es
        #ifdef GL_FRAGMENT_PRECISION_HIGH
          precision highp float;
        #else
          precision mediump float;
        #endif
        uniform bool isCircle;
        varying vec4 objectId;
        out vec4 outColor;

        void main() {
          if (isCircle) {
            vec2 cxy = 2.0 * gl_PointCoord - 1.0;
            if (dot(cxy, cxy) > 1.0) { discard; }
          }
          outColor = objectId;
        }
      `,
    });
    this.uniforms = {
      isCircle: { value: false },
      pointSize: { value: 1 },
      pixelRatio: { value: 1 },
      angleMin: { value: NaN },
      angleIncrement: { value: NaN },
      rangeMin: { value: NaN },
      rangeMax: { value: NaN },
    };
  }

  public update(settings: LayerSettingsPointCloudAndLaserScan, laserScan: RosLaserScan): void {
    this.uniforms.isCircle!.value = settings.pointShape === "circle";
    this.uniforms.pointSize!.value = settings.pointSize;
    this.uniforms.angleMin!.value = laserScan.angle_min;
    this.uniforms.angleIncrement!.value = laserScan.angle_increment;
    this.uniforms.rangeMin!.value = laserScan.range_min;
    this.uniforms.rangeMax!.value = laserScan.range_max;
    this.uniformsNeedUpdate = true;
  }
}

export function createPickingMaterial(
  settings: LayerSettingsPointCloudAndLaserScan,
): THREE.ShaderMaterial {
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

export function createInstancePickingMaterial(
  settings: LayerSettingsPointCloudAndLaserScan,
): THREE.ShaderMaterial {
  const MIN_PICKING_POINT_SIZE = 8;

  // Use a custom shader for picking that sets a minimum point size to make
  // individual points easier to click on
  const pointSize = Math.max(settings.pointSize, MIN_PICKING_POINT_SIZE);
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
        uniform float pointSize;
        varying vec4 objectId;
        void main() {
          objectId = vec4(
            float((gl_VertexID >> 24) & 255) / 255.0,
            float((gl_VertexID >> 16) & 255) / 255.0,
            float((gl_VertexID >> 8) & 255) / 255.0,
            float(gl_VertexID & 255) / 255.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize;
        }
      `,
    fragmentShader: /* glsl */ `
        varying vec4 objectId;
        void main() {
          gl_FragColor = objectId;
        }
      `,
    side: THREE.DoubleSide,
    uniforms: { pointSize: { value: pointSize } },
  });
}

function pointCloudColorEncoding(settings: LayerSettingsPointCloudAndLaserScan): "srgb" | "linear" {
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

export function autoSelectColorField(
  output: LayerSettingsPointCloudAndLaserScan,
  pointCloud: PointCloud | PointCloud2,
): void {
  // Prefer color fields first
  for (const field of pointCloud.fields) {
    const fieldNameLower = field.name.toLowerCase();
    if (COLOR_FIELDS.has(fieldNameLower)) {
      output.colorField = field.name;
      switch (fieldNameLower) {
        case "rgb":
          output.colorMode = "rgb";
          output.rgbByteOrder = "abgr";
          break;
        default:
        case "rgba":
          output.colorMode = "rgba";
          output.rgbByteOrder = "abgr";
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

export function pointCloudSettingsNode(
  pclFieldsByTopic: Map<string, string[]>,
  config: Partial<LayerSettingsPointCloudAndLaserScan>,
  topic: Topic,
  kind: "pointcloud" | "laserscan",
): SettingsTreeNode {
  const msgFields =
    kind === "laserscan"
      ? LASERSCAN_FIELDS
      : pclFieldsByTopic.get(topic.name) ?? POINTCLOUD_REQUIRED_FIELDS;
  const pointSize = config.pointSize;
  const pointShape = config.pointShape ?? "circle";
  const decayTime = config.decayTime;
  const colorMode = config.colorMode ?? "flat";
  const flatColor = config.flatColor ?? "#ffffff";
  const colorField = config.colorField ?? bestColorByField(msgFields);
  const colorFieldOptions = msgFields.map((field) => ({ label: field, value: field }));
  const gradient = config.gradient;
  const colorMap = config.colorMap ?? "turbo";
  const explicitAlpha = config.explicitAlpha ?? 1;
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
    min: 0,
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
    ].concat(
      kind === "pointcloud"
        ? [
            { label: "RGB", value: "rgb" },
            { label: "RGBA", value: "rgba" },
          ]
        : [],
    ),
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

    if (colorMode === "colormap" || colorMode === "rgb") {
      fields.explicitAlpha = {
        label: "Opacity",
        input: "number",
        step: 0.1,
        placeholder: "1",
        precision: 3,
        min: 0,
        max: 1,
        value: explicitAlpha,
      };
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
    icon: kind === "pointcloud" ? "Points" : "Radar",
    fields,
    order: topic.name.toLocaleLowerCase(),
    visible: config.visible ?? DEFAULT_SETTINGS.visible,
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

function invalidPointCloudOrLaserScanError(
  renderer: Renderer,
  renderable: PointCloudAndLaserScanRenderable,
  message: string,
): void {
  renderer.settings.errors.addToTopic(
    renderable.userData.topic,
    INVALID_POINTCLOUD_OR_LASERSCAN,
    message,
  );
  const pointsHistory = renderable.userData.pointsHistory;
  const lastEntry = pointsHistory[pointsHistory.length - 1];
  lastEntry?.points.geometry.resize(0);
}

function zeroReader(): number {
  return 0;
}

export function createPoints(
  topic: string,
  pose: Pose,
  geometry: DynamicBufferGeometry,
  material: Material,
  pickingMaterial: THREE.Material,
  instancePickingMaterial: THREE.Material | undefined,
): Points {
  const points = new THREE.Points<DynamicBufferGeometry, Material>(geometry, material);
  // We don't calculate the bounding sphere for points, so frustum culling is disabled
  points.frustumCulled = false;
  points.name = `${topic}:PointCloud:points`;
  points.userData = {
    pickingMaterial,
    instancePickingMaterial,
    pose,
  };
  return points;
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

function normalizePackedElementField(
  field: PartialMessage<PackedElementField> | undefined,
): PackedElementField {
  return {
    name: field?.name ?? "",
    offset: field?.offset ?? 0,
    type: field?.type ?? 0,
  };
}

function normalizePointCloud(message: PartialMessage<PointCloud>): PointCloud {
  return {
    timestamp: normalizeTime(message.timestamp),
    frame_id: message.frame_id ?? "",
    pose: normalizePose(message.pose),
    point_stride: message.point_stride ?? 0,
    fields: message.fields?.map(normalizePackedElementField) ?? [],
    data: normalizeByteArray(message.data),
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

function normalizeFoxgloveLaserScan(
  message: PartialMessage<FoxgloveLaserScan>,
): NormalizedLaserScan {
  return {
    timestamp: normalizeTime(message.timestamp),
    frame_id: message.frame_id ?? "",
    pose: normalizePose(message.pose),
    start_angle: message.start_angle ?? 0,
    end_angle: message.end_angle ?? 0,
    range_min: -Infinity,
    range_max: Infinity,
    ranges: normalizeFloat32Array(message.ranges),
    intensities: normalizeFloat32Array(message.intensities),
  };
}

function normalizeRosLaserScan(message: PartialMessage<RosLaserScan>): NormalizedLaserScan {
  return {
    timestamp: normalizeTime(message.header?.stamp),
    frame_id: message.header?.frame_id ?? "",
    pose: emptyPose(),
    start_angle: message.angle_min ?? 0,
    end_angle: message.angle_max ?? 0,
    range_min: message.range_min ?? -Infinity,
    range_max: message.range_max ?? Infinity,
    ranges: normalizeFloat32Array(message.ranges),
    intensities: normalizeFloat32Array(message.intensities),
  };
}

function getTimestamp(pointCloud: PointCloud | PointCloud2): Time {
  const maybeRos = pointCloud as Partial<PointCloud2>;
  return maybeRos.header ? maybeRos.header.stamp : (pointCloud as PointCloud).timestamp;
}

function getFrameId(pointCloud: PointCloud | PointCloud2): string {
  const maybeRos = pointCloud as Partial<PointCloud2>;
  return maybeRos.header ? maybeRos.header.frame_id : (pointCloud as PointCloud).frame_id;
}

function getStride(pointCloud: PointCloud | PointCloud2): number {
  const maybeRos = pointCloud as Partial<PointCloud2>;
  return maybeRos.point_step != undefined
    ? maybeRos.point_step
    : (pointCloud as PointCloud).point_stride;
}

function getPose(pointCloud: PointCloud | PointCloud2): Pose {
  const maybeFoxglove = pointCloud as Partial<PointCloud>;
  return maybeFoxglove.pose ?? makePose();
}
