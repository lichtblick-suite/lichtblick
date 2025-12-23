// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import { Time } from "@lichtblick/rostime";

interface MarkState {
  marks: Time[];
  saveNewMarks: (mark: Time) => void;
  setMarks: (marks: Time[]) => void;
}

const usePlayerMarksStore = create<MarkState>()((set) => ({
  marks: [],
  saveNewMarks: (mark: Time) => {
    set((state) => ({ marks: [...state.marks, mark] }));
  },
  setMarks: (marks: Time[]) => {
    set({ marks });
  },
}));

export { usePlayerMarksStore };
