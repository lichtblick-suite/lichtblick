// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Application configuration constants.
 * Centralizes all environment variables and build-time constants.
 */

// Global variables defined by webpack DefinePlugin
declare const API_URL: string | undefined;
declare const LICHTBLICK_SUITE_VERSION: string | undefined;
declare const DEV_WORKSPACE: string | undefined;

type RuntimeConfig = {
  API_URL?: string;
};

const runtimeConfig = (
  globalThis as typeof globalThis & {
    LICHTBLICK_RUNTIME_CONFIG?: RuntimeConfig;
  }
).LICHTBLICK_RUNTIME_CONFIG;

export const APP_CONFIG = {
  /**
   * API base URL for HTTP requests
   */
  apiUrl: runtimeConfig?.API_URL || API_URL,

  /**
   * Application version
   */
  version: LICHTBLICK_SUITE_VERSION ?? "unknown",

  /**
   * Development workspace prefix (for local storage keys)
   */
  devWorkspace: DEV_WORKSPACE ?? "",
} as const;
