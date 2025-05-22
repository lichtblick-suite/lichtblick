// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

const VALID_PROTOCOLS = ["https:", "http:", "file:", "data:", "package:"];

export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return VALID_PROTOCOLS.includes(url.protocol);
  } catch {
    return false;
  }
}
