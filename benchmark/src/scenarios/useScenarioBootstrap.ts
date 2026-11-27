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
import { LichtblickScenarioControlApi, LichtblickScenarioControlWindow } from "./scenarioControl";
import { buildScenarioDescriptor } from "./scenarioDescriptor";
import { resolveScenarioDataSourceParams, resolveScenarioDurationMs } from "./scenarioParams";
import { CLOSE_DATA_SOURCE_FACTORY_ID } from "../dataSources/constants";
import { LAYOUTS } from "../layouts";

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
 *
 * The scenario's data source params can be overridden from the page URL with
 * `?ds.<param>=<value>` (see `resolveScenarioDataSourceParams`), e.g. to pass fixture URLs served on
 * a dynamic port. If a required param is still missing, the source is not selected and a clear
 * error is logged instead. `?scenario.durationMs=<ms>` overrides the auto-pause duration (see
 * `resolveScenarioDurationMs`).
 *
 * While a scenario is active, `window.lichtblickScenario` (see `scenarioControl.ts`) lets the
 * benchmark runner close the data source in-page to capture its close/cleanup telemetry, and
 * describe the scenario (registry metadata, effective redacted params, layout panels) for the
 * result's `run.scenario`.
 */
export function useScenarioBootstrap(): void {
  const { scenario, params, missingParams, durationMs } = useMemo(() => {
    const url = new URL(window.location.href);
    const found = getScenarioFromUrl(url);
    return found
      ? {
          scenario: found,
          ...resolveScenarioDataSourceParams(found, url),
          durationMs: resolveScenarioDurationMs(found, url),
        }
      : { scenario: undefined, params: undefined, missingParams: [], durationMs: undefined };
  }, []);

  const { selectSource } = usePlayerSelection();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const startPlayback = useMessagePipeline(selectStartPlayback);
  const pausePlayback = useMessagePipeline(selectPausePlayback);

  const didSelectSourceRef = useRef(false);
  const didAutoStartRef = useRef(false);
  const pauseTimeoutIdRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!scenario || didSelectSourceRef.current) {
      return;
    }
    didSelectSourceRef.current = true;

    if (missingParams.length > 0) {
      console.error(
        `Benchmark scenario "${scenario.id}" requires data source param(s) ${missingParams
          .map((name) => `"${name}"`)
          .join(", ")}; pass them as ?ds.<param>=<value> (e.g. ?scenario=${scenario.id}&ds.${
          missingParams[0]
        }=...). Data source not selected.`,
      );
      return;
    }

    selectSource(scenario.dataSource.factoryId, {
      type: "connection",
      params,
    });
  }, [scenario, params, missingParams, selectSource]);

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

    if (durationMs == undefined) {
      return undefined;
    }

    // Owned by `didAutoStartRef`, not this effect's cleanup, so later re-runs triggered by
    // `playerPresence`/`startPlayback`/`pausePlayback` changes (which now no-op via the guard
    // above) can't cancel or lose this deadline.
    pauseTimeoutIdRef.current = setTimeout(() => {
      pausePlayback?.();
    }, durationMs);

    return undefined;
  }, [scenario, durationMs, playerPresence, startPlayback, pausePlayback]);

  const descriptor = useMemo(
    () =>
      scenario
        ? buildScenarioDescriptor({
            scenario,
            params,
            layout: LAYOUTS[scenario.layout],
            durationMs,
          })
        : undefined,
    [scenario, params, durationMs],
  );

  useEffect(() => {
    if (!descriptor) {
      return undefined;
    }
    const target = window as LichtblickScenarioControlWindow;
    const api: LichtblickScenarioControlApi = {
      closeDataSource: () => {
        selectSource(CLOSE_DATA_SOURCE_FACTORY_ID, { type: "connection", params: {} });
      },
      describe: () => descriptor,
    };
    target.lichtblickScenario = api;
    return () => {
      if (target.lichtblickScenario === api) {
        delete target.lichtblickScenario;
      }
    };
  }, [descriptor, selectSource]);

  useEffect(() => {
    return () => {
      clearTimeout(pauseTimeoutIdRef.current);
    };
  }, []);
}
