// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@lichtblick/suite";

export interface FrameCache<T> {
  frames?: readonly MessageEvent[];
  items: T[];
}

/**
 * Incrementally rebuilds a decoded-item cache from `renderState.allFrames` (the full sorted
 * preloaded-block history for `preload: true` subscriptions). `allFrames` gets a new array
 * reference every time more of the file streams in, and re-decoding the whole history from
 * scratch on each of those bumps is what makes TacticalMap/LidarProfile lag heavily while a file
 * is still loading. When the new array is an append-only extension of the previous one --
 * verified by object identity on the last previously-seen event, the same technique these panels
 * already use to skip re-decoding an unchanged point-cloud message, not just assumed -- only the
 * new tail is decoded; otherwise (seek, source change, out-of-order block fill) it safely falls
 * back to a full rebuild.
 */
export function updateFrameCache<T>(
  cache: FrameCache<T>,
  allFrames: readonly MessageEvent[],
  topic: string,
  decode: (event: MessageEvent) => T | readonly T[] | undefined,
): FrameCache<T> {
  const previousFrames = cache.frames;
  const previousLength = previousFrames?.length ?? 0;
  const isAppendOnly =
    previousFrames != undefined &&
    allFrames.length >= previousLength &&
    (previousLength === 0 || allFrames[previousLength - 1] === previousFrames[previousLength - 1]);

  const items = isAppendOnly ? cache.items.slice() : [];
  const startIndex = isAppendOnly ? previousLength : 0;
  for (let i = startIndex; i < allFrames.length; i++) {
    const event = allFrames[i]!;
    if (event.topic !== topic) {
      continue;
    }
    const decoded = decode(event);
    if (decoded == undefined) {
      continue;
    }
    if (Array.isArray(decoded)) {
      items.push(...(decoded as T[]));
    } else {
      items.push(decoded as T);
    }
  }

  return { frames: allFrames, items };
}
