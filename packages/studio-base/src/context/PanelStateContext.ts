// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { DeepReadonly } from "ts-essentials";
import { useStore, StoreApi } from "zustand";

import { RenderState, SettingsTree } from "@foxglove/studio";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";

export type ImmutableSettingsTree = DeepReadonly<SettingsTree>;

export type SharedPanelState = RenderState["sharedPanelState"];

type PanelType = string;

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

  /**
   * Transient state shared between panels, keyed by panel type.
   */
  sharedPanelState: Record<PanelType, SharedPanelState>;

  /**
   * Increments the sequence number for the panel, forcing a remount.
   */
  incrementSequenceNumber: (panelId: string) => void;

  /**
   * Updates the settings UI for the given panel.
   */
  updateSettingsTree: (panelId: string, settingsTree: ImmutableSettingsTree | undefined) => void;

  /**
   * Update the transient state associated with a particular panel type.
   */
  updateSharedPanelState: (type: PanelType, data: SharedPanelState) => void;
};

export const PanelStateContext = createContext<undefined | StoreApi<PanelStateStore>>(undefined);

export function usePanelStateStore<T>(
  selector: (store: PanelStateStore) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(PanelStateContext);
  return useStore(context, selector, equalityFn);
}
