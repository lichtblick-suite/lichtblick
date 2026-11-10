// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Distinguishes benchmark data source paths that exercise the real production player pipeline
 * (`IterablePlayer` over `McapIterableSource`/`DeserializingIterableSource`) from the legacy
 * synthetic-instrumented `BenchmarkPlayer` path. Read by report-generation tooling (not part of
 * this module) to label which results came from which pipeline.
 */
export type BenchmarkPipelineKind = "real" | "synthetic";
