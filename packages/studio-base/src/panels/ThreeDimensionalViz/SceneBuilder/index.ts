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
import _, { flatten, groupBy, isEqual, keyBy, mapValues, some, xor } from "lodash";
import shallowequal from "shallowequal";

import Log from "@foxglove/log";
import { Time, fromSec, isGreaterThan } from "@foxglove/rostime";
import {
  InteractionData,
  Interactive,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import MessageCollector from "@foxglove/studio-base/panels/ThreeDimensionalViz/SceneBuilder/MessageCollector";
import { MarkerMatcher } from "@foxglove/studio-base/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import { PoseListSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PoseListSettingsEditor";
import VelodyneCloudConverter from "@foxglove/studio-base/panels/ThreeDimensionalViz/VelodyneCloudConverter";
import { DATATYPE } from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/types";
import {
  foxgloveGridToOccupancyGrid,
  foxgloveLaserScanToLaserScan,
  foxglovePointCloudToPointCloud2,
  normalizePose,
  normalizePoseArray,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/normalizeMessages";
import {
  IImmutableCoordinateFrame,
  IImmutableTransformTree,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";
import {
  MarkerProvider,
  MarkerCollector,
  RenderMarkerArgs,
  NormalizedPose,
  NormalizedPoseArray,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { Frame } from "@foxglove/studio-base/panels/ThreeDimensionalViz/useFrame";
import { Topic, MessageEvent, RosObject } from "@foxglove/studio-base/players/types";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";
import {
  Color,
  Marker,
  Namespace,
  NavMsgs$OccupancyGrid,
  NavMsgs$Path,
  MutablePose,
  Pose,
  StampedMessage,
  BaseMarker,
  PoseStamped,
  VelodyneScan,
  GeometryMsgs$PolygonStamped,
  Scale,
  Point,
  Header,
  InstancedLineListMarker,
  OccupancyGridMessage,
  PointCloud2,
  GeometryMsgs$PoseArray,
  LaserScan,
  PointField,
} from "@foxglove/studio-base/types/Messages";
import { clonePose, emptyPose } from "@foxglove/studio-base/util/Pose";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";
import naturalSort from "@foxglove/studio-base/util/naturalSort";

const log = Log.getLogger(__filename);

export type TopicSettingsCollection = {
  [topicOrNamespaceKey: string]: Record<string, unknown>;
};

// builds a synthetic arrow marker from a geometry_msgs/PoseStamped
const buildSyntheticArrowMarker = (
  { topic, message }: MessageEvent<unknown>,
  poseMsg: NormalizedPose,
) => ({
  header: poseMsg.header,
  type: 103,
  pose: poseMsg.pose,
  frame_locked: true,
  interactionData: { topic, originalMessage: message },
});

export type ErrorDetails = { frameIds: Set<string> };

export type SceneErrors = {
  topicsMissingTransforms: Map<string, ErrorDetails>;
  topicsWithError: Map<string, string>;
  renderFrameId: string;
};

type SelectedNamespacesByTopic = {
  [topicName: string]: string[];
};
// constructs a scene containing all objects to be rendered
// by consuming visualization topics from frames

type MarkerMatchersByTopic = {
  [key: string]: Array<MarkerMatcher>;
};

const missingTransformMessage = (
  renderFrameId: string,
  error: ErrorDetails,
  transforms: IImmutableTransformTree,
): string => {
  if (error.frameIds.size === 0) {
    throw new Error(`Missing transform error has no frameIds`);
  }
  const frameIds = [...error.frameIds].sort().join(`>, <`);
  const s = error.frameIds.size > 1 ? "s" : ""; // for plural
  const msg = `Missing transform${s} from frame${s} <${frameIds}> to frame <${renderFrameId}>`;
  if (transforms.frames().size === 0) {
    return msg + ". No transforms found";
  }
  return msg;
};

export function getSceneErrorsByTopic(
  sceneErrors: SceneErrors,
  transforms: IImmutableTransformTree,
): {
  [topicName: string]: string[];
} {
  const res: Record<string, string[]> = {};
  const addError = (topic: string, message: string) => {
    (res[topic] ??= []).push(message);
  };
  // generic errors
  for (const [topic, message] of sceneErrors.topicsWithError) {
    addError(topic, message);
  }
  // errors related to missing transforms
  for (const [topic, error] of sceneErrors.topicsMissingTransforms) {
    addError(topic, missingTransformMessage(sceneErrors.renderFrameId, error, transforms));
  }
  return res;
}

// Only display one non-lifetime message at a time, so we filter to the last one.
export function filterOutSupersededMessages<T extends Pick<MessageEvent<unknown>, "message">>(
  messages: T[],
  datatype: string,
): T[] {
  // Later messages take precedence over earlier messages, so iterate from latest to earliest to
  // find the last one that matters.
  const reversedMessages = messages.slice().reverse();
  if (
    [
      "visualization_msgs/MarkerArray",
      "visualization_msgs/msg/MarkerArray",
      "ros.visualization_msgs.MarkerArray",
    ].includes(datatype)
  ) {
    // Many marker arrays begin with a command to "delete all markers on this topic". If we see
    // this, we can ignore any earlier messages on the topic.
    const earliestMessageToKeepIndex = reversedMessages.findIndex(({ message }) => {
      const markers = (message as { markers?: BaseMarker[] }).markers ?? [];
      return markers[0]?.action === 3;
    });
    if (earliestMessageToKeepIndex !== -1) {
      return reversedMessages.slice(0, earliestMessageToKeepIndex + 1).reverse();
    }
    return messages;
  }
  const filteredMessages = [];
  let hasSeenNonLifetimeMessage = false;
  for (const message of reversedMessages) {
    const hasLifetime = !!(message.message as BaseMarker).lifetime;
    if (hasLifetime) {
      // Show all messages that have a lifetime.
      filteredMessages.unshift(message);
    } else if (!hasSeenNonLifetimeMessage) {
      // Only show the last non-lifetime message.
      filteredMessages.unshift(message);
      hasSeenNonLifetimeMessage = true;
    }
  }
  return filteredMessages;
}

function computeMarkerPose(
  marker: Marker,
  transforms: IImmutableTransformTree,
  renderFrame: IImmutableCoordinateFrame,
  fixedFrame: IImmutableCoordinateFrame,
  currentTime: Time,
): Pose | undefined {
  // Default markers with no frame_id to the empty frame
  // (empty) frame id is our internal identifier for empty string frame_ids or undefined frame_ids
  if (renderFrame.id === "(empty)" && !marker.header.frame_id) {
    return marker.pose;
  }

  const srcFrame = transforms.frame(marker.header.frame_id);
  if (!srcFrame) {
    return undefined;
  }
  let srcTime: Time;
  let dstTime: Time;
  if (marker.frame_locked) {
    srcTime = currentTime;
    dstTime = currentTime;
  } else {
    srcTime = marker.header.stamp;
    dstTime = currentTime;
  }
  return renderFrame.apply(emptyPose(), marker.pose, fixedFrame, srcFrame, dstTime, srcTime);
}

export default class SceneBuilder implements MarkerProvider {
  public topicsByName: {
    [topicName: string]: Topic;
  } = {};
  public markers: Marker[] = [];
  // A batch of messages organized by topic. This is the source material for
  // rendering. Not to be confused with the graphics rendering frame, or a
  // CoordinateFrame
  public frame?: Frame;
  public errors: SceneErrors = {
    renderFrameId: "",
    topicsMissingTransforms: new Map(),
    topicsWithError: new Map(),
  };
  public errorsByTopic: {
    [topicName: string]: string[];
  } = {};
  public maps = [];
  public flattenedZHeightPose?: Pose;
  public scene = {};
  public collectors: {
    [key: string]: MessageCollector;
  } = {};
  private _transforms?: IImmutableTransformTree;
  private _missingTfFrameIds = new Set<string>();
  private _clock?: Time;
  private _playerId?: string;
  private _settingsByKey: TopicSettingsCollection = {};
  private _onForceUpdate?: () => void;

  // When not-empty, fade any markers that don't match
  private _highlightMarkerMatchersByTopic: MarkerMatchersByTopic = {};

  // When not-empty, override the color of matching markers
  private _colorOverrideMarkerMatchersByTopic: MarkerMatchersByTopic = {};

  // Decodes `velodyne_msgs/VelodyneScan` ROS messages into
  // `VelodyneScanDecoded` objects that mimic `PointCloud2` and can be rendered
  // as point clouds
  private _velodyneCloudConverter = new VelodyneCloudConverter();

  public allNamespaces: Namespace[] = [];
  public enabledNamespaces: Namespace[] = [];
  public selectedNamespacesByTopic?: { [topicName: string]: Set<string> };
  public flatten: boolean = false;

  // list of topics that need to be rerendered because the frame has new values
  // or because a prop affecting its rendering was changed
  public topicsToRender: Set<string> = new Set();

  // stored message arrays allowing us to re-render topics even when the latest
  // frame does not not contain that topic
  public lastSeenMessages: {
    [key: string]: MessageEvent<unknown>[];
  } = {};

  public constructor() {}

  public clear(): void {
    for (const topicName of Object.keys(this.topicsByName)) {
      const collector = this.collectors[topicName];
      if (collector) {
        collector.flush();
      }
    }
  }

  public setPlayerId(playerId: string): void {
    if (this._playerId !== playerId) {
      this.errors = {
        renderFrameId: "",
        topicsMissingTransforms: new Map(),
        topicsWithError: new Map(),
      };
      this._updateErrorsByTopic();
    }
    this._playerId = playerId;
  }

  public setSettingsByKey(settings: TopicSettingsCollection): void {
    this._settingsByKey = settings;
  }

  // set the topics the scene builder should consume from each frame
  public setTopics(topics: Topic[]): void {
    const topicsToFlush = Object.keys(this.topicsByName).filter(
      (topicName) => !topics.find((other) => other.name === topicName),
    );
    // Sort the topics by name so the render order is consistent.
    this.topicsByName = keyBy(topics.slice().sort(naturalSort("name")), "name");
    // IMPORTANT: when topics change, we also need to reset the frame so that
    // setFrame gets called correctly to set the topicsToRender and lastSeenMessages
    this.frame = {};
    // Delete message collectors we don't need anymore
    topicsToFlush.forEach((topicName) => {
      const collector = this.collectors[topicName];
      if (collector) {
        collector.flush();
        delete this.collectors[topicName];
      }
    });
  }

  public setFrame(frame: Frame): void {
    if (this.frame === frame) {
      return;
    }
    this.frame = frame;
    for (const topicName of Object.keys(this.topicsByName)) {
      if (topicName in frame) {
        this.topicsToRender.add(topicName);
      }
    }

    // Note we save even topics that are not rendered since they may be used by non-rendered topics
    Object.assign(this.lastSeenMessages, frame);
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  public setFlattenMarkers(_flatten: boolean): void {
    this.flatten = _flatten;
  }

  public setEnabledNamespaces(namespaces: Namespace[]): void {
    this.enabledNamespaces = namespaces;
  }

  public setSelectedNamespacesByTopic(selectedNamespacesByTopic: SelectedNamespacesByTopic): void {
    // We need to update topicsToRender here so changes to the selected namespaces will appear on the next render()
    Object.keys(selectedNamespacesByTopic).forEach((topicName) => {
      const newNamespaces = selectedNamespacesByTopic[topicName];
      const previousNamespaces = [...(this.selectedNamespacesByTopic?.[topicName] ?? [])];
      if (xor(newNamespaces, previousNamespaces).length > 0) {
        this._markTopicToRender(topicName);
      }
    });
    this.selectedNamespacesByTopic = mapValues(
      selectedNamespacesByTopic,
      (namespaces) => new Set(namespaces),
    );
  }

  public setHighlightedMatchers(markerMatchers: Array<MarkerMatcher>): void {
    const markerMatchersByTopic = groupBy<MarkerMatcher>(markerMatchers, ({ topic }) => topic);
    this._addTopicsToRenderForMarkerMatchers(this._highlightMarkerMatchersByTopic, markerMatchers);
    this._highlightMarkerMatchersByTopic = markerMatchersByTopic;
  }

  public setColorOverrideMatchers(markerMatchers: Array<MarkerMatcher>): void {
    const markerMatchersByTopic = groupBy<MarkerMatcher>(markerMatchers, ({ topic }) => topic);
    this._addTopicsToRenderForMarkerMatchers(
      this._colorOverrideMarkerMatchersByTopic,
      markerMatchers,
    );
    this._colorOverrideMarkerMatchersByTopic = markerMatchersByTopic;
  }

  private _addTopicsToRenderForMarkerMatchers(
    previousMarkerMatchersByTopic: MarkerMatchersByTopic,
    newMarkerMatchers: Array<MarkerMatcher>,
  ): void {
    const matchersBefore = flatten(Object.keys(previousMarkerMatchersByTopic)).flatMap(
      (topic) => previousMarkerMatchersByTopic[topic],
    );
    // If any of the matchers have changed, we need to rerender all of the topics
    if (!shallowequal(matchersBefore, newMarkerMatchers)) {
      Object.keys(this.topicsByName).forEach((name) => this._markTopicToRender(name));
    }
  }

  private _markTopicToRender(topicName: string): void {
    if (this.topicsByName[topicName]) {
      this.topicsToRender.add(topicName);
    }
  }

  public hasErrors(): boolean {
    return this.errors.topicsMissingTransforms.size !== 0 || this.errors.topicsWithError.size !== 0;
  }

  public setOnForceUpdate(callback: () => void): void {
    this._onForceUpdate = callback;
  }

  private _addError(map: Map<string, ErrorDetails>, topic: string): ErrorDetails {
    let values = map.get(topic);
    if (!values) {
      values = { frameIds: new Set() };
      map.set(topic, values);
    }
    return values;
  }

  private _setTopicError = (topic: string, message: string): void => {
    this.errors.topicsWithError.set(topic, message);
    this._updateErrorsByTopic();
  };

  // Update the field anytime the errors change in order to generate a new
  // object to trigger TopicTree to rerender
  private _updateErrorsByTopic(): void {
    if (!this._transforms) {
      return;
    }

    const errorsByTopic = getSceneErrorsByTopic(this.errors, this._transforms);
    if (!isEqual(this.errorsByTopic, errorsByTopic)) {
      this.errorsByTopic = errorsByTopic;
      this._onForceUpdate?.();
    }
  }

  // Keep a unique set of all seen namespaces
  private _consumeNamespace(topic: string, name: string): void {
    if (some(this.allNamespaces, (ns) => ns.topic === topic && ns.name === name)) {
      return;
    }
    this.allNamespaces = this.allNamespaces.concat([{ topic, name }]);
    this._onForceUpdate?.();
  }

  // Only public for tests
  public namespaceIsEnabled(topic: string, name: string): boolean {
    if (this.selectedNamespacesByTopic) {
      // enable all namespaces under a topic if it's not already set
      return this.selectedNamespacesByTopic[topic]?.has(name) ?? true;
    }
    return some(this.enabledNamespaces, (ns) => ns.topic === topic && ns.name === name);
  }

  private _consumeMarkerArray = (
    topic: string,
    message: { markers: readonly BaseMarker[] },
  ): void => {
    for (const marker of message.markers) {
      this._consumeMarker(topic, marker);
    }
  };

  private _consumeMarker(topic: string, message: BaseMarker): void {
    const namespace = message.ns;
    if (namespace.length > 0) {
      // Consume namespaces even if the message is later discarded
      // Otherwise, the namespace won't be shown as available.
      this._consumeNamespace(topic, namespace);
      if (!this.namespaceIsEnabled(topic, namespace)) {
        return;
      }
    }

    // Marker names are used to identify previously rendered markers for "deletes" and over-writing
    // "adds".
    // In each topic, the namespace (`ns`) and identifier (`id`) uniquely identify the marker.
    // See https://github.com/ros-visualization/rviz/blob/4b6c0f4/src/rviz/default_plugin/markers/marker_base.h#L56
    // and https://github.com/ros-visualization/rviz/blob/4b6c0f4/src/rviz/default_plugin/marker_display.cpp#L422
    const name = `${topic}/${namespace}/${message.id}`;
    switch (message.action) {
      case 0:
        // add
        break;
      case 1:
        // deprecated in ros
        this._setTopicError(topic, "Marker.action=1 is deprecated");

        return;
      case 2:
        // delete
        this.collectors[topic]!.deleteMarker(name);
        return;
      case 3:
        this.collectors[topic]!.deleteAll();
        return;
      default:
        this._setTopicError(topic, `Unsupported action type: ${message.action}`);

        return;
    }

    // Check if this marker has a non-zero lifetime and is already expired
    const currentTime = this._clock;
    if (currentTime) {
      if (MessageCollector.markerIsExpired(message.lifetime, message.header.stamp, currentTime)) {
        const markerId = `${message.ns ? message.ns + ":" : ""}${message.id}`;
        this._setTopicError(topic, `Received expired marker ${markerId}`);
        return;
      }
    }

    const color = message.color ?? { r: 0, g: 0, b: 0, a: 0 };

    // Allow topic settings to override marker color (see MarkerSettingsEditor.js)
    let { overrideColor } = (this._settingsByKey[`ns:${topic}:${namespace}`] ??
      this._settingsByKey[`t:${topic}`] ??
      {}) as { overrideColor?: Color };

    // Check for matching colorOverrideMarkerMatchers for this topic
    const colorOverrideMarkerMatchers = this._colorOverrideMarkerMatchersByTopic[topic] ?? [];
    const matchingMatcher = colorOverrideMarkerMatchers.find(({ checks = [] }) =>
      checks.every(({ markerKeyPath = [], value }) => {
        // Get the item at the key path
        // i.e. key path: ["foo", "bar"] would return "value" in an object like {foo: {bar: "value" }}
        const markerValue = markerKeyPath.reduce(
          (item, key) => item?.[key] as Record<string, unknown> | undefined,
          message as Record<string, unknown> | undefined,
        );
        return value === markerValue;
      }),
    );
    if (matchingMatcher) {
      overrideColor = matchingMatcher.color;
    }

    // Set later in renderMarkers so it be applied to markers generated in _consumeNonMarkerMessage
    const highlighted = false;
    const interactionData: InteractionData = {
      topic,
      highlighted,
      originalMessage: message as RosObject,
    };
    const lifetime = message.lifetime;

    // This "marker-ish" thing is an unholy union of many drawable types...
    const marker: {
      type: number;
      scale: Scale;
      lifetime?: Time;
      pose: Pose;
      interactionData: InteractionData;
      color?: Color;
      colors?: readonly Color[];
      points?: Point[];
      id: string | number;
      ns: string;
      header: Header;
      action: 0 | 1 | 2 | 3;
      frame_locked: boolean;
      text?: string;
      poses?: readonly Pose[];
      closed?: boolean;
      mesh_resource?: string;
      mesh_use_embedded_materials?: boolean;
      metadataByIndex?: readonly Readonly<unknown[]>[];
    } = {
      type: (message as unknown as { type: number }).type,
      scale: message.scale,
      lifetime,
      pose: message.pose,
      interactionData,
      color: overrideColor ?? color,
      colors: overrideColor ? [] : message.colors,
      points: message.points,
      id: message.id,
      ns: message.ns,
      header: message.header,
      action: message.action,
      frame_locked: message.frame_locked,
      mesh_resource: message.mesh_resource,
      mesh_use_embedded_materials: message.mesh_use_embedded_materials,
    };
    // Marker fields
    if ("text" in message) {
      marker.text = message.text;
    }
    // InstancedLineList fields. Check some fields, some fixtures do not include them all.
    if ("metadataByIndex" in message) {
      marker.poses = (message as { poses?: readonly Pose[] }).poses;
      marker.metadataByIndex = (message as InstancedLineListMarker).metadataByIndex;
      marker.closed = (message as { closed?: boolean }).closed;
    }
    this.collectors[topic]!.addMarker(marker, name);
  }

  private _consumeOccupancyGrid = (topic: string, message: NavMsgs$OccupancyGrid): void => {
    const type = 101;
    const name = `${topic}/${type}`;

    const { frameLocked } = (this._settingsByKey[`t:${topic}`] ?? {}) as { frameLocked?: boolean };

    const { header, info, data } = message;
    if (info.width * info.height !== data.length) {
      this._setTopicError(
        topic,
        `OccupancyGrid data length (${data.length}) does not match width*height (${info.width}x${info.height}).`,
      );
      return;
    }
    const mappedMessage = {
      header: {
        frame_id: header.frame_id,
        stamp: header.stamp,
        seq: header.seq,
      },
      info: {
        map_load_time: info.map_load_time,
        resolution: info.resolution,
        width: info.width,
        height: info.height,
        origin: info.origin,
      },
      data,
      type,
      name,
      pose: clonePose(info.origin),
      frame_locked: frameLocked ?? false,
      interactionData: { topic, originalMessage: message },
    };

    // if we neeed to flatten the ogrid clone the position and change the z to match the flattenedZHeightPose
    if (mappedMessage.pose.position.z === 0 && this.flattenedZHeightPose && this.flatten) {
      mappedMessage.pose.position.z = this.flattenedZHeightPose.position.z;
    }
    this.collectors[topic]!.addNonMarker(topic, mappedMessage as unknown as Interactive<unknown>);
  };

  private _consumeNavMsgsPath = (topic: string, message: NavMsgs$Path): void => {
    const topicSettings = this._settingsByKey[`t:${topic}`];

    if (message.poses.length === 0) {
      return;
    }
    for (const pose of message.poses) {
      if (pose.header.frame_id !== message.header.frame_id) {
        this._setTopicError(topic, "Path poses must all have the same frame_id");
        return;
      }
    }
    const newMessage = {
      header: message.header,
      // Future: display orientation of the poses in the path
      points: message.poses.map((pose) => pose.pose.position),
      closed: false,
      scale: { x: 0.2 },
      color: topicSettings?.overrideColor ?? { r: 0.5, g: 0.5, b: 1, a: 1 },
    };
    this._consumeNonMarkerMessage(topic, newMessage, 4 /* line strip */, message);
  };

  private _consumePoseListAsLine = (topic: string, message: NormalizedPoseArray): void => {
    const topicSettings = this._settingsByKey[`t:${topic}`] as PoseListSettings | undefined;

    if (message.poses.length === 0) {
      return;
    }
    const newMessage = {
      header: message.header,
      // Future: display orientation of the poses in the path
      points: message.poses.map((pose) => pose.position),
      closed: false,
      scale: { x: topicSettings?.lineThickness ?? 0.2 },
      color: topicSettings?.overrideColor ?? { r: 0.5, g: 0.5, b: 1, a: 1 },
    };
    this._consumeNonMarkerMessage(topic, newMessage, 4 /* line strip */, message);
  };

  private _consumeLaserScan = (topic: string, scan: LaserScan): void => {
    const hasIntensity =
      (ArrayBuffer.isView(scan.intensities) || Array.isArray(scan.intensities)) &&
      scan.intensities.length > 0;
    const pointStep = hasIntensity ? 48 : 40;

    const data = new Uint8Array(pointStep * scan.ranges.length);
    const view = new DataView(data.buffer);
    for (let i = 0; i < scan.ranges.length; i++) {
      const offset = i * pointStep;
      const distance = Math.min(scan.range_max, Math.max(scan.range_min, scan.ranges[i] ?? 0));
      const intensity = (scan.intensities[i] ?? Number.NaN) as number;
      const angle = Math.min(scan.angle_max, scan.angle_min + i * scan.angle_increment);
      const x = distance * Math.cos(angle);
      const y = distance * Math.sin(angle);

      view.setFloat64(offset + 0, x, true);
      view.setFloat64(offset + 8, y, true);
      view.setFloat64(offset + 16, 0, true);
      view.setFloat64(offset + 24, distance, true);
      view.setFloat64(offset + 32, angle, true);
      if (hasIntensity) {
        view.setFloat64(offset + 40, intensity, true);
      }
    }

    const fields: PointField[] = [
      { name: "x", offset: 0, datatype: DATATYPE.FLOAT64, count: 1 },
      { name: "y", offset: 8, datatype: DATATYPE.FLOAT64, count: 1 },
      { name: "z", offset: 16, datatype: DATATYPE.FLOAT64, count: 1 },
      { name: "distance", offset: 24, datatype: DATATYPE.FLOAT64, count: 1 },
      { name: "angle", offset: 32, datatype: DATATYPE.FLOAT64, count: 1 },
    ];
    if (hasIntensity) {
      fields.push({ name: "intensity", offset: 40, datatype: DATATYPE.FLOAT64, count: 1 });
    }

    const pcl: PointCloud2 = {
      header: scan.header,
      fields,
      height: 1,
      width: scan.ranges.length,
      is_bigendian: false,
      point_step: pointStep,
      row_step: pointStep * scan.ranges.length,
      data,
      is_dense: 1,
      type: 102,
    };
    this._consumeNonMarkerMessage(topic, pcl, 102);
  };

  private _consumeColor = (
    msg: MessageEvent<Color | FoxgloveMessages["foxglove.Color"]>,
    datatype: string,
  ): void => {
    const color = mightActuallyBePartial(msg.message);
    if (color.r == undefined || color.g == undefined || color.b == undefined) {
      return;
    }
    let finalColor: Color;
    if (
      datatype === "foxglove.Color" ||
      datatype === "foxglove_msgs/Color" ||
      datatype === "foxglove_msgs/msg/Color"
    ) {
      finalColor = msg.message as FoxgloveMessages["foxglove.Color"];
    } else {
      finalColor = { r: color.r / 255, g: color.g / 255, b: color.b / 255, a: color.a ?? 1 };
    }
    const newMessage: StampedMessage & { color: Color } = {
      header: { frame_id: "", stamp: msg.receiveTime, seq: 0 },
      color: finalColor,
    };
    this._consumeNonMarkerMessage(msg.topic, newMessage, 110);
  };

  private _consumeNonMarkerMessage = (
    topic: string,
    drawData: Record<string, unknown>,
    type: number,
    originalMessage?: unknown,
  ): void => {
    // some callers of _consumeNonMarkerMessage provide LazyMessages and others provide regular objects
    const obj =
      "toJSON" in drawData
        ? (drawData as { toJSON: () => Record<string, unknown> }).toJSON()
        : drawData;
    const mappedMessage = {
      ...obj,
      type,
      pose: emptyPose(),
      frame_locked: false,
      interactionData: { topic, originalMessage: originalMessage ?? drawData },
    };

    if (type === 102) {
      // We don't support big-endian point clouds yet. Register an error and omit this marker.
      if (obj.is_bigendian === true) {
        this._setTopicError(topic, "Unsupported big endian point cloud.");
        return;
      }

      // Register a per-topic error for empty point cloud data and omit this marker.
      if (obj.data instanceof Uint8Array && obj.data.length === 0) {
        this._setTopicError(topic, "Point cloud data is empty.");
        return;
      }
    }

    // If a decay time is available, we assign a lifetime to this message
    // Do not automatically assign a 0 (zero) decay time since that translates
    // to an infinite lifetime. But do allow for 0 values based on user preferences.
    const decayTimeInSec = this._settingsByKey[`t:${topic}`]?.decayTime as number | undefined;
    const lifetime =
      decayTimeInSec != undefined && decayTimeInSec !== 0 ? fromSec(decayTimeInSec) : undefined;

    this.collectors[topic]?.addNonMarker(
      topic,
      mappedMessage as unknown as Interactive<unknown>,
      lifetime,
    );
  };

  public setCurrentTime = (currentTime: { sec: number; nsec: number }): void => {
    this._clock = currentTime;
    // set the new clock value in all existing collectors
    // including those for topics not included in this frame,
    // so each can expire markers if they need to
    for (const collector of Object.values(this.collectors)) {
      collector.setClock(this._clock);
    }
  };

  // extracts renderable markers from the frame
  public render(): void {
    for (const topic of this.topicsToRender) {
      try {
        this._consumeTopic(topic);
      } catch (error) {
        log.error(error);
        this._setTopicError(topic, (error as Error).toString());
      }
    }
    this.topicsToRender.clear();
  }

  private _consumeMessage = (topic: string, datatype: string, msg: MessageEvent<unknown>): void => {
    const { message } = msg;
    switch (datatype) {
      case "visualization_msgs/Marker":
      case "visualization_msgs/msg/Marker":
      case "ros.visualization_msgs.Marker":
        this._consumeMarker(topic, message as BaseMarker);
        break;
      case "visualization_msgs/MarkerArray":
      case "visualization_msgs/msg/MarkerArray":
      case "ros.visualization_msgs.MarkerArray":
        this._consumeMarkerArray(topic, message as { markers: BaseMarker[] });
        break;
      case "geometry_msgs/PoseArray":
      case "geometry_msgs/msg/PoseArray":
      case "ros.geometry_msgs.PoseArray":
      case "foxglove_msgs/PosesInFrame":
      case "foxglove_msgs/msg/PosesInFrame":
      case "foxglove.PosesInFrame": {
        const topicSettings = this._settingsByKey[`t:${topic}`] as PoseListSettings | undefined;
        const normalized = normalizePoseArray(
          message as GeometryMsgs$PoseArray | FoxgloveMessages["foxglove.PosesInFrame"],
          datatype,
        );
        if (topicSettings?.displayType === "line") {
          this._consumePoseListAsLine(topic, normalized);
        } else {
          this._consumeNonMarkerMessage(topic, normalized, 111);
        }
        break;
      }
      case "geometry_msgs/PoseStamped":
      case "geometry_msgs/msg/PoseStamped":
      case "ros.geometry_msgs.PoseStamped":
      case "foxglove_msgs/PoseInFrame":
      case "foxglove_msgs/msg/PoseInFrame":
      case "foxglove.PoseInFrame": {
        const poseMsg = msg as MessageEvent<PoseStamped | FoxgloveMessages["foxglove.PoseInFrame"]>;
        this.collectors[topic]!.addNonMarker(
          topic,
          buildSyntheticArrowMarker(
            poseMsg,
            normalizePose(poseMsg.message, datatype),
          ) as Interactive<unknown>,
        );
        break;
      }
      case "nav_msgs/OccupancyGrid":
      case "nav_msgs/msg/OccupancyGrid":
      case "ros.nav_msgs.OccupancyGrid":
        this._consumeOccupancyGrid(topic, message as NavMsgs$OccupancyGrid);
        break;
      case "foxglove_msgs/Grid":
      case "foxglove_msgs/msg/Grid":
      case "foxglove.Grid":
        try {
          this._consumeOccupancyGrid(
            topic,
            foxgloveGridToOccupancyGrid(message as FoxgloveMessages["foxglove.Grid"]),
          );
        } catch (err) {
          this._setTopicError(topic, (err as Error).message);
        }
        break;
      case "nav_msgs/Path":
      case "nav_msgs/msg/Path":
      case "ros.nav_msgs.Path": {
        this._consumeNavMsgsPath(topic, message as NavMsgs$Path);
        break;
      }
      case "sensor_msgs/PointCloud2":
      case "sensor_msgs/msg/PointCloud2":
      case "ros.sensor_msgs.PointCloud2":
        this._consumeNonMarkerMessage(topic, message as StampedMessage, 102);
        break;
      case "foxglove_msgs/PointCloud":
      case "foxglove_msgs/msg/PointCloud":
      case "foxglove.PointCloud":
        try {
          this._consumeNonMarkerMessage(
            topic,
            foxglovePointCloudToPointCloud2(message as FoxgloveMessages["foxglove.PointCloud"]),
            102,
            message,
          );
        } catch (err) {
          this._setTopicError(topic, (err as Error).message);
        }
        break;
      case "velodyne_msgs/VelodyneScan":
      case "velodyne_msgs/msg/VelodyneScan":
      case "ros.velodyne_msgs.VelodyneScan": {
        const converted = this._velodyneCloudConverter.decode(message as VelodyneScan);
        if (converted) {
          this._consumeNonMarkerMessage(topic, converted, 102);
        }
        break;
      }
      case "sensor_msgs/LaserScan":
      case "sensor_msgs/msg/LaserScan":
      case "ros.sensor_msgs.LaserScan":
        this._consumeLaserScan(topic, message as LaserScan);
        break;
      case "foxglove_msgs/LaserScan":
      case "foxglove_msgs/msg/LaserScan":
      case "foxglove.LaserScan":
        try {
          this._consumeLaserScan(
            topic,
            foxgloveLaserScanToLaserScan(message as FoxgloveMessages["foxglove.LaserScan"]),
          );
        } catch (err) {
          this._setTopicError(topic, (err as Error).message);
        }
        break;
      case "std_msgs/ColorRGBA":
      case "std_msgs/msg/ColorRGBA":
      case "ros.std_msgs.ColorRGBA":
      case "foxglove_msgs/Color":
      case "foxglove_msgs/msg/Color":
      case "foxglove.Color":
        this._consumeColor(
          msg as MessageEvent<Color | FoxgloveMessages["foxglove.Color"]>,
          datatype,
        );
        break;
      case "geometry_msgs/PolygonStamped":
      case "geometry_msgs/msg/PolygonStamped":
      case "ros.geometry_msgs.PolygonStamped": {
        // convert Polygon to a line strip
        const polygonStamped = message as GeometryMsgs$PolygonStamped;
        const polygon = polygonStamped.polygon;
        if (polygon.points.length === 0) {
          break;
        }
        const newMessage = {
          header: polygonStamped.header,
          points: polygon.points,
          closed: true,
          scale: { x: 0.2 },
          color: { r: 0, g: 1, b: 0, a: 1 },
        };
        this._consumeNonMarkerMessage(
          topic,
          newMessage,
          4,
          /* line strip */
          message,
        );
        break;
      }
      default: {
        if (datatype.endsWith("/Color") || datatype.endsWith("/ColorRGBA")) {
          this._consumeColor(msg as MessageEvent<Color>, datatype);
          break;
        }
      }
    }
  };

  private _consumeTopic = (topic: string) => {
    if (!this.frame) {
      return;
    }
    const messages = this.frame[topic] ?? this.lastSeenMessages[topic];
    if (!messages) {
      return;
    }

    this.errors.topicsMissingTransforms.delete(topic);
    this.errors.topicsWithError.delete(topic);
    this.collectors[topic] ??= new MessageCollector();
    this.collectors[topic]?.setClock(this._clock ?? { sec: 0, nsec: 0 });
    this.collectors[topic]?.flush();

    const datatype = this.topicsByName[topic]?.schemaName;
    if (datatype == undefined) {
      return;
    }

    // If topic has a decayTime set, markers with no lifetime will get one
    // later on, so we don't need to filter them. Note: A decayTime of zero is
    // defined as an infinite lifetime
    const decayTime = this._settingsByKey[`t:${topic}`]?.decayTime;
    const filteredMessages =
      decayTime == undefined ? filterOutSupersededMessages(messages, datatype) : messages;
    for (const message of filteredMessages) {
      this._consumeMessage(topic, datatype, message);
    }
  };

  public renderMarkers({ add, transforms, renderFrame, fixedFrame, time }: RenderMarkerArgs): void {
    this._transforms = transforms;

    this.errors.renderFrameId = renderFrame.id;
    this.errors.topicsMissingTransforms.clear();

    for (const topic of Object.values(this.topicsByName)) {
      const collector = this.collectors[topic.name];
      if (!collector) {
        continue;
      }

      this._missingTfFrameIds.clear();

      const topicMarkers = collector.getMessages();
      for (const message of topicMarkers) {
        const marker = message as unknown as Interactive<BaseMarker & Marker>;
        if (marker.ns !== "") {
          if (!this.namespaceIsEnabled(topic.name, marker.ns)) {
            continue;
          }
        }

        // If this marker's header.stamp is in the future, don't render it
        if (isGreaterThan(marker.header.stamp, time)) {
          continue;
        }
        // If this marker has an expired lifetime, don't render it
        if (MessageCollector.markerIsExpired(marker.lifetime, marker.header.stamp, time)) {
          continue;
        }

        const pose = computeMarkerPose(marker, transforms, renderFrame, fixedFrame, time);
        if (!pose) {
          this._missingTfFrameIds.add(marker.header.frame_id);
          continue;
        }

        // Highlight if marker matches any of this topic's highlightMarkerMatchers; dim other markers
        // Markers that are not re-processed on this frame (i.e. older markers whose lifetime has
        // not expired) do not get a new copy of interactionData, so they always need to be reset.
        const markerMatches = (this._highlightMarkerMatchersByTopic[topic.name] ?? []).some(
          ({ checks = [] }) =>
            checks.every(({ markerKeyPath, value }) => {
              const markerValue = markerKeyPath ? _.get(message, markerKeyPath) : message;
              return value === markerValue;
            }),
        );
        marker.interactionData.highlighted = markerMatches;

        const settings = this._settingsByKey[`t:${topic.name}`];
        if (settings) {
          (marker as { settings?: unknown }).settings = settings;
        }
        const origPose = marker.pose;
        this._addMarkerToCollector(add, topic, marker, pose);
        (marker as { pose: MutablePose }).pose = origPose;
      }

      if (this._missingTfFrameIds.size > 0) {
        const error = this._addError(this.errors.topicsMissingTransforms, topic.name);
        for (const frameId of this._missingTfFrameIds) {
          error.frameIds.add(frameId);
        }
      }
    }

    const errorsByTopic = getSceneErrorsByTopic(this.errors, transforms);
    if (!isEqual(this.errorsByTopic, errorsByTopic)) {
      this.errorsByTopic = errorsByTopic;
    }
  }

  private _addMarkerToCollector(
    add: MarkerCollector,
    topic: Topic,
    originalMarker: Marker,
    pose: MutablePose,
  ) {
    let marker = originalMarker as
      | Marker
      | OccupancyGridMessage
      | PointCloud2
      | (NormalizedPose & { type: 103 })
      | (NormalizedPoseArray & { type: 111; pose: Pose });
    switch (marker.type) {
      case 1: // CubeMarker
      case 2: // SphereMarker
      case 3: // CylinderMarker
        marker = { ...marker, pose, points: undefined } as unknown as typeof marker;
        break;
      case 4: // LineStripMarker
        marker = { ...marker, pose, primitive: "line strip" };
        break;
      case 5: // LineListMarker
        marker = { ...marker, pose, primitive: "lines" };
        break;
      case 0: // ArrowMarker
      case 6: // CubeListMarker
      case 7: // SphereListMarker
      case 8: // PointsMarker
      case 9: // TextMarker
      case 10: // MeshMarker
      case 11: // TriangleListMarker
      case 102: // PointCloud2
      case 103: // PoseStamped
      case 108: // InstanceLineListMarker
      case 110: // ColorMarker
      case 111: // PoseArray
      case 101: // OccupancyGridMessage
        marker = { ...marker, pose };
        break;
      default:
        break;
    }

    // If this marker has fewer colors specified than the number of points,
    // use Marker.color for the remaining points
    const markerWithPoints = marker as { points?: Point[]; colors?: Color[]; color?: Color };
    if (
      markerWithPoints.points &&
      markerWithPoints.points.length > 0 &&
      markerWithPoints.colors &&
      markerWithPoints.colors.length > 0 &&
      markerWithPoints.colors.length < markerWithPoints.points.length
    ) {
      const color = markerWithPoints.color ?? { r: 0, g: 0, b: 0, a: 1 };
      while (markerWithPoints.colors.length < markerWithPoints.points.length) {
        markerWithPoints.colors.push(color);
      }
    }

    // allow topic settings to override renderable marker command (see MarkerSettingsEditor.js)
    const { overrideCommand } = this._settingsByKey[`t:${topic.name}`] ?? {};

    switch (marker.type) {
      case 0:
        return add.arrow(marker);
      case 1:
        return add.cube(marker);
      case 2:
        return add.sphere(marker);
      case 3:
        return add.cylinder(marker);
      case 4:
        if (overrideCommand === "LinedConvexHull") {
          return add.linedConvexHull(marker);
        }

        return add.lineStrip(marker);
      case 5:
        if (overrideCommand === "LinedConvexHull") {
          return add.linedConvexHull(marker);
        }

        return add.lineList(marker);
      case 6:
        return add.cubeList(marker);
      case 7:
        return add.sphereList(marker);
      case 8:
        return add.points(marker);
      case 9:
        return add.text(marker);
      case 10:
        return add.mesh(marker);
      case 11:
        return add.triangleList(marker);
      case 101:
        return add.grid(marker);
      case 102: {
        // PointCloud decoding requires x, y, and z fields and will fail if all are not present.
        // We check for the fields here so we can present the user with a topic error prior to decoding.
        const fieldNames: { [key: string]: boolean } = {};
        for (const field of marker.fields) {
          fieldNames[field.name] = true;
        }

        let missingFields = "";
        if (fieldNames.x == undefined) {
          missingFields += "x";
        }
        if (fieldNames.y == undefined) {
          missingFields += " y";
        }
        if (fieldNames.z == undefined) {
          missingFields += " z";
        }
        if (missingFields.length > 0) {
          this._setTopicError(
            topic.name,
            `Point cloud is missing required fields: ${missingFields}`,
          );
          return;
        }

        return add.pointcloud(marker);
      }
      case 103:
        return add.poseMarker(marker);
      case 108:
        return add.instancedLineList(marker);
      case 110:
        return add.color(marker);
      case 111:
        return add.poseMarker(marker);
      default: {
        this._setTopicError(
          topic.name,
          `Unsupported marker type: ${(marker as { type: number }).type}`,
        );
      }
    }
  }
}
