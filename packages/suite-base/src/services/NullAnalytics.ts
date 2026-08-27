// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ITelemetry from "./ITelemetry";

// Implements `ITelemetry` (a superset of `IAnalytics`) so it can be used as the fallback for both
// call sites that only log events and call sites that also record metrics (see ITelemetry.ts).
export default class NullAnalytics implements ITelemetry {
  public logEvent(): void {
    // no-op
  }
  public recordValue(): void {
    // no-op
  }
  public recordDuration(): void {
    // no-op
  }
  public incrementCounter(): void {
    // no-op
  }
  public async flush(): Promise<void> {
    // no-op
  }
}
