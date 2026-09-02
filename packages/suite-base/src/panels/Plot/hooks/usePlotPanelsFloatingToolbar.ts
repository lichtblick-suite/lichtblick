// SPDX-FileCopyrightText: Copyright (C) 2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";

const selectPlotPanelsFloatingToolbar = (state: LayoutState) =>
  state.selectedLayout?.data?.plotPanelsFloatingToolbar ?? false;

/**
 * Reads the layout-wide, JSON-only switch for the Plot panel's floating title/toolbar (see
 * `LayoutData.plotPanelsFloatingToolbar`). Applies uniformly to every Plot panel in the layout;
 * there is no per-panel override.
 */
export default function usePlotPanelsFloatingToolbar(): boolean {
  return useCurrentLayoutSelector(selectPlotPanelsFloatingToolbar);
}
