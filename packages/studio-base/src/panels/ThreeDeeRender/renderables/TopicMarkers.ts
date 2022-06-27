// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { Marker, MarkerAction, MarkerType } from "../ros";
import { BaseSettings } from "../settings";
import { updatePose } from "../updatePose";
import type { LayerSettingsMarker } from "./Markers";
import { RenderableArrow } from "./markers/RenderableArrow";
import { RenderableCube } from "./markers/RenderableCube";
import { RenderableCubeList } from "./markers/RenderableCubeList";
import { RenderableCylinder } from "./markers/RenderableCylinder";
import { RenderableLineList } from "./markers/RenderableLineList";
import { RenderableLineStrip } from "./markers/RenderableLineStrip";
import { RenderableMarker, getMarkerId } from "./markers/RenderableMarker";
import { RenderableMeshResource } from "./markers/RenderableMeshResource";
import { RenderablePoints } from "./markers/RenderablePoints";
import { RenderableSphere } from "./markers/RenderableSphere";
import { RenderableSphereList } from "./markers/RenderableSphereList";
import { RenderableTextViewFacing } from "./markers/RenderableTextViewFacing";
import { RenderableTriangleList } from "./markers/RenderableTriangleList";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

export type LayerSettingsMarkerNamespace = BaseSettings;

const INVALID_CUBE_LIST = "INVALID_CUBE_LIST";
const INVALID_LINE_LIST = "INVALID_LINE_LIST";
const INVALID_LINE_STRIP = "INVALID_LINE_STRIP";
const INVALID_MARKER_ACTION = "INVALID_MARKER_ACTION";
const INVALID_MARKER_TYPE = "INVALID_MARKER_TYPE";
const INVALID_POINTS_LIST = "INVALID_POINTS_LIST";
const INVALID_SPHERE_LIST = "INVALID_SPHERE_LIST";

const DEFAULT_NAMESPACE_SETTINGS: LayerSettingsMarkerNamespace = {
  visible: true,
};

export type MarkerTopicUserData = BaseUserData & {
  topic: string;
  settings: LayerSettingsMarker;
};

type PartialMarkerSettings = Partial<LayerSettingsMarker> | undefined;

export class MarkersNamespace {
  namespace: string;
  markersById = new Map<number, RenderableMarker>();
  settings: LayerSettingsMarkerNamespace;

  constructor(topic: string, namespace: string, renderer: Renderer) {
    this.namespace = namespace;

    // Set the initial settings from default values merged with any user settings
    const topicSettings = renderer.config.topics[topic] as PartialMarkerSettings;
    const userSettings = topicSettings?.namespaces?.[namespace];
    this.settings = { ...DEFAULT_NAMESPACE_SETTINGS, ...userSettings };
  }
}

export class TopicMarkers extends Renderable<MarkerTopicUserData> {
  namespaces = new Map<string, MarkersNamespace>();

  // eslint-disable-next-line no-restricted-syntax
  get topic(): string {
    return this.userData.topic;
  }

  override dispose(): void {
    for (const ns of this.namespaces.values()) {
      for (const marker of ns.markersById.values()) {
        marker.dispose();
      }
    }
    this.children.length = 0;
    this.namespaces.clear();
  }

  addMarkerMessage(marker: Marker, receiveTime: bigint): void {
    switch (marker.action) {
      case MarkerAction.ADD:
      case MarkerAction.MODIFY:
        this._addOrUpdateMarker(marker, receiveTime);
        break;
      case MarkerAction.DELETE:
        this._deleteMarker(marker.ns, marker.id);
        break;
      case MarkerAction.DELETEALL: {
        // Delete all markers on this topic
        for (const ns of this.namespaces.values()) {
          for (const renderable of ns.markersById.values()) {
            this.remove(renderable);
            renderable.dispose();
          }
        }
        this.namespaces.clear();
        break;
      }
      default:
        // Unknown action
        this.renderer.settings.errors.addToTopic(
          this.topic,
          INVALID_MARKER_ACTION,
          `Invalid marker action ${marker.action}`,
        );
    }
  }

  startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    this.visible = this.userData.settings.visible;
    if (!this.visible) {
      this.renderer.settings.errors.clearTopic(this.topic);
      return;
    }

    for (const ns of this.namespaces.values()) {
      for (const renderable of ns.markersById.values()) {
        renderable.visible = ns.settings.visible;
        if (!renderable.visible) {
          continue;
        }

        const marker = renderable.userData.marker;
        const receiveTime = renderable.userData.receiveTime;
        const expiresIn = renderable.userData.expiresIn;

        // Check if this marker has expired
        if (expiresIn != undefined) {
          if (currentTime > receiveTime + expiresIn) {
            this._deleteMarker(ns.namespace, marker.id);
            continue;
          }
        }

        const frameId = this.renderer.normalizeFrameId(marker.header.frame_id);
        const srcTime = marker.frame_locked ? currentTime : renderable.userData.messageTime;
        const updated = updatePose(
          renderable,
          this.renderer.transformTree,
          renderFrameId,
          fixedFrameId,
          frameId,
          currentTime,
          srcTime,
        );
        renderable.visible = updated;
        const topic = renderable.userData.topic;
        if (!updated) {
          const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
          this.renderer.settings.errors.addToTopic(topic, MISSING_TRANSFORM, message);
        } else {
          this.renderer.settings.errors.removeFromTopic(topic, MISSING_TRANSFORM);
        }
      }
    }
  }

  private _addOrUpdateMarker(marker: Marker, receiveTime: bigint): void {
    let ns = this.namespaces.get(marker.ns);
    if (!ns) {
      ns = new MarkersNamespace(this.topic, marker.ns, this.renderer);
      this.namespaces.set(marker.ns, ns);
    }

    let renderable = ns.markersById.get(marker.id);
    if (!renderable) {
      renderable = this._createMarkerRenderable(marker, receiveTime);
      if (!renderable) {
        return;
      }
      this.add(renderable);
      ns.markersById.set(marker.id, renderable);
    } else {
      renderable.update(marker, receiveTime);
    }
  }

  private _deleteMarker(ns: string, id: number): boolean {
    const namespace = this.namespaces.get(ns);
    if (namespace) {
      const renderable = namespace.markersById.get(id);
      if (renderable) {
        this.remove(renderable);
        renderable.dispose();
        namespace.markersById.delete(id);
        return true;
      }
    }
    return false;
  }

  private _createMarkerRenderable(
    marker: Marker,
    receiveTime: bigint,
  ): RenderableMarker | undefined {
    switch (marker.type) {
      case MarkerType.ARROW:
        return new RenderableArrow(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.CUBE:
        return new RenderableCube(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.SPHERE:
        return new RenderableSphere(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.CYLINDER:
        return new RenderableCylinder(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.LINE_STRIP:
        if (marker.points.length === 0) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_LINE_STRIP,
            `LINE_STRIP marker ${markerId} has no points`,
          );
          return;
        } else if (marker.points.length === 1) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_LINE_STRIP,
            `LINE_STRIP marker ${markerId} only has one point`,
          );
          return;
        }
        return new RenderableLineStrip(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.LINE_LIST:
        if (marker.points.length === 0) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_LINE_LIST,
            `LINE_LIST marker ${markerId} has no points`,
          );
        } else if (marker.points.length === 1) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_LINE_LIST,
            `LINE_LIST marker ${markerId} only has one point`,
          );
          return;
        } else if (marker.points.length % 2 !== 0) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_LINE_LIST,
            `LINE_LIST marker ${markerId} has an odd number of points (${marker.points.length})`,
          );
          return;
        }
        return new RenderableLineList(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.CUBE_LIST:
        if (marker.points.length === 0) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_CUBE_LIST,
            `CUBE_LIST marker ${markerId} has no points`,
          );
          return;
        }
        return new RenderableCubeList(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.SPHERE_LIST:
        if (marker.points.length === 0) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_SPHERE_LIST,
            `SPHERE_LIST marker ${markerId} has no points`,
          );
          return;
        }
        return new RenderableSphereList(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.POINTS:
        if (marker.points.length === 0) {
          const markerId = getMarkerId(this.topic, marker.ns, marker.id);
          this.renderer.settings.errors.addToTopic(
            this.topic,
            INVALID_POINTS_LIST,
            `POINTS marker ${markerId} has no points`,
          );
          return;
        }
        return new RenderablePoints(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.TEXT_VIEW_FACING:
        return new RenderableTextViewFacing(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.MESH_RESOURCE:
        return new RenderableMeshResource(this.topic, marker, receiveTime, this.renderer);
      case MarkerType.TRIANGLE_LIST:
        return new RenderableTriangleList(this.topic, marker, receiveTime, this.renderer);
      default: {
        const markerId = getMarkerId(this.topic, marker.ns, marker.id);
        this.renderer.settings.errors.addToTopic(
          this.topic,
          INVALID_MARKER_TYPE,
          `Marker ${markerId} has invalid type ${marker.type}`,
        );
        return undefined;
      }
    }
  }
}
