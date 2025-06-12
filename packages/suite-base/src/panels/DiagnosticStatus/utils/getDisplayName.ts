// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DISPLAY_EMPTY_STATE } from "@lichtblick/suite-base/panels/DiagnosticStatus/constants";

export function getDisplayName(hardwareId: string, name: string): string {
  if (name && hardwareId) {
    return `${hardwareId}: ${name}`;
  }
  if (name) {
    return name;
  }
  if (hardwareId) {
    return hardwareId;
  }

  return DISPLAY_EMPTY_STATE;
}
