// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Panel from "@lichtblick/suite-base/components/Panel";
import { DEFAULT_PLOT_CONFIG } from "@lichtblick/suite-base/panels/Plot/constants";

import PlotTwo from "./PlotTwo";

export default Panel(
  Object.assign(PlotTwo, {
    panelType: "PlotTwo",
    defaultConfig: DEFAULT_PLOT_CONFIG,
  }),
);
