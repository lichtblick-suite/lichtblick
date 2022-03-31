// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";

/**
 * This is loaded when the user has no layout selected on application launch
 * to avoid presenting the user with a blank layout.
 */
export const defaultLayout: PanelsState = {
  configById: {
    "3D Panel!18i6zy7": {
      pinTopics: true,
    },
    "RawMessages!os6rgs": {},
    "ImageViewPanel!3mnp456": {},
  },
  globalVariables: {},
  userNodes: {},
  linkedGlobalVariables: [],
  playbackConfig: { ...defaultPlaybackConfig },
  layout: {
    first: "3D Panel!18i6zy7",
    second: {
      first: "ImageViewPanel!3mnp456",
      second: "RawMessages!os6rgs",
      direction: "column",
      splitPercentage: 30,
    },
    direction: "row",
    splitPercentage: 70,
  },
} as const;
