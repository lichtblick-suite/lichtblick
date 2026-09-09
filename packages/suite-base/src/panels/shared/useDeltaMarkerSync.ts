// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect } from "react";

import {
  SyncedDeltaMarkers,
  TimelineInteractionStateStore,
  useTimelineInteractionState,
} from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import { DeltaMarker } from "@lichtblick/suite-base/panels/shared/deltaMarkers";

const selectGlobalDeltaMarkers = (store: TimelineInteractionStateStore) =>
  store.globalDeltaMarkers;
const selectSetGlobalDeltaMarkers = (store: TimelineInteractionStateStore) =>
  store.setGlobalDeltaMarkers;

export type UseDeltaMarkerSyncProps = {
  subscriberId: string;
  /** Gate covering both the panel's own sync setting and any axis-compatibility rule (e.g. Plot's xAxisVal). */
  enabled: boolean;
  markerA: DeltaMarker | undefined;
  markerB: DeltaMarker | undefined;
  /**
   * Called when a synced panel placed/moved/removed marker A and/or marker B (undefined = removed).
   * Both values are always passed together and must be applied in a single atomic update - resolving
   * and committing them separately can leak a stale intermediate state back through the broadcast
   * (e.g. one slot resolves asynchronously while the other is cleared synchronously).
   */
  onRemoteMarkers: (markerAXValue: number | undefined, markerBXValue: number | undefined) => void;
};

/**
 * Broadcasts this panel's delta measure-mode marker x values (in playback seconds) to other
 * synced panels, and applies marker x values broadcast by other synced panels locally.
 *
 * Only x values are shared - each panel resolves its own series values at that x independently,
 * since marker series are specific to each panel's own configured paths.
 */
function useDeltaMarkerSync({
  subscriberId,
  enabled,
  markerA,
  markerB,
  onRemoteMarkers,
}: UseDeltaMarkerSyncProps): void {
  const globalDeltaMarkers = useTimelineInteractionState(selectGlobalDeltaMarkers);
  const setGlobalDeltaMarkers = useTimelineInteractionState(selectSetGlobalDeltaMarkers);

  const markerAXValue = markerA?.xValue;
  const markerBXValue = markerB?.xValue;

  // Broadcast local marker changes to other synced panels. Skips the write entirely when the
  // store already holds these exact values (e.g. right after adopting a remote update) - without
  // this, every panel re-echoes whatever it just received tagged with its own sourceId, and since
  // the write always creates a new object, that echo alone re-notifies every subscriber and can
  // keep the store bouncing between "owners" indefinitely instead of settling once values match.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    setGlobalDeltaMarkers((old) => {
      if (old?.markerAXValue === markerAXValue && old?.markerBXValue === markerBXValue) {
        return old;
      }
      return { sourceId: subscriberId, markerAXValue, markerBXValue };
    });
  }, [enabled, markerAXValue, markerBXValue, subscriberId, setGlobalDeltaMarkers]);

  // Apply marker changes broadcast by another synced panel.
  useEffect(() => {
    if (
      !enabled ||
      !globalDeltaMarkers ||
      globalDeltaMarkers.sourceId === subscriberId
    ) {
      return;
    }
    if (
      globalDeltaMarkers.markerAXValue !== markerAXValue ||
      globalDeltaMarkers.markerBXValue !== markerBXValue
    ) {
      onRemoteMarkers(globalDeltaMarkers.markerAXValue, globalDeltaMarkers.markerBXValue);
    }
  }, [enabled, globalDeltaMarkers, subscriberId, markerAXValue, markerBXValue, onRemoteMarkers]);

  // Stop claiming the shared slot once sync is disabled locally (mode toggled off, panel
  // reconfigured out of a compatible axis, etc.) so stale markers don't linger for other panels.
  useEffect(() => {
    if (enabled) {
      return;
    }
    setGlobalDeltaMarkers((old: undefined | SyncedDeltaMarkers) =>
      old?.sourceId === subscriberId ? undefined : old,
    );
  }, [enabled, subscriberId, setGlobalDeltaMarkers]);

  // Same cleanup on unmount.
  useEffect(() => {
    return () => {
      setGlobalDeltaMarkers((old: undefined | SyncedDeltaMarkers) =>
        old?.sourceId === subscriberId ? undefined : old,
      );
    };
  }, [subscriberId, setGlobalDeltaMarkers]);
}

export default useDeltaMarkerSync;
