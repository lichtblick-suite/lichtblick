// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { areEqual } from "@foxglove/rostime";

import { LabelRenderable } from "../../Labels";
import type { Renderer } from "../../Renderer";
import { rgbaEqual } from "../../color";
import { Marker } from "../../ros";
import { poseApproxEq } from "../../transforms";
import { RenderableMarker } from "./RenderableMarker";

const QUAT_IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

export class RenderableTextViewFacing extends RenderableMarker {
  label: LabelRenderable | undefined;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    this.renderer.labels.removeById(this.name);
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    // Check if any relevant fields have changed
    if (
      this.label == undefined ||
      marker.text !== prevMarker.text ||
      marker.header.frame_id !== prevMarker.header.frame_id ||
      marker.frame_locked !== prevMarker.frame_locked ||
      (!marker.frame_locked && !areEqual(marker.header.stamp, prevMarker.header.stamp)) ||
      !rgbaEqual(marker.color, prevMarker.color)
    ) {
      if (this.label) {
        this.remove(this.label);
      }

      // A field that affects the label appearance has changed, rebuild the label
      this.label = this.renderer.labels.setLabel(this.name, {
        text: marker.text,
        color: marker.color,
      });
      this.add(this.label);
    } else if (!poseApproxEq(marker.pose, prevMarker.pose)) {
      // Just update the label pose
      this.label.userData.pose = { position: marker.pose.position, orientation: QUAT_IDENTITY };
    } else {
      // No change
    }
  }
}
