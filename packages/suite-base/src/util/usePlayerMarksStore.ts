// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import { Time } from "@lichtblick/rostime";

interface MarkState {
  startMark?: Time;
  endMark?: Time;
  setStartMark: (startMark: Time) => void;
  setEndMark: (endMark: Time) => void;
  marks: Time[];
  saveNewMarks: (mark: Time) => void;
  setMarks: (marks: Time[]) => void;
}

type DerivedMarksState = Pick<MarkState, "marks" | "startMark" | "endMark">;

function compareTimes(a: Time, b: Time): number {
  if (a.sec === b.sec) {
    return a.nsec - b.nsec;
  }
  return a.sec - b.sec;
}

function deriveMarksState(marks: Time[]): DerivedMarksState {
  const sortedMarks = [...marks].sort(compareTimes).slice(0, 2);
  return {
    marks: sortedMarks,
    startMark: sortedMarks[0],
    endMark: sortedMarks.length > 1 ? sortedMarks[1] : undefined,
  };
}

const usePlayerMarksStore = create<MarkState>()((set) => ({
  marks: [],
  saveNewMarks: (mark: Time) => {
    set((state) => deriveMarksState([...state.marks, mark]));
  },
  setMarks: (marks: Time[]) => {
    set(() => deriveMarksState(marks));
  },
  startMark: undefined,
  endMark: undefined,
  setStartMark: (startMark: Time) => {
    set({ startMark });
  },
  setEndMark: (endMark: Time) => {
    set({ endMark });
  },
}));

export { usePlayerMarksStore };
