// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { RosValue } from "@foxglove/studio-base/players/types";

import type { IRenderer } from "../../IRenderer";
import { BaseUserData, Renderable } from "../../Renderable";
import { makeRgba, rgbToThreeColor, stringToRgba } from "../../color";
import { Marker } from "../../ros";
import type { LayerSettingsMarker } from "../TopicMarkers";

const tempColor = new THREE.Color();
const tempColor2 = new THREE.Color();
const tempTuple4: THREE.Vector4Tuple = [0, 0, 0, 0];

export type MarkerUserData = BaseUserData & {
  topic: string;
  marker: Marker; // The marker used for rendering
  originalMarker: Marker; // The original marker received from the topic, used for inspection
  expiresIn: bigint | undefined;
};

export function getMarkerId(topic: string, ns: string, id: number): string {
  return `${topic}:${ns ? ns + ":" : ""}${id}`.replace(/\s/g, "_");
}

export class RenderableMarker extends Renderable<MarkerUserData> {
  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
  ) {
    const name = getMarkerId(topic, marker.ns, marker.id);
    const hasLifetime = marker.lifetime.sec !== 0 || marker.lifetime.nsec !== 0;

    super(name, renderer, {
      receiveTime: receiveTime ?? 0n,
      messageTime: toNanoSec(marker.header.stamp),
      frameId: renderer.normalizeFrameId(marker.header.frame_id),
      pose: marker.pose,
      settingsPath: ["topics", topic],
      settings: { visible: true, frameLocked: marker.frame_locked },
      topic,
      marker,
      originalMarker: marker,
      expiresIn: hasLifetime ? toNanoSec(marker.lifetime) : undefined,
    });
  }

  public override idFromMessage(): number | string | undefined {
    return this.userData.marker.id;
  }

  public override selectedIdVariable(): string | undefined {
    const settings = this.getSettings();
    return settings?.selectedIdVariable;
  }

  public getSettings(): LayerSettingsMarker | undefined {
    return this.renderer.config.topics[this.userData.topic] as LayerSettingsMarker | undefined;
  }

  public override details(): Record<string, RosValue> {
    return this.userData.originalMarker;
  }

  public update(marker: Marker, receiveTime: bigint | undefined): void {
    const hasLifetime = marker.lifetime.sec !== 0 || marker.lifetime.nsec !== 0;

    if (receiveTime != undefined) {
      this.userData.receiveTime = receiveTime;
    }
    this.userData.messageTime = toNanoSec(marker.header.stamp);
    this.userData.frameId = this.renderer.normalizeFrameId(marker.header.frame_id);
    this.userData.pose = marker.pose;
    this.userData.marker = this.#renderMarker(marker);
    this.userData.originalMarker = marker;
    this.userData.expiresIn = hasLifetime ? toNanoSec(marker.lifetime) : undefined;
  }

  // Convert sRGB values to linear
  protected _markerColorsToLinear(
    marker: Marker,
    pointsLength: number,
    callback: (color: THREE.Vector4Tuple, i: number) => void,
  ): void {
    rgbToThreeColor(tempColor, marker.color);

    for (let i = 0; i < pointsLength; i++) {
      const srgb = marker.colors[i];
      if (srgb) {
        // Per-point color
        rgbToThreeColor(tempColor2, srgb);
        tempTuple4[0] = tempColor2.r;
        tempTuple4[1] = tempColor2.g;
        tempTuple4[2] = tempColor2.b;
        tempTuple4[3] = srgb.a;
      } else {
        // Base marker color
        tempTuple4[0] = tempColor.r;
        tempTuple4[1] = tempColor.g;
        tempTuple4[2] = tempColor.b;
        tempTuple4[3] = marker.color.a;
      }

      callback(tempTuple4, i);
    }
  }

  #renderMarker(marker: Marker): Marker {
    const topicName = this.userData.topic;
    const settings = this.renderer.config.topics[topicName] as
      | Partial<LayerSettingsMarker>
      | undefined;
    const colorStr = settings?.color;

    if (colorStr == undefined) {
      return marker;
    }

    // Create a clone of the marker with the color overridden
    const color = stringToRgba(makeRgba(), colorStr);
    const newMarker = { ...marker, color, colors: [] };
    return newMarker;
  }
}
