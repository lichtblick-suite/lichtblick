// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { TelemetrySample } from "../../../packages/suite-base/src/util/telemetry/types";

export type PanelEventName = "panel.mount" | "panel.unmount" | "panel.firstRender";

export type PanelAccumulator = {
  panelType: string;
  /** Event timestamps per panel event name (in input order). */
  events: Record<PanelEventName, number[]>;
  samples: TelemetrySample[];
};
