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
declare const OTLP_ENDPOINT: string | undefined;

export const APP_CONFIG = {
  /**
   * API base URL for HTTP requests
   */
  apiUrl: API_URL,

  /**
   * Application version
   */
  version: LICHTBLICK_SUITE_VERSION ?? "unknown",

  /**
   * Development workspace prefix (for local storage keys)
   */
  devWorkspace: DEV_WORKSPACE ?? "",

  /**
   * Base URL of the OTLP/HTTP collector for OpenTelemetry logs, e.g. http://localhost:4318.
   * Undefined disables telemetry regardless of the user opt-in setting.
   */
  otlpEndpoint: OTLP_ENDPOINT,
} as const;
