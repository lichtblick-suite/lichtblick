// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Components, Theme } from "@mui/material";

export type OverrideComponentReturn<T extends keyof Components> = Components<Theme>[T];

export type Language = "en" | "zh" | "ja";
