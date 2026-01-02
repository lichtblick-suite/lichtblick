// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const mergeMultipleFileNames = (names: string[]): string => {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return names[0]!;
  }

  return names.join(", ");
};
