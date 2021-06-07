// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { rgb2hsv, hsv2rgb } from "@fluentui/react";
import { NativeImage, nativeImage } from "electron";

const ROTATION_DEGREES = 270;

/** The regular app icon with a hue shift for development mode. */
export default function getDevModeIcon(): NativeImage | undefined {
  try {
    // This can fail when opening the app from a packaged DMG.
    const originalIcon = nativeImage.createFromPath("resources/icon/icon.png");

    const buffer = originalIcon.toBitmap();
    for (let i = 0; i + 3 < buffer.length; i += 4) {
      const hsv = rgb2hsv(buffer[i]!, buffer[i + 1]!, buffer[i + 2]!);
      hsv.h = (hsv.h + ROTATION_DEGREES) % 360;
      ({ r: buffer[i], g: buffer[i + 1], b: buffer[i + 2] } = hsv2rgb(hsv.h, hsv.s, hsv.v));
    }

    return nativeImage.createFromBuffer(buffer, originalIcon.getSize());
  } catch (error) {
    console.error("Unable to create dev mode icon", error);
    return undefined;
  }
}
