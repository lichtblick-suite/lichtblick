// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

export type InstallingProgress = {
  installed: number;
  total: number;
  inProgress: boolean;
};

export type InstallingExtensionsState = {
  installingProgress: InstallingProgress;
  setInstallingProgress: (progress: (lastState: InstallingProgress) => InstallingProgress) => void;
  startInstallingProgress: (extensionsNumber: number) => void;
  resetInstallingProgress: () => void;
};

export const useInstallingExtensionsStore = create<InstallingExtensionsState>((set) => ({
  installingProgress: { installed: 0, total: 0, inProgress: false },
  setInstallingProgress: (progress) => {
    set((state) => ({
      installingProgress: progress(state.installingProgress),
    }));
  },
  startInstallingProgress: (extensionsToBeInstalled: number) => {
    set((state) => ({
      installingProgress: {
        ...state.installingProgress,
        total: extensionsToBeInstalled,
        installed: 0,
        inProgress: true,
      },
    }));
  },
  resetInstallingProgress: () => {
    set(() => ({
      installingProgress: {
        total: 0,
        installed: 0,
        inProgress: false,
      },
    }));
  },
}));
