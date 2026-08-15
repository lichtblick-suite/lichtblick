// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum AppSetting {
  // General
  // Agent (local pi runtime). The desktop secure credential store additionally protects the
  // provider API keys under agent.llmApiKey / agent.profile.*.llmApiKey (never AppConfiguration).
  AGENT_ENABLED = "agent.enabled",
  AGENT_LLM_PROVIDER = "agent.llmProvider",
  AGENT_ANTHROPIC_BASE_URL = "agent.anthropic.baseUrl",
  AGENT_ANTHROPIC_MODEL = "agent.anthropic.model",
  AGENT_OPENAI_BASE_URL = "agent.openai.baseUrl",
  AGENT_OPENAI_MODEL = "agent.openai.model",
  /** JSON-serialized agent long-term memory. Not a secret; see services/agent/memory. */
  AGENT_MEMORY = "agent.memory",
  /** JSON-serialized user edits to the agent's instructions and skills; see services/agent/prompts. */
  AGENT_PROMPT_CUSTOMIZATION = "agent.promptCustomization",
  COLOR_SCHEME = "colorScheme",
  TIMEZONE = "timezone",
  TIME_FORMAT = "time.format",
  MESSAGE_RATE = "messageRate",
  UPDATES_ENABLED = "updates.enabled",
  LANGUAGE = "language",
  DEFAULT_STEP_SIZE = "stepSize",

  // ROS
  ROS_PACKAGE_PATH = "ros.ros_package_path",
  ENABLE_NEW_TOPNAV = "enableNewTopNav",

  // Privacy
  TELEMETRY_ENABLED = "telemetry.telemetryEnabled",
  CRASH_REPORTING_ENABLED = "telemetry.crashReportingEnabled",

  // Experimental features
  SHOW_DEBUG_PANELS = "showDebugPanels",

  // Miscellaneous
  HIDE_SIGN_IN_PROMPT = "hideSignInPrompt",
  LAUNCH_PREFERENCE = "launchPreference",
  SHOW_OPEN_DIALOG_ON_STARTUP = "ui.open-dialog-startup",
  ENABLE_UNIFIED_NAVIGATION = "ui.new-app-menu",

  // Dev only
  ENABLE_LAYOUT_DEBUGGING = "enableLayoutDebugging",
  ENABLE_MEMORY_USE_INDICATOR = "dev.memory-use-indicator",
}
