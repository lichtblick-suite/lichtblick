// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo, useRef } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import { getScenarioFromUrl } from "./registry";

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;
const selectStartPlayback = (ctx: MessagePipelineContext) => ctx.startPlayback;
const selectPausePlayback = (ctx: MessagePipelineContext) => ctx.pausePlayback;

/**
 * When the app URL has a `?scenario=<id>` query param, looks up the scenario and drives the app
 * into that state automatically: selects the scenario's data source via `PlayerSelectionContext`
 * and (if `autoStart` is set) starts playback once the data source is present. The scenario's
 * layout is installed and selected before mount (see `index.tsx` and `Root.tsx`), so this hook
 * doesn't need to handle that. Does nothing when `?scenario=` is absent, so existing `?ds=`-driven
 * benchmarks are unaffected.
 */
export function useScenarioBootstrap(): void {
  const scenario = useMemo(() => getScenarioFromUrl(new URL(window.location.href)), []);

  const { selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const startPlayback = useMessagePipeline(selectStartPlayback);
  const pausePlayback = useMessagePipeline(selectPausePlayback);

  const didSelectSourceRef = useRef(false);
  const didAutoStartRef = useRef(false);

  useEffect(() => {
    if (!scenario || didSelectSourceRef.current) {
      return;
    }
    didSelectSourceRef.current = true;

    selectSource(scenario.dataSource.factoryId, {
      type: "connection",
      params: scenario.dataSource.params,
    });
  }, [scenario, selectSource]);

  useEffect(() => {
    // `startPlayback` only becomes a bound function once the pipeline recomputes it for the
    // current player's capabilities (see MessagePipeline `store.ts`'s `lastCapabilities` diffing),
    // which is not guaranteed to happen in the same render as `playerPresence` turning `PRESENT`.
    // Guarding on `typeof startPlayback === "function"` (rather than presence alone) before
    // latching `didAutoStartRef` ensures this effect retries on a later render instead of
    // permanently no-op'ing if it fires while `startPlayback` isn't ready yet.
    if (
      scenario?.autoStart !== true ||
      didAutoStartRef.current ||
      playerPresence !== PlayerPresence.PRESENT ||
      typeof startPlayback !== "function"
    ) {
      return undefined;
    }
    didAutoStartRef.current = true;

    startPlayback();

    if (scenario.durationMs == undefined) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      pausePlayback?.();
    }, scenario.durationMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [scenario, playerPresence, startPlayback, pausePlayback]);
}
