// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node runtime imports.

import type { PersistedResultV1 } from "../result/schemaV1";

/**
 * A parsed result (leniently validated: older local artifacts may lack `run.scenario` and the render
 * calibration, see `PersistedResultV1`) and the file it came from.
 */
export type LoadedResult = { fileName: string; result: PersistedResultV1 };
