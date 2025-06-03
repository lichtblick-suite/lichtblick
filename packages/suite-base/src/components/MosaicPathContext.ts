// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { MosaicPath } from "react-mosaic-component";

/**
 * Exposes the mosaic path at which a panel is located. Unlike calling
 * `mosaicWindowActions.getPath()` during render, subscribing to this context will trigger a
 * re-render when the path changes.
 */
export const MosaicPathContext = createContext<MosaicPath | undefined>(undefined);
