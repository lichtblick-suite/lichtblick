// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { toNanoSec, toSec } from "@foxglove/rostime";
import { NumericType, PointCloud as FoxglovePointCloud } from "@foxglove/schemas";
import { MessageEvent, SettingsTreeAction } from "@foxglove/studio";
import {
  createStixelMaterial,
  PointCloudHistoryRenderable,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/PointClouds";
import type { RosObject } from "@foxglove/studio-base/players/types";
import { VelodyneScan } from "@foxglove/studio-base/types/Messages";
import {
  Calibration,
  Model,
  PointCloud,
  PointFieldDataType,
  RawPacket,
  Transformer,
} from "@foxglove/velodyne-cloud";

import {
  autoSelectColorField,
  createInstancePickingMaterial,
  createPickingMaterial,
  DEFAULT_POINT_SETTINGS,
  LayerSettingsPointExtension,
  pointSettingsNode,
  pointCloudMaterial,
  POINT_CLOUD_REQUIRED_FIELDS,
} from "./pointExtensionUtils";
import type { AnyRendererSubscription, IRenderer } from "../IRenderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { VELODYNE_SCAN_DATATYPES } from "../ros";
import { topicIsConvertibleToSchema } from "../topicIsConvertibleToSchema";
import { makePose } from "../transforms";

type LayerSettingsVelodyneScans = LayerSettingsPointExtension & {
  stixelsEnabled: boolean;
};
const DEFAULT_SETTINGS = { ...DEFAULT_POINT_SETTINGS, stixelsEnabled: false };

function pointFieldDataTypeToNumericType(type: PointFieldDataType): NumericType {
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
  #transformers = new Map<Model, Transformer>();

  public decode(scan: VelodyneScan): FoxglovePointCloud | undefined {
    if (scan.packets.length === 0) {
      return undefined;
    }

    const firstPacketData = scan.packets[0]!;
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
    let transformer = this.#transformers.get(model);
    if (transformer != undefined) {
      return transformer;
    }

    transformer = new Transformer(new Calibration(model));
    this.#transformers.set(model, transformer);
    return transformer;
  }
}

export class VelodyneScans extends SceneExtension<PointCloudHistoryRenderable> {
  public static extensionId = "foxglove.VelodyneScans";
  #pointCloudFieldsByTopic = new Map<string, string[]>();
  #velodyneCloudConverter = new VelodyneCloudConverter();

  public constructor(renderer: IRenderer, name: string = VelodyneScans.extensionId) {
    super(name, renderer);
  }

  public override getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: VELODYNE_SCAN_DATATYPES,
        subscription: {
          handler: this.#handleVelodyneScan,
          filterQueue: this.#processMessageQueue.bind(this),
        },
      },
    ];
  }

  #processMessageQueue<T>(msgs: MessageEvent<T>[]): MessageEvent<T>[] {
    if (msgs.length === 0) {
      return msgs;
    }
    const msgsByTopic = _.groupBy(msgs, (msg) => msg.topic);
    const finalQueue: MessageEvent<T>[] = [];
    for (const topic in msgsByTopic) {
      const topicMsgs = msgsByTopic[topic]!;
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsVelodyneScans>
        | undefined;
      // if the topic has a decaytime add all messages to queue for topic
      if ((userSettings?.decayTime ?? DEFAULT_SETTINGS.decayTime) > 0) {
        finalQueue.push(...topicMsgs);
        continue;
      }
      const latestMsg = topicMsgs[topicMsgs.length - 1];
      if (latestMsg) {
        finalQueue.push(latestMsg);
      }
    }
    return finalQueue;
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (!topicIsConvertibleToSchema(topic, VELODYNE_SCAN_DATATYPES)) {
        continue;
      }
      const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsVelodyneScans>;
      const messageFields =
        this.#pointCloudFieldsByTopic.get(topic.name) ?? POINT_CLOUD_REQUIRED_FIELDS;
      const node: SettingsTreeNodeWithActionHandler = pointSettingsNode(
        topic,
        messageFields,
        config,
      );
      node.fields!.stixelsEnabled = {
        label: "Stixel view",
        input: "boolean",
        value: config.stixelsEnabled ?? DEFAULT_SETTINGS.stixelsEnabled,
      };
      node.handler = handler;
      node.icon = "Points";
      entries.push({ path: ["topics", topic.name], node });
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
        | Partial<LayerSettingsVelodyneScans>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...prevSettings };
      renderable.updatePointCloud(
        renderable.userData.latestPointCloud,
        renderable.userData.latestOriginalMessage,
        settings,
        renderable.userData.receiveTime,
      );
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

  #handleVelodyneScan = (messageEvent: MessageEvent<VelodyneScan>): void => {
    const { topic } = messageEvent;
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    const pointCloud = this.#velodyneCloudConverter.decode(messageEvent.message);
    if (!pointCloud) {
      return;
    }

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsVelodyneScans>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };
      if (settings.colorField == undefined) {
        autoSelectColorField(settings, pointCloud, { supportsPackedRgbModes: false });

        // Update user settings with the newly selected color field
        this.renderer.updateConfig((draft) => {
          const updatedUserSettings = { ...userSettings };
          updatedUserSettings.colorField = settings.colorField;
          updatedUserSettings.colorMode = settings.colorMode;
          updatedUserSettings.colorMap = settings.colorMap;
          draft.topics[topic] = updatedUserSettings;
        });
      }

      const material = pointCloudMaterial(settings);
      const pickingMaterial = createPickingMaterial(settings);
      const instancePickingMaterial = createInstancePickingMaterial(settings);
      const stixelMaterial = createStixelMaterial(settings);

      const messageTime = toNanoSec(pointCloud.timestamp);
      renderable = new PointCloudHistoryRenderable(topic, this.renderer, {
        receiveTime,
        messageTime,
        frameId: this.renderer.normalizeFrameId(pointCloud.frame_id),
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        latestPointCloud: pointCloud,
        latestOriginalMessage: messageEvent.message as RosObject,
        material,
        pickingMaterial,
        instancePickingMaterial,
        stixelMaterial,
      });

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    // Update the mapping of topic to point cloud field names if necessary
    let fields = this.#pointCloudFieldsByTopic.get(messageEvent.topic);
    if (!fields || fields.length !== pointCloud.fields.length) {
      fields = pointCloud.fields.map((field) => field.name);
      this.#pointCloudFieldsByTopic.set(messageEvent.topic, fields);
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
