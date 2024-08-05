// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Label } from "@foxglove/three-text";

import { RenderableMarker } from "./RenderableMarker";
import type { Renderer } from "../../Renderer";
import { getLuminance, SRGBToLinear } from "../../color";
import { Marker } from "../../ros";

export class RenderableTextViewFacing extends RenderableMarker {
  #label: Label;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    this.#label = renderer.labelPool.acquire();
    this.#label.setBillboard(true);

    this.add(this.#label);
    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.renderer.labelPool.release(this.#label);
  }

  public override update(newMarker: Marker, receiveTime: bigint | undefined): void {
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

    this.#label.setText(marker.text);
    const alpha = marker.color.a;
    this.#label.setColor(
      SRGBToLinear(marker.color.r),
      SRGBToLinear(marker.color.g),
      SRGBToLinear(marker.color.b),
      alpha,
    );

    const foregroundIsDark = getLuminance(marker.color.r, marker.color.g, marker.color.b) < 0.5;
    if (foregroundIsDark) {
      this.#label.setBackgroundColor(1, 1, 1, alpha);
    } else {
      this.#label.setBackgroundColor(0, 0, 0, alpha);
    }
    this.#label.setLineHeight(marker.scale.z);
    this.#label.userData.pose = marker.pose;
  }
}
