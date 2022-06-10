// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";

import type { Renderer } from "../../Renderer";
import { Marker, Pose } from "../../ros";
import { getMarkerId } from "./markerId";

const tempColor = new THREE.Color();
const tempColor2 = new THREE.Color();
const tempTuple4: THREE.Vector4Tuple = [0, 0, 0, 0];

type MarkerUserData = {
  topic: string;
  marker: Marker;
  pose: Pose;
  srcTime: bigint;
  receiveTime: bigint | undefined;
  expiresIn: bigint | undefined;
};

export class RenderableMarker extends THREE.Object3D {
  override userData: MarkerUserData;

  protected _renderer: Renderer;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super();

    this._renderer = renderer;

    const hasLifetime = marker.lifetime.sec !== 0 || marker.lifetime.nsec !== 0;

    this.name = getMarkerId(topic, marker.ns, marker.id);
    this.userData = {
      topic,
      marker,
      pose: marker.pose,
      srcTime: toNanoSec(marker.header.stamp),
      receiveTime,
      expiresIn: hasLifetime ? toNanoSec(marker.lifetime) : undefined,
    };
  }

  dispose(): void {
    //
  }

  update(marker: Marker, receiveTime: bigint | undefined): void {
    const hasLifetime = marker.lifetime.sec !== 0 || marker.lifetime.nsec !== 0;

    this.userData.marker = marker;
    this.userData.srcTime = toNanoSec(marker.header.stamp);
    this.userData.pose = marker.pose;
    this.userData.receiveTime = receiveTime;
    this.userData.expiresIn = hasLifetime ? toNanoSec(marker.lifetime) : undefined;
  }

  // Convert sRGB values to linear
  protected _markerColorsToLinear(
    marker: Marker,
    callback: (color: THREE.Vector4Tuple, i: number) => void,
  ): void {
    tempColor.setRGB(marker.color.r, marker.color.g, marker.color.b).convertSRGBToLinear();

    const length = marker.points.length;
    for (let i = 0; i < length; i++) {
      const srgb = marker.colors[i];
      if (srgb) {
        // Per-point color
        tempColor2.setRGB(srgb.r, srgb.g, srgb.b).convertSRGBToLinear();
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
}
