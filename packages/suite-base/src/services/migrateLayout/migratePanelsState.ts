// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MarkOptional } from "ts-essentials";

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";

import { migrateLegacyToNew3DPanels } from "./migrateLegacyToNew3DPanels";
import { migrateLegacyToNewImagePanels } from "./migrateLegacyToNewImagePanels";

/**
 * Perform any necessary migrations on old layout data.
 */
export function migratePanelsState(data: MarkOptional<LayoutData, "configById">): LayoutData {
  let result: LayoutData = { ...data, configById: data.configById ?? {} };

  result = migrateLegacyToNew3DPanels(result);
  result = migrateLegacyToNewImagePanels(result);

  return result;
}
