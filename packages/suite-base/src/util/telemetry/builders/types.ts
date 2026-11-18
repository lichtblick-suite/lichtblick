// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ITelemetry } from "../types";

/**
 * `ITelemetry` double whose members are `jest.Mock`s. Declared with property signatures (not
 * `jest.Mocked<ITelemetry>`, which keeps the interface's method declarations) so tests can pass
 * `telemetry.counter` etc. to `expect()` without tripping `@typescript-eslint/unbound-method`.
 */
export type TelemetryMock = {
  isEnabled: jest.Mock<boolean, []>;
  gauge: jest.Mock<void, Parameters<ITelemetry["gauge"]>>;
  counter: jest.Mock<void, Parameters<ITelemetry["counter"]>>;
  observe: jest.Mock<void, Parameters<ITelemetry["observe"]>>;
  event: jest.Mock<void, Parameters<ITelemetry["event"]>>;
  ingest: jest.Mock<void, Parameters<ITelemetry["ingest"]>>;
};
