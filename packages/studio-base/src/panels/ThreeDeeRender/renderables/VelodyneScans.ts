// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec, toSec } from "@foxglove/rostime";
import { NumericType, PointCloud as FoxglovePointCloud } from "@foxglove/schemas";
import { MessageEvent, SettingsTreeAction } from "@foxglove/studio";
import type { RosObject } from "@foxglove/studio-base/players/types";
import { VelodynePacket, VelodyneScan } from "@foxglove/studio-base/types/Messages";
import {
  Calibration,
  Model,
  PointCloud,
  PointFieldDataType,
  RawPacket,
  Transformer,
} from "@foxglove/velodyne-cloud";

import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { VELODYNE_SCAN_DATATYPES } from "../ros";
import { makePose } from "../transforms";
import {
  autoSelectColorField,
  createGeometry,
  createInstancePickingMaterial,
  createPickingMaterial,
  createPoints,
  DEFAULT_SETTINGS,
  LayerSettingsPointCloudAndLaserScan,
  PointCloudAndLaserScanRenderable,
  pointCloudMaterial,
  pointCloudSettingsNode,
} from "./PointCloudsAndLaserScans";

export function pointFieldDataTypeToNumericType(type: PointFieldDataType): NumericType {
  switch (type) {
    case PointFieldDataType.UINT8:
      return NumericType.UINT8;
    case PointFieldDataType.INT8:
      return NumericType.INT8;
    case PointFieldDataType.UINT16:
      return NumericType.UINT16;
    case PointFieldDataType.INT16:
      return NumericType.INT16;
    case PointFieldDataType.UINT32:
      return NumericType.UINT32;
    case PointFieldDataType.INT32:
      return NumericType.INT32;
    case PointFieldDataType.FLOAT32:
      return NumericType.FLOAT32;
    case PointFieldDataType.FLOAT64:
      return NumericType.FLOAT64;
    default:
      return NumericType.UNKNOWN;
  }
}

// Converts `velodyne_msgs/VelodyneScan` messages into `VelodyneScanDecoded`
// objects which are an amalgamation of VelodyneScan and PointCloud2 ROS
// messages plus marker-like SceneBuilder annotations
class VelodyneCloudConverter {
  private _transformers = new Map<Model, Transformer>();

  public decode(scan: VelodyneScan): FoxglovePointCloud | undefined {
    if (scan.packets.length === 0) {
      return undefined;
    }

    const firstPacketData = scan.packets[0] as VelodynePacket;
    const model = RawPacket.InferModel(firstPacketData.data);
    if (model == undefined) {
      return undefined;
    }

    const stamp = toSec(scan.header.stamp);
    const maxPoints = RawPacket.MAX_POINTS_PER_PACKET * scan.packets.length;
    const cloud = new PointCloud({ stamp, maxPoints });
    const transformer = this.getTransformer(model);

    for (const packet of scan.packets) {
      transformer.unpack(new RawPacket(packet.data), stamp, toSec(packet.stamp), cloud);
    }

    cloud.trim();

    if (cloud.width === 0 || cloud.height === 0) {
      return undefined;
    }

    return {
      timestamp: scan.header.stamp,
      frame_id: scan.header.frame_id,
      pose: makePose(),
      point_stride: cloud.point_step,
      fields: cloud.fields.map((field) => ({
        name: field.name,
        offset: field.offset,
        type: pointFieldDataTypeToNumericType(field.datatype),
      })),
      data: cloud.data,
    };
  }

  public getTransformer(model: Model): Transformer {
    let transformer = this._transformers.get(model);
    if (transformer != undefined) {
      return transformer;
    }

    transformer = new Transformer(new Calibration(model));
    this._transformers.set(model, transformer);
    return transformer;
  }
}

export class VelodyneScans extends SceneExtension<PointCloudAndLaserScanRenderable> {
  private _pointCloudFieldsByTopic = new Map<string, string[]>();
  private _velodyneCloudConverter = new VelodyneCloudConverter();

  public constructor(renderer: Renderer) {
    super("foxglove.VelodyneScans", renderer);

    renderer.addDatatypeSubscriptions(VELODYNE_SCAN_DATATYPES, this.handleVelodyneScan);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (VELODYNE_SCAN_DATATYPES.has(topic.datatype)) {
        const config = (configTopics[topic.name] ??
          {}) as Partial<LayerSettingsPointCloudAndLaserScan>;
        const node: SettingsTreeNodeWithActionHandler = pointCloudSettingsNode(
          this._pointCloudFieldsByTopic,
          config,
          topic,
          "pointcloud",
        );
        node.handler = handler;
        entries.push({ path: ["topics", topic.name], node });
      }
    }
    return entries;
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
      }
    }
  };

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

  private handleVelodyneScan = (messageEvent: MessageEvent<VelodyneScan>): void => {
    const { topic } = messageEvent;
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    const pointCloud = this._velodyneCloudConverter.decode(messageEvent.message);
    if (!pointCloud) {
      return;
    }

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
        pointCloud.pose,
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
    let fields = this._pointCloudFieldsByTopic.get(messageEvent.topic);
    if (!fields || fields.length !== pointCloud.fields.length) {
      fields = pointCloud.fields.map((field) => field.name);
      this._pointCloudFieldsByTopic.set(messageEvent.topic, fields);
      this.updateSettingsTree();
    }

    renderable.updatePointCloud(
      pointCloud,
      messageEvent.message as RosObject,
      renderable.userData.settings,
      receiveTime,
    );
  };
}
