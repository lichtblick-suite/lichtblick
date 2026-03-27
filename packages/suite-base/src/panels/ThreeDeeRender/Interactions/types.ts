// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { RosObject } from "@lichtblick/suite-base/players/types";
import { Marker } from "@lichtblick/suite-base/types/Messages";

export type InteractionData = {
  readonly topic: string | undefined;
  readonly highlighted?: boolean;
  readonly originalMessage: RosObject;
  readonly instanceDetails: RosObject | undefined;
};
export type Interactive<T> = T & { interactionData: InteractionData };
export type SelectedObject = { object: Marker; instanceIndex?: number };

export type HoverEntityInfo = {
  topic?: string;
  entityId: string;
  metadata: { key: string; value: string }[];
};

/**
 * Tooltip display modes:
 * - `following`  – tooltip follows cursor and updates immediately (fast browsing).
 * - `settled`    – user dwelled 700 ms on one object; tooltip still follows cursor
 *                  but any change to hovered objects triggers a grace delay.
 * - `grace`      – position frozen; waiting for the user to reach the tooltip or
 *                  for the grace timer to expire and apply the pending update.
 * - `hover-pinned` – mouse is on the tooltip; content is frozen.
 * - `click-pinned` – user clicked to pin; fully static until explicit dismiss.
 */
export type TooltipMode =
  | "hidden"
  | "following"
  | "settled"
  | "grace"
  | "hover-pinned"
  | "click-pinned";

export type HoverTooltipProperties = {
  entities: HoverEntityInfo[];
  position: { clientX: number; clientY: number };
  /** Canvas element used to constrain tooltip within the 3D panel bounds. */
  canvas: HTMLCanvasElement | ReactNull;
};
