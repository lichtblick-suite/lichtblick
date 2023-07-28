// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { useGuaranteedContext } from "@foxglove/hooks";
import { Immutable, SettingsTree } from "@foxglove/studio";

export type ImmutableSettingsTree = Immutable<SettingsTree>;

export type PanelStateStore = {
  /**
   * Used for forcing remounts on panels to make panels reload their saved configs. This is necessary
   * because panels are free to ignore updates to their config in the layout and maintain their own
   * internal state but we need some way of overriding this and forcing the panel to remount.
   */
  sequenceNumbers: Record<string, number>;

  /**
   * Per-panel settings UI trees.
   */
  settingsTrees: Record<string, ImmutableSettingsTree | undefined>;

  /** Per-panel default titles. */
  defaultTitles: Record<string, string | undefined>;

  /**
   * Increments the sequence number for the panel, forcing a remount.
   */
  incrementSequenceNumber: (panelId: string) => void;

  /**
   * Updates the settings UI for the given panel.
   */
  updateSettingsTree: (panelId: string, settingsTree: ImmutableSettingsTree | undefined) => void;

  /** Updates the default title for the given panel. */
  updateDefaultTitle: (panelId: string, title: string | undefined) => void;
};

export const PanelStateContext = createContext<undefined | StoreApi<PanelStateStore>>(undefined);

export function usePanelStateStore<T>(
  selector: (store: PanelStateStore) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(PanelStateContext);
  return useStore(context, selector, equalityFn);
}
