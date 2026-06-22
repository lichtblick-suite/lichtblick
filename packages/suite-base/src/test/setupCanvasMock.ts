// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Only install the canvas mock when running in a DOM environment (jsdom). Tests that
// run in the default `node` environment have no `window` and do not need canvas support.
if (typeof window !== "undefined") {
  await import("vitest-canvas-mock");
}
