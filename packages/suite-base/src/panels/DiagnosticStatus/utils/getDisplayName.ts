// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export function getDisplayName(hardwareId: string, name: string): string {
  return name.length > 0
    ? hardwareId.length > 0
      ? `${hardwareId}: ${name}`
      : name
    : hardwareId.length > 0
      ? hardwareId
      : `(empty)`;
}
