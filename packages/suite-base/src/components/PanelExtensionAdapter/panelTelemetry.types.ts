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
