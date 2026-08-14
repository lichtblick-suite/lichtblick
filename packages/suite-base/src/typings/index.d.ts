// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Custom types available globally and required when using app components as dependencies

// Global ambient types declared without any `import`/`export` (e.g. `MemoryInfo`,
// `performance.memory`, `structuredClone`, and the WICG File System Access globals such as
// `OpenFilePickerOptions`, `window.showOpenFilePicker`, and the `FileSystemFileHandle`
// permission methods). As of TypeScript 6.0 these global-only `@types` packages are no longer
// pulled in by automatic type discovery, so we reference them explicitly here to keep the
// declarations available program-wide.
/// <reference types="foxglove__web" />
/// <reference types="wicg-file-system-access" />

import "./extensions";
import "./react";
import "./overrides";
import "./webpack-defines";
import "./i18next";
import "./leaflet-ellipse";
import "./env";
