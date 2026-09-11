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
   * should call this synchronously on click, then pass the returned reservation to `setMarker` once
   * the value is ready.
   */
  nextMarkerSlot: () => DeltaMarkerSlotReservation;
  setMarker: (reservation: DeltaMarkerSlotReservation, marker: DeltaMarker) => void;
};

export type DeltaMarkerSlotReservation = {
  slot: "a" | "b";
  generation: number;
  token: number;
};

/** Shared A/B marker state machine used by both the Plot and StateTransitions measure modes. */
function useDeltaMarkerState({ resetKey }: UseDeltaMarkerStateProps): UseDeltaMarkerStateResult {
  const [active, setActive] = useState(false);
  const [markerA, setMarkerA] = useState<DeltaMarker | undefined>(undefined);
  const [markerB, setMarkerB] = useState<DeltaMarker | undefined>(undefined);
  const generationRef = useRef(0);
  const nextReservationTokenRef = useRef(0);
  const pendingReservationsRef = useRef(
    new Map<DeltaMarkerSlotReservation["slot"], DeltaMarkerSlotReservation>(),
  );

  const previousResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (previousResetKeyRef.current !== resetKey) {
      previousResetKeyRef.current = resetKey;
      generationRef.current += 1;
      pendingReservationsRef.current.clear();
      setMarkerA(undefined);
      setMarkerB(undefined);
    }
  }, [resetKey]);

  const toggleActive = useCallback(() => {
    generationRef.current += 1;
    pendingReservationsRef.current.clear();
    setActive((prevActive) => !prevActive);
    setMarkerA(undefined);
    setMarkerB(undefined);
  }, []);

  const removeMarkerA = useCallback(() => {
    pendingReservationsRef.current.delete("a");
    setMarkerA(undefined);
  }, []);

  const removeMarkerB = useCallback(() => {
    pendingReservationsRef.current.delete("b");
    setMarkerB(undefined);
  }, []);

  const nextMarkerSlot = useCallback((): DeltaMarkerSlotReservation => {
    const pendingReservations = pendingReservationsRef.current;
    const aReserved = markerA != undefined || pendingReservations.has("a");
    const bReserved = markerB != undefined || pendingReservations.has("b");
    const slot: "a" | "b" = !aReserved || bReserved ? "a" : "b";
    if (slot === "a") {
      pendingReservations.delete("b");
      setMarkerB(undefined);
    }
    const reservation = {
      slot,
      generation: generationRef.current,
      token: nextReservationTokenRef.current++,
    };
    pendingReservations.set(slot, reservation);
    return reservation;
  }, [markerA, markerB]);

  const setMarker = useCallback((reservation: DeltaMarkerSlotReservation, marker: DeltaMarker) => {
    const currentReservation = pendingReservationsRef.current.get(reservation.slot);
    if (
      reservation.generation !== generationRef.current ||
      currentReservation?.token !== reservation.token
    ) {
      return;
    }

    pendingReservationsRef.current.delete(reservation.slot);
    if (reservation.slot === "a") {
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
