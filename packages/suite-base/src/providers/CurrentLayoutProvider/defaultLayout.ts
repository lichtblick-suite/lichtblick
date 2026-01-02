// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";

/**
 * Overridden default layout that may have been provided when self-hosting via Docker
 * */
const staticDefaultLayout = (globalThis as { LICHTBLICK_SUITE_DEFAULT_LAYOUT?: LayoutData })
  .LICHTBLICK_SUITE_DEFAULT_LAYOUT;

/**
 * This is loaded when the user has no layout selected on application launch
 * to avoid presenting the user with a blank layout.
 */
export const defaultLayout: LayoutData =
  staticDefaultLayout ??
  ({
    configById: {
      "3D!18i6zy7": {
        layers: {
          "845139cb-26bc-40b3-8161-8ab60af4baf5": {
            visible: true,
            frameLocked: true,
            label: "Grid",
            instanceId: "845139cb-26bc-40b3-8161-8ab60af4baf5",
            layerId: "foxglove.Grid",
            size: 10,
            divisions: 10,
            lineWidth: 1,
            color: "#248eff",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            order: 1,
          },
        },
      },
      "RawMessages!os6rgs": {},
      "Image!3mnp456": {},
    },
    globalVariables: {},
    userNodes: {},
    playbackConfig: { ...defaultPlaybackConfig },
    layout: {
      first: "3D!18i6zy7",
      second: {
        first: "Image!3mnp456",
        second: "RawMessages!os6rgs",
        direction: "column",
        splitPercentage: 30,
      },
      direction: "row",
      splitPercentage: 70,
    },
  } as const);
