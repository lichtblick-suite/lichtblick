// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { rgb2hsv, hsv2rgb } from "@fluentui/react";
import { app, nativeImage } from "electron";

const ROTATION_DEGREES = 270;

/** Set an icon with a hue shift for development mode. */
export default function setDevModeDockIcon(): void {
  if (app.dock == undefined) {
    return;
  }
  try {
    // This can fail when opening the app from a packaged DMG.
    const originalIcon = nativeImage.createFromPath("resources/icon/icon.png");

    const buffer = originalIcon.toBitmap();
    for (let i = 0; i + 3 < buffer.length; i += 4) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const hsv = rgb2hsv(buffer[i]!, buffer[i + 1]!, buffer[i + 2]!);
      hsv.h = (hsv.h + ROTATION_DEGREES) % 360;
      ({ r: buffer[i], g: buffer[i + 1], b: buffer[i + 2] } = hsv2rgb(hsv.h, hsv.s, hsv.v));
    }

    const devIcon = nativeImage.createFromBuffer(buffer, originalIcon.getSize());
    app.dock.setIcon(devIcon);
  } catch (error) {
    console.error("Unable to set icon", error);
  }
}
