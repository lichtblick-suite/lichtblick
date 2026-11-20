// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Parses one artifact file's contents for the CI summary. A truncated or otherwise unreadable
 * file is warned about and skipped (`undefined`) so that one bad artifact cannot abort the whole
 * summary.
 */
export function parseArtifactJson<T>(fileName: string, text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn(`Skipping unreadable artifact ${fileName}: ${String(error)}`);
    return undefined;
  }
}
