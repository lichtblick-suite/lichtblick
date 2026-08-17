// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const appSettings = {
  about: "About",
  advanced: "Advanced",
  agent: "Agent",
  agentConfigured: "Agent is configured.",
  agentCredentialBackendUnavailable:
    "The operating system credential backend is temporarily unavailable. Existing desktop credentials and the current form values have been preserved; unlock or restore the credential service, then retry.",
  agentDesktopCredentialStorageInfo:
    "On desktop, credentials are encrypted at rest using the operating system's secure credential storage. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
  agentDesktopLegacyPlaintextCredentialStorageWarning:
    "These credentials are currently stored with plaintext-equivalent protection by a legacy insecure backend. Review and save Agent settings again to move them to the supported plaintext fallback. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
  agentDesktopPlaintextCredentialStorageWarning:
    "No secure credential backend is available (for example, Linux without a keyring), so credentials are stored in plain text. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
  agentEnable: "Enable agent",
  agentEnableHelp: "Show the Agent Chat button in the app bar and allow the agent sidebar to open.",
  agentFieldRequired: "This field is required.",
  agentInvalidUrl:
    "Enter a valid HTTP or HTTPS URL without credentials, query parameters, or a fragment.",
  agentLlmApiKey: "API key",
  agentLlmBaseUrl: "Base URL",
  agentLlmModel: "Model",
  agentLlmProvider: "LLM provider",
  agentInstructions: "Custom instructions",
  agentInstructionsPlaceholder:
    "e.g. Always answer in Chinese. Prefer 60-second slices unless I ask for more.",
  agentMemory: "Memory",
  agentMemoryClear: "Forget all",
  agentMemoryEmpty: "The agent has not stored anything yet.",
  agentMemoryForget: "Forget: {{text}}",
  agentMemoryHelp:
    "Facts the agent chose to keep across sessions. They are included in its context on every message.",
  agentPrompt: "Instructions and skills",
  agentPromptHelp:
    "Customize how the agent behaves. Instructions apply to every message; skills are reference documents it loads on demand.",
  agentPromptSave: "Save instructions and skills",
  agentPromptSaved: "Saved.",
  agentSkillAdd: "Add a skill",
  agentSkillDelete: "Delete this skill",
  agentSkillEdit: "Edit",
  agentSkillEdited: "(edited)",
  agentSkillPreview: "Preview",
  agentSkillNewBody: "Describe what the agent should know or do.",
  agentSkillNewName: "New skill",
  agentSkillNewWhenToUse: "Describe when the agent should load this skill.",
  agentSkillReset: "Reset to the built-in text",
  agentSkillSelect: "Select a skill to edit…",
  agentSkills: "Skills",
  agentProviderAnthropic: "Anthropic",
  agentProviderOpenAICompatible: "OpenAI-compatible",
  agentNotConfigured: "Agent is not configured. Fix the fields below to enable it.",
  agentPlaintextLockUnavailable:
    "Plaintext credential storage cannot be saved because cross-window locking is unavailable. Use a secure desktop credential backend or a runtime with Web Locks support, then retry.",
  agentProfile: "Agent profile",
  agentProfileActive: "active",
  agentProfileCopy: "Copy profile",
  agentProfileCopyName: "Copy of {{name}}",
  agentProfileCreate: "Create profile",
  agentProfileDelete: "Delete profile",
  agentProfileName: "Profile name",
  agentProfileRename: "Rename profile",
  agentProfileRenameCancel: "Cancel",
  agentProfileRenameSave: "Rename",
  agentProfileRenameTitle: "Rename Agent profile",
  agentProfileSetDefault: "Set as default",
  agentSave: "Save Agent settings",
  agentSaving: "Saving…",
  agentSettingsLoading: "Loading and migrating Agent credentials…",
  agentSettingsRevisionConflict:
    "Agent settings changed in another tab. The latest saved values were reloaded; review them and try your edit again.",
  agentSettingsStorageError:
    "Agent credentials or settings could not be read or saved. Your draft has not been discarded.",
  agentWebCredentialStorageWarning:
    "On the Web, credentials are stored in plain text and can be read by same-origin scripts. Installed extensions are trusted at the same level as the application and can access credentials stored on this device. Use desktop with a secure credential backend for encrypted at-rest storage.",
  askEachTime: "Ask each time",
  colorScheme: "Color scheme",
  dark: "Dark",
  debugModeDescription: "Enable panels and features for debugging Lichtblick",
  desktopApp: "Desktop app",
  displayTimestampsIn: "Display timestamps in",
  experimentalFeatures: "Experimental features",
  experimentalFeaturesDescription: "These features are unstable and not recommended for daily use.",
  extensions: "Extensions",
  followSystem: "Follow system",
  general: "General",
  language: "Language",
  layoutDebugging: "Layout debugging",
  layoutDebuggingDescription: "Show extra controls for developing and debugging layout storage.",
  light: "Light",
  messageRate: "Message rate",
  stepSize: "Step size",
  memoryUseIndicator: "Memory use indicator",
  memoryUseIndicatorDescription: "Show the app memory use in the sidebar.",
  syncLichtblickInstances: "Sync Lichtblick instances",
  syncLichtblickInstancesDescription:
    "Activates the button in the right lower corner of the application to sync Lichtblick instances opened.",
  noExperimentalFeatures: "Currently there are no experimental features.",
  openLinksIn: "Open links in",
  ros: "ROS",
  settings: "Settings",
  timestampFormat: "Timestamp format",
  webApp: "Web app",
};
