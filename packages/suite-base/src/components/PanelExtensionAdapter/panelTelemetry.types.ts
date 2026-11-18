// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable, MessageEvent } from "@lichtblick/suite";

/**
 * Mutable per-adapter state used to count `allFrames` deliveries. Kept in a ref and mutated in
 * place, so no allocation happens per frame.
 */
export type AllFramesDeliveryTracker = {
  /** `allFrames` array last seen (reference identity) */
  lastAllFrames: Immutable<readonly MessageEvent[]> | undefined;
  /** length of `lastAllFrames`, i.e. how many entries have already been counted */
  countedLength: number;
};

/**
 * Mutable per-adapter state used to account the frames handed to the panel. Created once per
 * adapter and mutated in place, so no allocation happens per frame.
 */
export type PanelFrameTelemetryState = {
  /**
   * Last `messageEvents` array (frame input) accounted for, either as rendered or as skipped.
   * Effect re-runs triggered by other inputs (hover, variables, theme, ...) keep the same array, so
   * they do not count as a skipped frame.
   */
  lastAccountedFrame: Immutable<readonly MessageEvent[]> | undefined;
  /**
   * Last `messageEvents` array counted as rendered (handed to `onRender` as `currentFrame`), so a
   * re-run with the same frame is not counted twice. A skipped frame that is rendered later is
   * still counted.
   */
  lastRenderedFrame: Immutable<readonly MessageEvent[]> | undefined;
  /** Tracks which `allFrames` entries were already counted as delivered preloaded messages. */
  allFrames: AllFramesDeliveryTracker;
};
