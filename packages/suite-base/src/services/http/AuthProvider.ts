// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export interface AuthProvider {
  getAuthHeaders(): Promise<Record<string, string>>;
  handleUnauthorizedResponse?: (response: Response) => Promise<void> | void;
}
