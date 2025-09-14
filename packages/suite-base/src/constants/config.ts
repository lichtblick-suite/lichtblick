// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Application configuration constants.
 * Centralizes all environment variables and build-time constants.
 */

// Helper function to safely access global variables defined by webpack
function getGlobalVar(name: string): string | undefined {
  return (globalThis as never)[name];
}

export const APP_CONFIG = {
  /**
   * API base URL for HTTP requests
   */
  apiUrl: getGlobalVar("API_URL") ?? "/",

  /**
   * Application version
   */
  version: getGlobalVar("LICHTBLICK_SUITE_VERSION") ?? "unknown",

  /**
   * Development workspace prefix (for local storage keys)
   */
  devWorkspace: getGlobalVar("DEV_WORKSPACE") ?? "",
} as const;
