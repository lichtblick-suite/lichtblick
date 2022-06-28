// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeAction, SettingsTreeFields, SettingsTreeNode, Topic } from "@foxglove/studio";

import { DynamicBufferGeometry, DynamicFloatBufferGeometry } from "../DynamicBufferGeometry";
import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { rgbaToCssString, stringToRgba } from "../color";
import { normalizeByteArray, normalizeHeader, normalizeFloat32Array } from "../normalizeMessages";
import {
  LASERSCAN_DATATYPES,
  LaserScan,
  PointCloud2,
  POINTCLOUD_DATATYPES,
  PointField,
  PointFieldType,
} from "../ros";
import { BaseSettings } from "../settings";
import { makePose } from "../transforms";
import { getColorConverter } from "./pointClouds/colors";
import { FieldReader, getReader } from "./pointClouds/fieldReaders";

export type LayerSettingsPointCloudAndLaserScan = BaseSettings & {
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

const DEFAULT_SETTINGS: LayerSettingsPointCloudAndLaserScan = {
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
const LASERSCAN_FIELDS = ["range", "intensity"];

const COLOR_FIELDS = new Set<string>(["rgb", "rgba", "bgr", "bgra", "abgr", "color"]);
const INTENSITY_FIELDS = new Set<string>(["intensity", "i"]);

const INVALID_POINTCLOUD_OR_LASERSCAN = "INVALID_POINTCLOUD_OR_LASERSCAN";

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

export type PointCloudAndLaserScanUserData = BaseUserData & {
  settings: LayerSettingsPointCloudAndLaserScan;
  topic: string;
  pointCloud?: PointCloud2;
  laserScan?: LaserScan;
  geometry: DynamicFloatBufferGeometry;
  points: THREE.Points<DynamicFloatBufferGeometry, THREE.PointsMaterial | LaserScanMaterial>;
  pickingMaterial: THREE.ShaderMaterial | LaserScanMaterial;
};

export class PointCloudAndLaserScanRenderable extends Renderable<PointCloudAndLaserScanUserData> {
  override dispose(): void {
    this.userData.geometry.dispose();
    this.userData.points.material.dispose();
    super.dispose();
  }
}

export class PointCloudsAndLaserScans extends SceneExtension<PointCloudAndLaserScanRenderable> {
  private pointCloudFieldsByTopic = new Map<string, string[]>();

  constructor(renderer: Renderer) {
    super("foxglove.PointCloudsAndLaserScans", renderer);

    renderer.addDatatypeSubscriptions(POINTCLOUD_DATATYPES, this.handlePointCloud);
    renderer.addDatatypeSubscriptions(LASERSCAN_DATATYPES, this.handleLaserScan);
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      const isPointCloud = POINTCLOUD_DATATYPES.has(topic.datatype);
      const isLaserScan = !isPointCloud && LASERSCAN_DATATYPES.has(topic.datatype);
      if (isPointCloud || isLaserScan) {
        const config = (configTopics[topic.name] ??
          {}) as Partial<LayerSettingsPointCloudAndLaserScan>;
        const node: SettingsTreeNodeWithActionHandler = settingsNode(
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

  override startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    super.startFrame(currentTime, renderFrameId, fixedFrameId);
    for (const renderable of this.renderables.values()) {
      const material = renderable.userData.points.material;
      const pixelRatio = (material as Partial<LaserScanMaterial>).uniforms?.pixelRatio;
      if (pixelRatio) {
        pixelRatio.value = this.renderer.getPixelRatio();
      }
    }
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
      const prevSettings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsPointCloudAndLaserScan>
        | undefined;
      if (renderable.userData.pointCloud) {
        this._updatePointCloudRenderable(
          renderable,
          renderable.userData.pointCloud,
          { ...renderable.userData.settings, ...prevSettings },
          renderable.userData.receiveTime,
        );
      } else if (renderable.userData.laserScan) {
        this._updateLaserScanRenderable(
          renderable,
          renderable.userData.laserScan,
          renderable.userData.receiveTime,
        );
      }
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

      const geometry = new DynamicBufferGeometry(Float32Array);
      geometry.name = `${topic}:PointCloud2:geometry`;
      geometry.createAttribute("position", 3);
      geometry.createAttribute("color", 4);

      const material = pointCloudMaterial(settings);
      const pickingMaterial = createPickingMaterial(settings);
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.name = `${topic}:PointCloud2:points`;
      points.userData.pickingMaterial = pickingMaterial;

      renderable = new PointCloudAndLaserScanRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(pointCloud.header.stamp),
        frameId: this.renderer.normalizeFrameId(pointCloud.header.frame_id),
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

    this._updatePointCloudRenderable(
      renderable,
      pointCloud,
      renderable.userData.settings,
      receiveTime,
    );
  };

  _updatePointCloudRenderable(
    renderable: PointCloudAndLaserScanRenderable,
    pointCloud: PointCloud2,
    settings: LayerSettingsPointCloudAndLaserScan,
    receiveTime: bigint,
  ): void {
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(pointCloud.header.stamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(pointCloud.header.frame_id);
    renderable.userData.pointCloud = pointCloud;
    renderable.userData.laserScan = undefined;

    const prevSettings = renderable.userData.settings;
    const material = renderable.userData.points.material as THREE.PointsMaterial;
    const needsRebuild =
      colorHasTransparency(settings) !== material.transparent ||
      pointCloudColorEncoding(settings) !== pointCloudColorEncoding(prevSettings) ||
      settings.pointShape !== prevSettings.pointShape;

    if (needsRebuild) {
      material.dispose();
      renderable.userData.points.material = pointCloudMaterial(settings);
    } else {
      material.size = settings.pointSize;
    }

    renderable.userData.settings = settings;
    const data = pointCloud.data;
    const pointCount = Math.trunc(data.length / pointCloud.point_step);

    // Invalid point cloud checks
    if (pointCloud.is_bigendian) {
      const message = `PointCloud2 is_bigendian=true is not supported`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return;
    } else if (data.length % pointCloud.point_step !== 0) {
      const message = `PointCloud2 data length ${data.length} is not a multiple of point_step ${pointCloud.point_step}`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return;
    } else if (pointCloud.fields.length === 0) {
      const message = `PointCloud2 has no fields`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return;
    } else if (data.length < pointCloud.height * pointCloud.row_step) {
      const message = `PointCloud2 data length ${data.length} is less than height ${pointCloud.height} * row_step ${pointCloud.row_step}`;
      this.renderer.settings.errors.addToTopic(
        renderable.userData.topic,
        INVALID_POINTCLOUD_OR_LASERSCAN,
        message,
      );
      // Allow this error for now since we currently ignore row_step
    } else if (pointCloud.width * pointCloud.point_step > pointCloud.row_step) {
      const message = `PointCloud2 width ${pointCloud.width} * point_step ${pointCloud.point_step} is greater than row_step ${pointCloud.row_step}`;
      this.renderer.settings.errors.addToTopic(
        renderable.userData.topic,
        INVALID_POINTCLOUD_OR_LASERSCAN,
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
        invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
        return;
      } else if (field.offset < 0) {
        const message = `PointCloud2 field "${field.name}" has invalid offset ${field.offset}. Must be >= 0`;
        invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
        return;
      }

      if (field.name === "x") {
        xReader = getReader(field, pointCloud.point_step);
        if (!xReader) {
          const typeName = pointFieldTypeName(field.datatype);
          const message = `PointCloud2 field "x" is invalid. type=${typeName}, offset=${field.offset}, point_step=${pointCloud.point_step}`;
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
          return;
        }
      } else if (field.name === "y") {
        yReader = getReader(field, pointCloud.point_step);
        if (!yReader) {
          const typeName = pointFieldTypeName(field.datatype);
          const message = `PointCloud2 field "y" is invalid. type=${typeName}, offset=${field.offset}, point_step=${pointCloud.point_step}`;
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
          return;
        }
      } else if (field.name === "z") {
        zReader = getReader(field, pointCloud.point_step);
        if (!zReader) {
          const typeName = pointFieldTypeName(field.datatype);
          const message = `PointCloud2 field "z" is invalid. type=${typeName}, offset=${field.offset}, point_step=${pointCloud.point_step}`;
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
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
          invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
          return;
        }
      }
    }

    if (minBytesPerPoint > pointCloud.point_step) {
      const message = `PointCloud2 point_step ${pointCloud.point_step} is less than minimum bytes per point ${minBytesPerPoint}`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return;
    }

    const positionReaderCount = (xReader ? 1 : 0) + (yReader ? 1 : 0) + (zReader ? 1 : 0);
    if (positionReaderCount < 2) {
      const message = `PointCloud2 must contain at least two of x/y/z fields`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
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

  handleLaserScan = (messageEvent: PartialMessageEvent<LaserScan>): void => {
    const topic = messageEvent.topic;
    const laserScan = normalizeLaserScan(messageEvent.message);
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

      const geometry = new DynamicBufferGeometry(Float32Array);
      geometry.name = `${topic}:LaserScan:geometry`;
      // Three.JS doesn't render anything if there is no attribute named position, so we use the name position for the "range" parameter.
      geometry.createAttribute("position", 1);
      geometry.createAttribute("color", 4);

      const material = new LaserScanMaterial();
      const pickingMaterial = new LaserScanMaterial({ picking: true });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.name = `${topic}:LaserScan:points`;
      points.userData.pickingMaterial = pickingMaterial;

      material.update(settings, laserScan);
      pickingMaterial.update(settings, laserScan);

      renderable = new PointCloudAndLaserScanRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(laserScan.header.stamp),
        frameId: this.renderer.normalizeFrameId(laserScan.header.frame_id),
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        laserScan,
        geometry,
        points,
        pickingMaterial,
      });
      renderable.add(points);

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    this._updateLaserScanRenderable(renderable, laserScan, receiveTime);
  };

  _updateLaserScanRenderable(
    renderable: PointCloudAndLaserScanRenderable,
    laserScan: LaserScan,
    receiveTime: bigint,
  ): void {
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(laserScan.header.stamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(laserScan.header.frame_id);
    renderable.userData.pointCloud = undefined;
    renderable.userData.laserScan = laserScan;

    const settings = renderable.userData.settings;
    const { colorField } = settings;
    const { intensities, ranges } = laserScan;

    // Invalid laser scan checks
    if (intensities.length !== 0 && intensities.length !== ranges.length) {
      const message = `LaserScan intensities length (${intensities.length}) does not match ranges length (${ranges.length})`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return;
    }
    if (colorField !== "intensity" && colorField !== "range") {
      const message = `LaserScan color field must be either 'intensity' or 'range', found '${colorField}'`;
      invalidPointCloudOrLaserScanError(this.renderer, renderable, message);
      return;
    }

    const geometry = renderable.userData.geometry;
    geometry.resize(ranges.length);
    const rangeAttribute = geometry.attributes.position!;
    const colorAttribute = geometry.attributes.color!;
    rangeAttribute.set(ranges);

    // Update material uniforms
    const laserScanMaterial = renderable.userData.points.material as LaserScanMaterial;
    const pickingMaterial = renderable.userData.pickingMaterial as LaserScanMaterial;
    laserScanMaterial.update(settings, laserScan);
    pickingMaterial.update(settings, laserScan);

    // Determine min/max color values (if needed)
    let minColorValue = settings.minValue ?? Number.POSITIVE_INFINITY;
    let maxColorValue = settings.maxValue ?? Number.NEGATIVE_INFINITY;
    if (settings.minValue == undefined || settings.maxValue == undefined) {
      for (let i = 0; i < ranges.length; i++) {
        let colorValue: number | undefined;
        if (colorField === "range") {
          colorValue = ranges[i]!;
        } else {
          colorValue = intensities[i];
        }
        if (colorValue != undefined) {
          minColorValue = Math.min(minColorValue, colorValue);
          maxColorValue = Math.max(maxColorValue, colorValue);
        }
      }
      minColorValue = settings.minValue ?? minColorValue;
      maxColorValue = settings.maxValue ?? maxColorValue;
    }

    // Build a method to convert raw color field values to RGBA
    const colorConverter = getColorConverter(settings, minColorValue, maxColorValue);

    // Iterate the point cloud data to update color attribute
    for (let i = 0; i < ranges.length; i++) {
      const colorValue = colorField === "range" ? ranges[i]! : intensities[i] ?? 0;
      colorConverter(tempColor, colorValue);
      colorAttribute.setXYZW(i, tempColor.r, tempColor.g, tempColor.b, tempColor.a);
    }

    rangeAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  }
}

function pointCloudMaterial(settings: LayerSettingsPointCloudAndLaserScan): THREE.PointsMaterial {
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
  static MIN_PICKING_POINT_SIZE = 8;

  constructor({ picking = false }: { picking?: boolean } = {}) {
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

  update(settings: LayerSettingsPointCloudAndLaserScan, laserScan: LaserScan): void {
    this.uniforms.isCircle!.value = settings.pointShape === "circle";
    this.uniforms.pointSize!.value = settings.pointSize;
    this.uniforms.angleMin!.value = laserScan.angle_min;
    this.uniforms.angleIncrement!.value = laserScan.angle_increment;
    this.uniforms.rangeMin!.value = laserScan.range_min;
    this.uniforms.rangeMax!.value = laserScan.range_max;

    const transparent = colorHasTransparency(settings);
    if (transparent !== this.transparent) {
      this.transparent = transparent;
      this.depthWrite = !this.transparent;
      this.needsUpdate = true;
    }
  }
}

function createPickingMaterial(
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

function colorHasTransparency(settings: LayerSettingsPointCloudAndLaserScan): boolean {
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

function autoSelectColorField(
  output: LayerSettingsPointCloudAndLaserScan,
  pointCloud: PointCloud2,
): void {
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

function bestColorByField(fields: string[]): string {
  for (const field of fields) {
    if (COLOR_FIELDS.has(field)) {
      return field;
    }
  }
  for (const field of fields) {
    if (INTENSITY_FIELDS.has(field)) {
      return field;
    }
  }
  return "x";
}

function settingsNode(
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

function normalizeLaserScan(message: PartialMessage<LaserScan>): LaserScan {
  return {
    header: normalizeHeader(message.header),
    angle_min: message.angle_min ?? 0,
    angle_max: message.angle_max ?? 0,
    angle_increment: message.angle_increment ?? 0,
    time_increment: message.time_increment ?? 0,
    scan_time: message.scan_time ?? 0,
    range_min: message.range_min ?? -Infinity,
    range_max: message.range_max ?? Infinity,
    ranges: normalizeFloat32Array(message.ranges),
    intensities: normalizeFloat32Array(message.intensities),
  };
}
