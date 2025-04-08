// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { create } from 'zustand';

type InstallingProgress = {
    installed: number;
    total: number;
    inProgress: boolean;
  };

  type InstallingExtensionsState = {
    installingProgress: InstallingProgress;
    setInstallingProgress: (
      progress: InstallingProgress | ((lastState: InstallingProgress) => InstallingProgress)
    ) => void;
  };

  export const useInstallingExtensionsStore = create<InstallingExtensionsState>((set) => ({
    installingProgress: { installed: 0, total: 0, inProgress: false },
    setInstallingProgress: (progress) => {
      if (typeof progress === 'function') {
        set((state) => ({
          installingProgress: progress(state.installingProgress)
        }));
      } else {
        set({ installingProgress: progress });
      }
    },
  }));
