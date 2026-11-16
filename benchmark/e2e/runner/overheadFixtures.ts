// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// MCAP fixtures of the overhead A/B: the scenario fixtures (10 s) end before the steady window
// (or the toggle blocks) does, so the late polls would measure an idle player. The overhead spec
// gets its own, longer sets (one for the relaunch runs, one for the toggle run).

import path from "node:path";

import {
  OVERHEAD_DURATION_MARGIN_MS,
  OVERHEAD_FIXTURE_DATA_MARGIN_MS,
  OVERHEAD_FIXTURES_DIR,
  OVERHEAD_FIXTURES_SUBDIR,
  OVERHEAD_TOGGLE_WARMUP_MS,
  OVERHEAD_WARMUP_MS,
  SAMPLE_INTERVAL_MS,
} from "./constants";
import type { OverheadFixtureSet } from "./overheadFixtures.types";
import { steadyScenarioDurationMs } from "./steadyWindow";
import { BLOCKS_PER_QUARTET, toggleScenarioDurationMs } from "./toggleBlocks";
import type { McapFixtureOptions } from "../fixtures/types";
import { MS_PER_SECOND } from "../result/constants";

/** Page auto-pause of an overhead run of `polls` steady polls (warm-up + polls + margin). */
export function overheadAutoPauseMs(polls: number): number {
  return steadyScenarioDurationMs({
    warmupMs: OVERHEAD_WARMUP_MS,
    polls,
    intervalMs: SAMPLE_INTERVAL_MS,
    marginMs: OVERHEAD_DURATION_MARGIN_MS,
  });
}

/**
 * Page auto-pause of a toggle A/B run of `quartets` ABBA quartets (4 blocks each) of `blockMs`
 * blocks and a profiled period of `profileMs` (warm-up + every block + profile + margin).
 */
export function overheadToggleAutoPauseMs(
  quartets: number,
  blockMs: number,
  profileMs: number = 0,
): number {
  return toggleScenarioDurationMs({
    warmupMs: OVERHEAD_TOGGLE_WARMUP_MS,
    blocks: quartets * BLOCKS_PER_QUARTET,
    blockMs,
    profileMs,
    marginMs: OVERHEAD_DURATION_MARGIN_MS,
  });
}

/**
 * Options of overhead MCAP fixtures for a page auto-pause of `autoPauseMs`: the scenario defaults,
 * but spanning the auto-pause plus `OVERHEAD_FIXTURE_DATA_MARGIN_MS` (whole seconds), so playback
 * at 1× still streams data at the end of the measurement even when loading delays the playback
 * start.
 */
export function overheadFixtureOptionsForAutoPause(autoPauseMs: number): McapFixtureOptions {
  return {
    durationSec: Math.ceil((autoPauseMs + OVERHEAD_FIXTURE_DATA_MARGIN_MS) / MS_PER_SECOND),
  };
}

/**
 * The overhead fixture set for a page auto-pause of `autoPauseMs`: its options and its own cache
 * directory per duration (`overhead/<seconds>s/`), so a different length never reuses (or
 * overwrites) the files of another duration.
 */
export function overheadFixtureSetForAutoPause(autoPauseMs: number): OverheadFixtureSet {
  const options = overheadFixtureOptionsForAutoPause(autoPauseMs);
  const durationDir = `${options.durationSec}s`;
  return {
    options,
    dir: path.join(OVERHEAD_FIXTURES_DIR, durationDir),
    urlPath: `/fixtures/${OVERHEAD_FIXTURES_SUBDIR}/${durationDir}`,
  };
}

/** The overhead fixture set of relaunch runs of `polls` steady polls. */
export function overheadFixtureSet(polls: number): OverheadFixtureSet {
  return overheadFixtureSetForAutoPause(overheadAutoPauseMs(polls));
}

/** The overhead fixture set of a toggle A/B run (`overheadToggleAutoPauseMs`). */
export function overheadToggleFixtureSet(
  quartets: number,
  blockMs: number,
  profileMs: number = 0,
): OverheadFixtureSet {
  return overheadFixtureSetForAutoPause(overheadToggleAutoPauseMs(quartets, blockMs, profileMs));
}
