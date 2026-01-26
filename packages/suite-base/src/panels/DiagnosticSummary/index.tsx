// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Panel from "@lichtblick/suite-base/components/Panel";
import DiagnosticSummary from "@lichtblick/suite-base/panels/DiagnosticSummary/DiagnosticSummary";
import { DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/DiagnosticSummary/constants";

export default Panel(
  Object.assign(DiagnosticSummary, {
    panelType: "DiagnosticSummary",
    defaultConfig: DEFAULT_CONFIG,
  }),
);
