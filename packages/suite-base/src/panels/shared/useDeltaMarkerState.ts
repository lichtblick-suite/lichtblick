// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useRef, useState } from "react";

import { DeltaMarker } from "@lichtblick/suite-base/panels/shared/deltaMarkers";

export type UseDeltaMarkerStateProps = {
  /** Markers are cleared (but the mode stays active) whenever this value changes. */
  resetKey?: string;
};

export type UseDeltaMarkerStateResult = {
  active: boolean;
  toggleActive: () => void;
  markerA: DeltaMarker | undefined;
  markerB: DeltaMarker | undefined;
  removeMarkerA: () => void;
  removeMarkerB: () => void;
  /**
   * Decides which slot ("a" or "b") the next placed marker should fill: A, then B, then back to
   * a fresh A (clearing B) on a third click. Callers that resolve a marker's value asynchronously
   * should call this synchronously on click, then pass the returned slot to `setMarker` once the
   * value is ready.
   */
  nextMarkerSlot: () => "a" | "b";
  setMarker: (slot: "a" | "b", marker: DeltaMarker) => void;
};

/** Shared A/B marker state machine used by both the Plot and StateTransitions measure modes. */
function useDeltaMarkerState({ resetKey }: UseDeltaMarkerStateProps): UseDeltaMarkerStateResult {
  const [active, setActive] = useState(false);
  const [markerA, setMarkerA] = useState<DeltaMarker | undefined>(undefined);
  const [markerB, setMarkerB] = useState<DeltaMarker | undefined>(undefined);

  const previousResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (previousResetKeyRef.current !== resetKey) {
      previousResetKeyRef.current = resetKey;
      setMarkerA(undefined);
      setMarkerB(undefined);
    }
  }, [resetKey]);

  const toggleActive = useCallback(() => {
    setActive((prevActive) => !prevActive);
    setMarkerA(undefined);
    setMarkerB(undefined);
  }, []);

  const removeMarkerA = useCallback(() => {
    setMarkerA(undefined);
  }, []);

  const removeMarkerB = useCallback(() => {
    setMarkerB(undefined);
  }, []);

  const nextMarkerSlot = useCallback((): "a" | "b" => {
    const slot: "a" | "b" = !markerA ? "a" : !markerB ? "b" : "a";
    if (slot === "a") {
      setMarkerB(undefined);
    }
    return slot;
  }, [markerA, markerB]);

  const setMarker = useCallback((slot: "a" | "b", marker: DeltaMarker) => {
    if (slot === "a") {
      setMarkerA(marker);
    } else {
      setMarkerB(marker);
    }
  }, []);

  return {
    active,
    toggleActive,
    markerA,
    markerB,
    removeMarkerA,
    removeMarkerB,
    nextMarkerSlot,
    setMarker,
  };
}

export default useDeltaMarkerState;
