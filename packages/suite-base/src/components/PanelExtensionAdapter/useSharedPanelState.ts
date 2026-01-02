// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo } from "react";

import { Immutable } from "@lichtblick/suite";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import {
  LayoutState,
  SharedPanelState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { getPanelTypeFromId } from "@lichtblick/suite-base/util/layout";

const EmptySharedPanelState: Record<string, SharedPanelState> = Object.freeze({});
const selectSharedState = (state: LayoutState) => state.sharedPanelState ?? EmptySharedPanelState;

/**
 * Returns a [state, setState] pair that can be used to read and update shared transient
 * panel state.
 */
export function useSharedPanelState(): [
  Immutable<SharedPanelState>,
  (data: Immutable<SharedPanelState>) => void,
] {
  const sharedState = useCurrentLayoutSelector(selectSharedState);
  const { updateSharedPanelState } = useCurrentLayoutActions();

  const panelId = usePanelContext().id;
  const panelType = useMemo(() => getPanelTypeFromId(panelId), [panelId]);

  const sharedData = useMemo(() => sharedState[panelType], [panelType, sharedState]);

  const update = useCallback(
    (data: Immutable<SharedPanelState>) => {
      updateSharedPanelState(panelType, data);
    },
    [panelType, updateSharedPanelState],
  );

  return [sharedData, update];
}
