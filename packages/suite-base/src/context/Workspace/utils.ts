// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export function normalizeExtensions(allExtensions: string[]): `.${string}`[] {
  return allExtensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`)) as `.${string}`[];
}
