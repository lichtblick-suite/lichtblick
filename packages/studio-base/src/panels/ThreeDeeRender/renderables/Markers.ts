// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { DeepPartial } from "ts-essentials";

import { Topic } from "@foxglove/studio";
import {
  SettingsTreeChildren,
  SettingsTreeNode,
} from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import { Renderer } from "../Renderer";
import { Marker } from "../ros";
import { LayerSettingsMarker, LayerType } from "../settings";
import { TopicMarkers } from "./TopicMarkers";

export class Markers extends THREE.Object3D {
  renderer: Renderer;
  topics = new Map<string, TopicMarkers>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    renderer.setSettingsNodeProvider(LayerType.Marker, (topicConfig, topic) =>
      settingsNode(topicConfig, topic, this.topics),
    );
  }

  dispose(): void {
    for (const topicMarker of this.topics.values()) {
      topicMarker.dispose();
    }
    this.topics.clear();
  }

  addMarkerMessage(topic: string, marker: Marker): void {
    let topicMarkers = this.topics.get(topic);
    if (!topicMarkers) {
      topicMarkers = new TopicMarkers(topic, this.renderer);
      this.topics.set(topic, topicMarkers);
      this.add(topicMarkers);
    }
    const prevNsCount = topicMarkers.namespaces.size;
    topicMarkers.addMarkerMessage(marker);

    // If the topic has a new namespace, rebuild the settings node for this topic
    if (prevNsCount !== topicMarkers.namespaces.size) {
      this.renderer.emit("settingsTreeChange", { path: ["topics", topic] });
    }
  }

  setTopicSettings(topic: string, settings: DeepPartial<LayerSettingsMarker>): void {
    const topicMarkers = this.topics.get(topic);
    if (topicMarkers) {
      // Update the top-level marker topic settings
      const curSettings = topicMarkers.userData.settings;
      curSettings.visible = settings.visible ?? curSettings.visible;

      if (settings.namespaces) {
        // Update individual marker namespace settings
        for (const [ns, entry] of Object.entries(settings.namespaces)) {
          if (entry) {
            const markerNs = topicMarkers.namespaces.get(ns);
            if (markerNs) {
              markerNs.settings.visible = entry.visible ?? markerNs.settings.visible;
            }
          }
        }
      }
    }
  }

  startFrame(currentTime: bigint): void {
    const renderFrameId = this.renderer.renderFrameId;
    const fixedFrameId = this.renderer.fixedFrameId;
    if (renderFrameId == undefined || fixedFrameId == undefined) {
      this.visible = false;
      return;
    }
    this.visible = true;

    for (const topicMarker of this.topics.values()) {
      topicMarker.startFrame(currentTime, renderFrameId, fixedFrameId);
    }
  }
}

function settingsNode(
  _topicConfig: Partial<LayerSettingsMarker>,
  topic: Topic,
  topicMarkersByTopic: Map<string, TopicMarkers>,
): SettingsTreeNode {
  const node: SettingsTreeNode = { icon: "Shapes" };

  // Create a list of all the namespaces for this topic
  const topicMarkers = topicMarkersByTopic.get(topic.name);
  const namespaces = Array.from(topicMarkers?.namespaces.values() ?? [])
    .filter((ns) => ns.namespace !== "")
    .sort((a, b) => a.namespace.localeCompare(b.namespace));
  if (namespaces.length > 0) {
    const children: SettingsTreeChildren = {};
    node.children = children;
    for (const ns of namespaces) {
      children[`ns:${ns.namespace}`] = {
        label: ns.namespace,
        icon: "Shapes",
        visible: ns.settings.visible,
        defaultExpansionState: namespaces.length > 1 ? "collapsed" : "expanded",
      };
    }
  }

  return node;
}
