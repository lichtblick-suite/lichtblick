// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

import { useEffect, useState, useSyncExternalStore } from "react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import type { IAppConfiguration } from "@lichtblick/suite-base/context/AppConfigurationContext";

export type AgentLlmProvider = "anthropic" | "openai-compatible";

export const DEFAULT_AGENT_LLM_PROVIDER: AgentLlmProvider = "anthropic";
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";

export type AgentConfiguration = {
  apiKey: string;
  baseUrl: string;
  desktop: boolean;
  model: string;
  provider: AgentLlmProvider;
};

type AgentConfigurationField = "apiKey" | "baseUrl" | "model";
type AgentConfigurationError = "invalidUrl" | "required";
export type AgentConfigurationErrors = Partial<
  Record<AgentConfigurationField, AgentConfigurationError>
>;

export type ProviderSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type AgentProfile = {
  anthropic: ProviderSettings;
  id: string;
  name: string;
  openAiCompatible: ProviderSettings;
  provider: AgentLlmProvider;
};

export type AgentSettingsSnapshot = {
  activeProfileId: string;
  /**
   * Profiles are the source of truth. The top-level provider settings below are retained only as
   * a backwards-compatible projection of the active profile.
   */
  profiles: AgentProfile[];
  anthropic: ProviderSettings;
  credentialResaveRequired: boolean;
  credentialStorage: "plaintext" | "secure";
  openAiCompatible: ProviderSettings;
  provider: AgentLlmProvider;
  revision: string;
  storageError: boolean;
};

export type AgentSettingsDraft = Omit<
  AgentSettingsSnapshot,
  "activeProfileId" | "credentialResaveRequired" | "credentialStorage" | "profiles" | "storageError"
> & {
  // Optional only for compatibility with callers constructing the legacy single-profile draft.
  activeProfileId?: string;
  profiles?: AgentProfile[];
};

export type AgentSettingsState = {
  credentialBackendUnavailable: boolean;
  migrationError?: Error;
  migrationReady: boolean;
  snapshot: AgentSettingsSnapshot;
};

export class AgentSettingsConflictError extends Error {
  public constructor() {
    super("Agent settings changed in another context");
    this.name = "AgentSettingsConflictError";
  }
}

export class AgentCredentialsBackendUnavailableError extends Error {
  public constructor() {
    super("OS-backed secure credential encryption is temporarily unavailable");
    this.name = "AgentCredentialsBackendUnavailableError";
  }
}

export class AgentPlaintextCredentialLockUnavailableError extends Error {
  public constructor() {
    super("Cross-window locking is unavailable for plaintext credentials");
    this.name = "AgentPlaintextCredentialLockUnavailableError";
  }
}

class InsecureCredentialBackendError extends Error {
  public constructor() {
    super("OS-backed secure credential encryption is unavailable");
    this.name = "InsecureCredentialBackendError";
  }
}

const WEB_CREDENTIAL_STORAGE_KEY = "lichtblick.agent.credentials.v1";
const PREVIOUS_API_KEY_STORAGE_KEYS: Record<AgentLlmProvider, string> = {
  anthropic: "lichtblick.agent.anthropic.apiKey",
  "openai-compatible": "lichtblick.agent.openai.apiKey",
};
const SECURE_LLM_CREDENTIAL = "agent.llmApiKey";
const LEGACY_API_KEY_SETTING = "agent.llmApiKey";
const LEGACY_BASE_URL_SETTING = "agent.llmBaseUrl";
const LEGACY_MODEL_SETTING = "agent.llmModel";
const COMMIT_REVISION_SETTING = "agent.configurationRevision";
const PROFILES_SETTING = "agent.profiles";
const ACTIVE_PROFILE_ID_SETTING = "agent.activeProfileId";
const CROSS_RENDERER_COMMIT_LOCK = "lichtblick.agent-settings.commit";
const DEFAULT_PROFILE_ID = "default";
const PROFILE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

type ProfileCredentialKeys = {
  anthropicApiKey: string;
  openAiApiKey: string;
};

type CredentialBundle = {
  profileKeys: Record<string, ProfileCredentialKeys>;
};

type AgentProfileMirror = {
  anthropic: Omit<ProviderSettings, "apiKey">;
  id: string;
  name: string;
  openAiCompatible: Omit<ProviderSettings, "apiKey">;
  provider: AgentLlmProvider;
};

type AgentSettingsMirror = {
  activeProfileId?: string;
  anthropicBaseUrl: string;
  anthropicModel: string;
  openAiBaseUrl: string;
  openAiModel: string;
  profiles?: AgentProfileMirror[];
  provider: AgentLlmProvider;
};

type CredentialState = {
  configuration?: AgentSettingsMirror;
  credentials: CredentialBundle;
  desktopRecordsPresent: boolean;
  legacyApiKey?: string;
  legacyFormat: boolean;
  resaveRequired: boolean;
  revision: string;
  source: "desktop" | "web";
  storage: "plaintext" | "secure";
  storageError: boolean;
};

interface DesktopBridgeWithSecureCredentials {
  deleteSecureCredential(name: string): Promise<unknown>;
  getSecureCredential(name: string): Promise<unknown>;
  setManySecureCredentials(entries: unknown[]): Promise<unknown>;
}

type AgentSettingsStore = {
  appConfiguration: IAppConfiguration;
  credentialBackendUnavailable: boolean;
  credentialState: CredentialState;
  desktop: boolean;
  listeners: Set<() => void>;
  migrated: boolean;
  migration?: Promise<void>;
  snapshot: AgentSettingsSnapshot;
  suppressRefresh: number;
  unsubscribeSources?: () => void;
};

const EMPTY_CREDENTIALS: CredentialBundle = {
  profileKeys: {},
};

const stores = new WeakMap<
  IAppConfiguration,
  { desktop?: AgentSettingsStore; web?: AgentSettingsStore }
>();
let agentSettingsCommitChain: Promise<void> = Promise.resolve();

type CrossRendererLockManager = {
  request<Result>(name: string, callback: () => Promise<Result>): Promise<Result>;
};

const OBSERVED_SETTINGS = [
  AppSetting.AGENT_LLM_PROVIDER,
  AppSetting.AGENT_ANTHROPIC_BASE_URL,
  AppSetting.AGENT_ANTHROPIC_MODEL,
  AppSetting.AGENT_OPENAI_BASE_URL,
  AppSetting.AGENT_OPENAI_MODEL,
  PROFILES_SETTING,
  ACTIVE_PROFILE_ID_SETTING,
  COMMIT_REVISION_SETTING,
] as const;

async function withAgentSettingsCommitLock<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  const result = agentSettingsCommitChain.then(operation);
  agentSettingsCommitChain = result.then(
    () => undefined,
    () => undefined,
  );
  return await result;
}

function getCrossRendererLockManager(): CrossRendererLockManager | undefined {
  const navigatorValue = globalThis.navigator as (Navigator & { locks?: unknown }) | undefined;
  const lockManager = navigatorValue?.locks;
  if (
    !isRecord(lockManager) ||
    !("request" in lockManager) ||
    typeof lockManager.request !== "function"
  ) {
    return undefined;
  }
  return lockManager;
}

async function withAgentSettingsPersistenceLock<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  return await withAgentSettingsCommitLock(async () => {
    const lockManager = getCrossRendererLockManager();
    if (lockManager == undefined) {
      return await operation();
    }
    return await lockManager.request(CROSS_RENDERER_COMMIT_LOCK, operation);
  });
}

/*
 * Credential trust boundary:
 * - Desktop uses the preload bridge backed by the OS credential store when available.
 * - Installed extensions execute in the application renderer and are trusted at the same level as
 *   the application. They can call the preload bridge or read the plaintext fallback.
 * - Web has no isolated secret channel and deliberately falls back to same-origin localStorage.
 *   Any same-origin script, including an installed extension, can read Web credentials.
 *
 * Raw key names and storage functions stay private and must never be attached to AppContext,
 * WorkspaceContext, contribution points, or the extension API.
 */
function getLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function getDesktopCredentialBridge(): DesktopBridgeWithSecureCredentials {
  const candidate = (globalThis as typeof globalThis & { desktopBridge?: unknown }).desktopBridge;
  if (
    typeof candidate !== "object" ||
    candidate == undefined ||
    !("getSecureCredential" in candidate) ||
    typeof candidate.getSecureCredential !== "function" ||
    !("setManySecureCredentials" in candidate) ||
    typeof candidate.setManySecureCredentials !== "function" ||
    !("deleteSecureCredential" in candidate) ||
    typeof candidate.deleteSecureCredential !== "function"
  ) {
    throw new Error("Desktop secure credential bridge is unavailable");
  }
  return candidate as DesktopBridgeWithSecureCredentials;
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getProvider(value: unknown): AgentLlmProvider {
  return value === "openai-compatible" ? value : DEFAULT_AGENT_LLM_PROVIDER;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

function isProfileId(value: unknown): value is string {
  return typeof value === "string" && PROFILE_ID_PATTERN.test(value);
}

function profileCredentialKey(profileId: string): string {
  return `agent.profile.${profileId}.llmApiKey`;
}

function emptyProfileCredentialKeys(): ProfileCredentialKeys {
  return { anthropicApiKey: "", openAiApiKey: "" };
}

function parseProfileCredentialKeys(value: unknown): Record<string, ProfileCredentialKeys> {
  if (!isRecord(value)) {
    return {};
  }
  const result: Record<string, ProfileCredentialKeys> = {};
  for (const [profileId, keys] of Object.entries(value)) {
    if (!isProfileId(profileId) || !isRecord(keys)) {
      continue;
    }
    result[profileId] = {
      anthropicApiKey: getString(keys.anthropicApiKey),
      openAiApiKey: getString(keys.openAiApiKey),
    };
  }
  return result;
}

function profileMirrorFromProfile(profile: AgentProfile): AgentProfileMirror {
  return {
    anthropic: {
      baseUrl: profile.anthropic.baseUrl,
      model: profile.anthropic.model,
    },
    id: profile.id,
    name: profile.name,
    openAiCompatible: {
      baseUrl: profile.openAiCompatible.baseUrl,
      model: profile.openAiCompatible.model,
    },
    provider: profile.provider,
  };
}

function parseProfileMirror(value: unknown): AgentProfileMirror | undefined {
  if (
    !isRecord(value) ||
    !isProfileId(value.id) ||
    typeof value.name !== "string" ||
    (value.provider !== "anthropic" && value.provider !== "openai-compatible") ||
    !isRecord(value.anthropic) ||
    typeof value.anthropic.baseUrl !== "string" ||
    typeof value.anthropic.model !== "string" ||
    !isRecord(value.openAiCompatible) ||
    typeof value.openAiCompatible.baseUrl !== "string" ||
    typeof value.openAiCompatible.model !== "string"
  ) {
    return undefined;
  }
  return {
    anthropic: {
      baseUrl: value.anthropic.baseUrl,
      model: value.anthropic.model,
    },
    id: value.id,
    name: value.name,
    openAiCompatible: {
      baseUrl: value.openAiCompatible.baseUrl,
      model: value.openAiCompatible.model,
    },
    provider: value.provider,
  };
}

function parseProfileMirrors(value: unknown): AgentProfileMirror[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }
  const profiles = value.map(parseProfileMirror);
  if (profiles.some((profile) => profile == undefined)) {
    return undefined;
  }
  const parsed = profiles as AgentProfileMirror[];
  return new Set(parsed.map((profile) => profile.id)).size === parsed.length ? parsed : undefined;
}

function parseStoredProfileMirrors(value: string | undefined): AgentProfileMirror[] | undefined {
  if (value == undefined) {
    return undefined;
  }
  try {
    return parseProfileMirrors(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function isInsecureBackendResult(value: unknown): boolean {
  return isRecord(value) && value.code === "insecure-backend";
}

function isBackendUnavailableResult(value: unknown): boolean {
  return isRecord(value) && value.code === "backend-unavailable";
}

function normalizeCredentialBridgeError(error: unknown): never {
  if (isBackendUnavailableResult(error)) {
    throw new AgentCredentialsBackendUnavailableError();
  }
  if (isInsecureBackendResult(error)) {
    throw new InsecureCredentialBackendError();
  }
  if (
    error instanceof Error &&
    error.message.includes("OS-backed secure credential encryption is unavailable")
  ) {
    throw new AgentCredentialsBackendUnavailableError();
  }
  throw error;
}

type DesktopCredentialRead = {
  insecureBackend: boolean;
  value?: string;
};

async function getDesktopCredential(
  bridge: DesktopBridgeWithSecureCredentials,
  name: string,
): Promise<DesktopCredentialRead> {
  let result: unknown;
  try {
    result = await bridge.getSecureCredential(name);
  } catch (error) {
    normalizeCredentialBridgeError(error);
  }
  if (isBackendUnavailableResult(result)) {
    throw new AgentCredentialsBackendUnavailableError();
  }
  if (isInsecureBackendResult(result)) {
    return {
      insecureBackend: true,
      value: isRecord(result) && typeof result.value === "string" ? result.value : undefined,
    };
  }
  if (typeof result === "string") {
    return { insecureBackend: false, value: result };
  }
  if (result == undefined) {
    return { insecureBackend: false };
  }
  if (isRecord(result) && (result.ok === true || result.status === "ok")) {
    if (typeof result.value === "string") {
      return { insecureBackend: false, value: result.value };
    }
    if (result.value == undefined) {
      return { insecureBackend: false };
    }
  }
  throw new Error("Desktop secure credential bridge returned an invalid get result");
}

async function setManyDesktopCredentials(
  bridge: DesktopBridgeWithSecureCredentials,
  entries: Array<{
    expectedRevision?: string;
    key: string;
    value: string;
  }>,
): Promise<void> {
  let result: unknown;
  try {
    result = await bridge.setManySecureCredentials(entries);
  } catch (error) {
    normalizeCredentialBridgeError(error);
  }
  if (isInsecureBackendResult(result)) {
    throw new InsecureCredentialBackendError();
  }
  if (isBackendUnavailableResult(result)) {
    throw new AgentCredentialsBackendUnavailableError();
  }
  if (isRecord(result) && result.code === "revision-conflict") {
    throw new AgentSettingsConflictError();
  }
  if (isRecord(result) && result.code === "invalid-request") {
    throw new Error("Desktop secure credential bridge rejected a credential bundle");
  }
  if (
    result == undefined ||
    result === true ||
    (isRecord(result) && (result.ok === true || result.status === "ok"))
  ) {
    return;
  }
  throw new Error("Desktop secure credential bridge returned an invalid setMany result");
}

async function deleteDesktopCredentialState(
  bridge: DesktopBridgeWithSecureCredentials,
  profileIds: readonly string[] = [],
): Promise<void> {
  await Promise.all([
    bridge.deleteSecureCredential(SECURE_LLM_CREDENTIAL),
    ...profileIds.map(async (profileId) => {
      await bridge.deleteSecureCredential(profileCredentialKey(profileId));
    }),
  ]);
}

function readAppSetting(appConfiguration: IAppConfiguration, key: string): string | undefined {
  try {
    const value = appConfiguration.get(key);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function emptyCredentialState({
  resaveRequired = false,
  source = "web",
  storage = "plaintext",
  storageError = false,
}: {
  resaveRequired?: boolean;
  source?: "desktop" | "web";
  storage?: "plaintext" | "secure";
  storageError?: boolean;
} = {}): CredentialState {
  return {
    credentials: { ...EMPTY_CREDENTIALS },
    desktopRecordsPresent: false,
    legacyFormat: false,
    resaveRequired,
    revision: "",
    source,
    storage,
    storageError,
  };
}

function parseRecord(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed != undefined
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseSettingsMirror(value: unknown): AgentSettingsMirror | undefined {
  if (
    !isRecord(value) ||
    typeof value.anthropicBaseUrl !== "string" ||
    typeof value.anthropicModel !== "string" ||
    typeof value.openAiBaseUrl !== "string" ||
    typeof value.openAiModel !== "string" ||
    (value.provider !== "anthropic" && value.provider !== "openai-compatible")
  ) {
    return undefined;
  }
  const profiles = parseProfileMirrors(value.profiles);
  const activeProfileId = getString(value.activeProfileId);
  const hasValidProfiles = profiles?.some((profile) => profile.id === activeProfileId) === true;
  return {
    ...(hasValidProfiles ? { activeProfileId } : {}),
    anthropicBaseUrl: value.anthropicBaseUrl,
    anthropicModel: value.anthropicModel,
    openAiBaseUrl: value.openAiBaseUrl,
    openAiModel: value.openAiModel,
    ...(hasValidProfiles ? { profiles } : {}),
    provider: value.provider,
  };
}

function readWebCredentialState(): CredentialState {
  const storage = getLocalStorage();
  if (storage == undefined) {
    return emptyCredentialState({ storageError: true });
  }

  try {
    const serialized = storage.getItem(WEB_CREDENTIAL_STORAGE_KEY);
    if (serialized != undefined) {
      const record = parseRecord(serialized);
      if (record == undefined) {
        return emptyCredentialState({ storageError: true });
      }
      const parsedProfileKeys = parseProfileCredentialKeys(record.profileKeys);
      const hasProfileKeys = isRecord(record.profileKeys);
      const profileKeys = hasProfileKeys
        ? parsedProfileKeys
        : {
            [DEFAULT_PROFILE_ID]: {
              anthropicApiKey: getString(record.anthropicApiKey),
              openAiApiKey: getString(record.openAiApiKey),
            },
          };
      return {
        configuration: parseSettingsMirror(record.configuration),
        credentials: {
          profileKeys,
        },
        desktopRecordsPresent: false,
        legacyFormat: typeof record.revision !== "string" || !hasProfileKeys,
        resaveRequired: false,
        revision: getString(record.revision),
        source: "web",
        storage: "plaintext",
        storageError: false,
      };
    }

    const anthropicApiKey = storage.getItem(PREVIOUS_API_KEY_STORAGE_KEYS.anthropic) ?? "";
    const openAiApiKey = storage.getItem(PREVIOUS_API_KEY_STORAGE_KEYS["openai-compatible"]) ?? "";
    return {
      credentials: {
        profileKeys: {
          [DEFAULT_PROFILE_ID]: { anthropicApiKey, openAiApiKey },
        },
      },
      desktopRecordsPresent: false,
      legacyFormat: anthropicApiKey !== "" || openAiApiKey !== "",
      resaveRequired: false,
      revision: "",
      source: "web",
      storage: "plaintext",
      storageError: false,
    };
  } catch {
    return emptyCredentialState({ storageError: true });
  }
}

async function readDesktopCredentialState(
  appConfiguration: IAppConfiguration,
): Promise<CredentialState> {
  const bridge = getDesktopCredentialBridge();
  const llmRead = await getDesktopCredential(bridge, SECURE_LLM_CREDENTIAL);
  const llmValue = llmRead.value;
  const llmRecord = llmValue == undefined ? undefined : parseRecord(llmValue);
  const configuration = parseSettingsMirror(llmRecord?.configuration);
  const profileIds = configuration?.profiles?.map((profile) => profile.id) ?? [DEFAULT_PROFILE_ID];
  const profileReads = await Promise.all(
    profileIds.map(async (profileId) => ({
      profileId,
      read: await getDesktopCredential(bridge, profileCredentialKey(profileId)),
    })),
  );
  const insecureBackend =
    llmRead.insecureBackend || profileReads.some(({ read }) => read.insecureBackend);
  const desktopRecordsPresent =
    llmValue != undefined || profileReads.some(({ read }) => read.value != undefined);
  if (insecureBackend) {
    const webState = readWebCredentialState();
    const configurationRevision = readAppSetting(appConfiguration, COMMIT_REVISION_SETTING) ?? "";
    if (
      desktopRecordsPresent &&
      webState.revision !== "" &&
      webState.revision === configurationRevision
    ) {
      await deleteDesktopCredentialState(bridge, profileIds);
      return webState;
    }
  }
  const legacyApiKey = llmValue != undefined && llmRecord == undefined ? llmValue : undefined;
  const llmRevision = getString(llmRecord?.revision);
  const profileKeys: Record<string, ProfileCredentialKeys> = {};
  let profileRevisionMismatch = false;
  for (const { profileId, read } of profileReads) {
    const profileRecord = read.value == undefined ? undefined : parseRecord(read.value);
    const profileRevision = getString(profileRecord?.revision);
    if (profileRevision !== "" && llmRevision !== "" && profileRevision !== llmRevision) {
      profileRevisionMismatch = true;
      continue;
    }
    if (profileRecord != undefined) {
      profileKeys[profileId] = {
        anthropicApiKey: getString(profileRecord.anthropicApiKey),
        openAiApiKey: getString(profileRecord.openAiApiKey),
      };
    }
  }
  profileKeys[DEFAULT_PROFILE_ID] ??= {
    anthropicApiKey: getString(llmRecord?.anthropicApiKey),
    openAiApiKey: getString(llmRecord?.openAiApiKey),
  };
  const revisionMismatch = profileRevisionMismatch;
  const hasAllProfileRecords = profileIds.every((profileId) =>
    profileReads.some(
      ({ profileId: readProfileId, read }) =>
        readProfileId === profileId && read.value != undefined,
    ),
  );

  return {
    configuration,
    credentials: {
      profileKeys,
    },
    desktopRecordsPresent,
    legacyApiKey,
    legacyFormat:
      legacyApiKey != undefined ||
      (llmValue != undefined && llmRevision === "") ||
      configuration?.profiles == undefined ||
      !hasAllProfileRecords ||
      revisionMismatch,
    resaveRequired: insecureBackend && desktopRecordsPresent,
    revision: revisionMismatch ? "" : llmRevision,
    source: "desktop",
    storage: insecureBackend ? "plaintext" : "secure",
    storageError: revisionMismatch,
  };
}

function serializeCredentialValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized == undefined) {
    throw new Error("Agent credentials could not be serialized");
  }
  return serialized;
}

function writeWebCredentialState(
  credentials: CredentialBundle,
  revision: string,
  configuration: AgentSettingsMirror,
): void {
  const storage = getLocalStorage();
  if (storage == undefined) {
    throw new Error("Local storage is unavailable");
  }
  const activeProfileKeys =
    credentials.profileKeys[configuration.activeProfileId ?? DEFAULT_PROFILE_ID] ??
    emptyProfileCredentialKeys();
  storage.setItem(
    WEB_CREDENTIAL_STORAGE_KEY,
    serializeCredentialValue({
      anthropicApiKey: activeProfileKeys.anthropicApiKey,
      configuration,
      openAiApiKey: activeProfileKeys.openAiApiKey,
      profileKeys: credentials.profileKeys,
      revision,
    }),
  );
}

async function writeDesktopCredentialState(
  credentials: CredentialBundle,
  revision: string,
  configuration: AgentSettingsMirror,
  expectedRevision: string | undefined,
): Promise<void> {
  const bridge = getDesktopCredentialBridge();
  const activeProfileKeys =
    credentials.profileKeys[configuration.activeProfileId ?? DEFAULT_PROFILE_ID] ??
    emptyProfileCredentialKeys();
  await setManyDesktopCredentials(bridge, [
    {
      ...(expectedRevision == undefined ? {} : { expectedRevision }),
      key: SECURE_LLM_CREDENTIAL,
      value: serializeCredentialValue({
        anthropicApiKey: activeProfileKeys.anthropicApiKey,
        configuration,
        openAiApiKey: activeProfileKeys.openAiApiKey,
        revision,
      }),
    },
    ...Object.entries(credentials.profileKeys).map(([profileId, keys]) => ({
      key: profileCredentialKey(profileId),
      value: serializeCredentialValue({ ...keys, revision }),
    })),
  ]);
}

async function readCredentialState(store: AgentSettingsStore): Promise<CredentialState> {
  if (!store.desktop || store.credentialState.source === "web") {
    return readWebCredentialState();
  }
  return await readDesktopCredentialState(store.appConfiguration);
}

function assertDesktopPlaintextLockAvailable(): void {
  if (getCrossRendererLockManager() == undefined) {
    throw new AgentPlaintextCredentialLockUnavailableError();
  }
}

async function writeCredentialState(
  store: AgentSettingsStore,
  credentials: CredentialBundle,
  revision: string,
  configuration: AgentSettingsMirror,
  { expectedRevision }: { expectedRevision?: string } = {},
): Promise<void> {
  let storage: CredentialState["storage"] = "plaintext";
  const desktopProfileIds = [
    ...new Set([
      ...(store.credentialState.configuration?.profiles?.map((profile) => profile.id) ?? []),
      ...(configuration.profiles?.map((profile) => profile.id) ?? []),
    ]),
  ];
  if (store.desktop) {
    if (store.credentialState.storage === "secure") {
      try {
        await writeDesktopCredentialState(credentials, revision, configuration, expectedRevision);
        storage = "secure";
      } catch (error) {
        if (!(error instanceof InsecureCredentialBackendError)) {
          throw error;
        }
        assertDesktopPlaintextLockAvailable();
        writeWebCredentialState(credentials, revision, configuration);
        if (store.credentialState.desktopRecordsPresent) {
          await deleteDesktopCredentialState(getDesktopCredentialBridge(), desktopProfileIds);
        }
      }
    } else {
      assertDesktopPlaintextLockAvailable();
      writeWebCredentialState(credentials, revision, configuration);
      if (store.credentialState.desktopRecordsPresent) {
        await deleteDesktopCredentialState(getDesktopCredentialBridge(), desktopProfileIds);
      }
    }
  } else {
    writeWebCredentialState(credentials, revision, configuration);
  }
  store.credentialState = {
    configuration,
    credentials: {
      profileKeys: Object.fromEntries(
        Object.entries(credentials.profileKeys).map(([profileId, keys]) => [
          profileId,
          { ...keys },
        ]),
      ),
    },
    desktopRecordsPresent: storage === "secure",
    legacyFormat: false,
    resaveRequired: false,
    revision,
    source: storage === "secure" ? "desktop" : "web",
    storage,
    storageError: false,
  };
}

function settingsMirrorFromDraft(draft: AgentSettingsDraft): AgentSettingsMirror {
  if (draft.profiles == undefined || draft.activeProfileId == undefined) {
    throw new Error("Agent settings draft has not been normalized");
  }
  return {
    activeProfileId: draft.activeProfileId,
    anthropicBaseUrl: draft.anthropic.baseUrl,
    anthropicModel: draft.anthropic.model,
    openAiBaseUrl: draft.openAiCompatible.baseUrl,
    openAiModel: draft.openAiCompatible.model,
    profiles: draft.profiles.map(profileMirrorFromProfile),
    provider: draft.provider,
  };
}

function cloneProfile(profile: AgentProfile): AgentProfile {
  return {
    ...profile,
    anthropic: { ...profile.anthropic },
    openAiCompatible: { ...profile.openAiCompatible },
  };
}

function profileFromMirror(
  mirror: AgentProfileMirror,
  credentials: ProfileCredentialKeys,
): AgentProfile {
  return {
    anthropic: {
      apiKey: credentials.anthropicApiKey,
      baseUrl: mirror.anthropic.baseUrl,
      model: mirror.anthropic.model,
    },
    id: mirror.id,
    name: mirror.name,
    openAiCompatible: {
      apiKey: credentials.openAiApiKey,
      baseUrl: mirror.openAiCompatible.baseUrl,
      model: mirror.openAiCompatible.model,
    },
    provider: mirror.provider,
  };
}

function makeDefaultProfile({
  anthropic,
  openAiCompatible,
  provider,
}: {
  anthropic: ProviderSettings;
  openAiCompatible: ProviderSettings;
  provider: AgentLlmProvider;
}): AgentProfile {
  return {
    anthropic: { ...anthropic },
    id: DEFAULT_PROFILE_ID,
    name: "Default",
    openAiCompatible: { ...openAiCompatible },
    provider,
  };
}

function normalizeDraft(
  draft: AgentSettingsDraft,
  currentSnapshot?: AgentSettingsSnapshot,
): AgentSettingsDraft & { activeProfileId: string; profiles: AgentProfile[] } {
  let profiles = draft.profiles?.map(cloneProfile) ?? [
    makeDefaultProfile({
      anthropic: draft.anthropic,
      openAiCompatible: draft.openAiCompatible,
      provider: draft.provider,
    }),
  ];
  const profileIds = new Set<string>();
  for (const profile of profiles) {
    if (!isProfileId(profile.id) || profileIds.has(profile.id)) {
      throw new Error("Agent profile IDs must be unique and use 1-64 letters, numbers, or hyphens");
    }
    profileIds.add(profile.id);
  }
  const activeProfileId = draft.activeProfileId ?? profiles[0]?.id;
  if (activeProfileId == undefined || !profileIds.has(activeProfileId)) {
    throw new Error("Active Agent profile must reference a stored profile");
  }

  const activeProfileIndex = profiles.findIndex((profile) => profile.id === activeProfileId);
  const activeProfile = profiles[activeProfileIndex];
  if (activeProfile == undefined) {
    throw new Error("Active Agent profile is unavailable");
  }
  const currentActiveProfile = currentSnapshot?.profiles.find(
    (profile) => profile.id === activeProfileId,
  );
  const topLevelProjectionChanged =
    currentSnapshot != undefined &&
    (JSON.stringify(draft.anthropic) !== JSON.stringify(currentSnapshot.anthropic) ||
      JSON.stringify(draft.openAiCompatible) !== JSON.stringify(currentSnapshot.openAiCompatible) ||
      draft.provider !== currentSnapshot.provider);
  const profileWasNotEdited =
    currentActiveProfile != undefined &&
    JSON.stringify(activeProfile) === JSON.stringify(currentActiveProfile);

  // Legacy UI writers still edit the top-level projection. Profiles remain authoritative for new
  // writers, while this compatibility bridge copies an unambiguous projection-only edit back into
  // the active profile until the profile-aware settings UI lands.
  if (
    draft.profiles != undefined &&
    activeProfileId === currentSnapshot?.activeProfileId &&
    topLevelProjectionChanged &&
    profileWasNotEdited
  ) {
    profiles = profiles.map((profile) =>
      profile.id === activeProfileId
        ? {
            ...profile,
            anthropic: { ...draft.anthropic },
            openAiCompatible: { ...draft.openAiCompatible },
            provider: draft.provider,
          }
        : profile,
    );
  }

  const projectedProfile = profiles.find((profile) => profile.id === activeProfileId);
  if (projectedProfile == undefined) {
    throw new Error("Active Agent profile is unavailable");
  }
  return {
    ...draft,
    activeProfileId,
    anthropic: { ...projectedProfile.anthropic },
    openAiCompatible: { ...projectedProfile.openAiCompatible },
    profiles,
    provider: projectedProfile.provider,
  };
}

function makeSnapshot(store: AgentSettingsStore): AgentSettingsSnapshot {
  const { appConfiguration, credentialState } = store;
  const configurationRevision = readAppSetting(appConfiguration, COMMIT_REVISION_SETTING) ?? "";
  // A revisioned credential record is the transaction log for the complete Agent settings
  // snapshot. Its configuration mirror stays authoritative even when AppConfiguration has the
  // same revision, so an interrupted/partial configuration restore cannot pair old credentials
  // with a mixture of new non-sensitive values.
  const mirroredConfiguration = credentialState.configuration;
  const legacyAnthropic: ProviderSettings = {
    apiKey: credentialState.credentials.profileKeys[DEFAULT_PROFILE_ID]?.anthropicApiKey ?? "",
    baseUrl:
      mirroredConfiguration?.anthropicBaseUrl ??
      readAppSetting(appConfiguration, AppSetting.AGENT_ANTHROPIC_BASE_URL) ??
      "",
    model:
      mirroredConfiguration?.anthropicModel ??
      readAppSetting(appConfiguration, AppSetting.AGENT_ANTHROPIC_MODEL) ??
      DEFAULT_ANTHROPIC_MODEL,
  };
  const legacyOpenAiCompatible: ProviderSettings = {
    apiKey: credentialState.credentials.profileKeys[DEFAULT_PROFILE_ID]?.openAiApiKey ?? "",
    baseUrl:
      mirroredConfiguration?.openAiBaseUrl ??
      readAppSetting(appConfiguration, AppSetting.AGENT_OPENAI_BASE_URL) ??
      "",
    model:
      mirroredConfiguration?.openAiModel ??
      readAppSetting(appConfiguration, AppSetting.AGENT_OPENAI_MODEL) ??
      "",
  };
  const legacyProvider =
    mirroredConfiguration?.provider ??
    getProvider(readAppSetting(appConfiguration, AppSetting.AGENT_LLM_PROVIDER));
  const profileMirrors =
    mirroredConfiguration?.profiles ??
    parseStoredProfileMirrors(readAppSetting(appConfiguration, PROFILES_SETTING));
  const profiles = profileMirrors?.map((profile) =>
    profileFromMirror(
      profile,
      credentialState.credentials.profileKeys[profile.id] ?? emptyProfileCredentialKeys(),
    ),
  ) ?? [
    makeDefaultProfile({
      anthropic: legacyAnthropic,
      openAiCompatible: legacyOpenAiCompatible,
      provider: legacyProvider,
    }),
  ];
  const storedActiveProfileId =
    mirroredConfiguration?.activeProfileId ??
    readAppSetting(appConfiguration, ACTIVE_PROFILE_ID_SETTING);
  const activeProfileId = profiles.some((profile) => profile.id === storedActiveProfileId)
    ? storedActiveProfileId!
    : profiles[0]!.id;
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId)!;
  return {
    activeProfileId,
    anthropic: { ...activeProfile.anthropic },
    credentialResaveRequired: credentialState.resaveRequired,
    credentialStorage: credentialState.storage,
    openAiCompatible: { ...activeProfile.openAiCompatible },
    profiles,
    provider: activeProfile.provider,
    revision: mirroredConfiguration == undefined ? configurationRevision : credentialState.revision,
    storageError:
      credentialState.storageError ||
      (credentialState.revision !== configurationRevision && mirroredConfiguration == undefined),
  };
}

function hasLegacyAppSettings(appConfiguration: IAppConfiguration): boolean {
  return (
    readAppSetting(appConfiguration, LEGACY_API_KEY_SETTING) != undefined ||
    readAppSetting(appConfiguration, LEGACY_MODEL_SETTING) != undefined ||
    readAppSetting(appConfiguration, LEGACY_BASE_URL_SETTING) != undefined
  );
}

function hasPreviousCredentialKeys(): boolean {
  const storage = getLocalStorage();
  if (storage == undefined) {
    return false;
  }
  try {
    return (
      storage.getItem(PREVIOUS_API_KEY_STORAGE_KEYS.anthropic) != undefined ||
      storage.getItem(PREVIOUS_API_KEY_STORAGE_KEYS["openai-compatible"]) != undefined
    );
  } catch {
    return false;
  }
}

function webMigrationPending(
  appConfiguration: IAppConfiguration,
  credentialState: CredentialState,
): boolean {
  const configurationRevision = readAppSetting(appConfiguration, COMMIT_REVISION_SETTING) ?? "";
  return (
    hasLegacyAppSettings(appConfiguration) ||
    hasPreviousCredentialKeys() ||
    credentialState.legacyFormat ||
    credentialState.revision !== configurationRevision ||
    (credentialState.configuration?.profiles == undefined &&
      parseStoredProfileMirrors(readAppSetting(appConfiguration, PROFILES_SETTING)) == undefined)
  );
}

function getStore(
  appConfiguration: IAppConfiguration,
  { desktop }: { desktop: boolean },
): AgentSettingsStore {
  let variants = stores.get(appConfiguration);
  if (variants == undefined) {
    variants = {};
    stores.set(appConfiguration, variants);
  }
  const variant = desktop ? "desktop" : "web";
  let store = variants[variant];
  if (store != undefined) {
    return store;
  }
  const credentialState = desktop
    ? emptyCredentialState({ source: "desktop", storage: "secure" })
    : readWebCredentialState();
  store = {
    appConfiguration,
    credentialBackendUnavailable: false,
    credentialState,
    desktop,
    listeners: new Set(),
    migrated: desktop ? false : !webMigrationPending(appConfiguration, credentialState),
    snapshot: undefined as unknown as AgentSettingsSnapshot,
    suppressRefresh: 0,
  };
  store.snapshot = makeSnapshot(store);
  variants[variant] = store;
  return store;
}

function publishStore(store: AgentSettingsStore): void {
  store.snapshot = makeSnapshot(store);
  for (const listener of store.listeners) {
    listener();
  }
}

function publishStoreWithoutRefreshingSnapshot(store: AgentSettingsStore): void {
  store.snapshot = {
    ...store.snapshot,
    anthropic: { ...store.snapshot.anthropic },
    openAiCompatible: { ...store.snapshot.openAiCompatible },
    profiles: store.snapshot.profiles.map(cloneProfile),
  };
  for (const listener of store.listeners) {
    listener();
  }
}

async function refreshStoreFromStorage(store: AgentSettingsStore): Promise<void> {
  store.credentialState = await readCredentialState(store);
  store.credentialBackendUnavailable = false;
  publishStore(store);
}

function subscribeStore(store: AgentSettingsStore, listener: () => void): () => void {
  store.listeners.add(listener);
  if (store.unsubscribeSources != undefined) {
    return () => {
      store.listeners.delete(listener);
      if (store.listeners.size === 0) {
        store.unsubscribeSources?.();
        store.unsubscribeSources = undefined;
      }
    };
  }

  const handleAppConfigurationChange = () => {
    if (store.suppressRefresh !== 0) {
      return;
    }
    void refreshStoreFromStorage(store).catch((error: unknown) => {
      if (error instanceof AgentCredentialsBackendUnavailableError) {
        store.credentialBackendUnavailable = true;
        publishStoreWithoutRefreshingSnapshot(store);
        return;
      }
      store.credentialState = emptyCredentialState({
        resaveRequired: store.credentialState.resaveRequired,
        source: store.credentialState.source,
        storage: store.credentialState.storage,
        storageError: true,
      });
      publishStore(store);
    });
  };
  const observedSettings = OBSERVED_SETTINGS;
  for (const key of observedSettings) {
    store.appConfiguration.addChangeListener(key, handleAppConfigurationChange);
  }

  const handleStorage = (event: StorageEvent) => {
    // Revision is written after the complete credential/config snapshot. key === null is clear().
    if (event.key == undefined || event.key.endsWith(COMMIT_REVISION_SETTING)) {
      handleAppConfigurationChange();
    }
  };
  globalThis.addEventListener("storage", handleStorage);

  store.unsubscribeSources = () => {
    for (const key of observedSettings) {
      store.appConfiguration.removeChangeListener(key, handleAppConfigurationChange);
    }
    globalThis.removeEventListener("storage", handleStorage);
  };
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size === 0) {
      store.unsubscribeSources?.();
      store.unsubscribeSources = undefined;
    }
  };
}

function draftFromSnapshot(snapshot: AgentSettingsSnapshot): AgentSettingsDraft {
  return {
    activeProfileId: snapshot.activeProfileId,
    anthropic: { ...snapshot.anthropic },
    openAiCompatible: { ...snapshot.openAiCompatible },
    profiles: snapshot.profiles.map(cloneProfile),
    provider: snapshot.provider,
    revision: snapshot.revision,
  };
}

function nextRevision(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function restoreSetting(
  appConfiguration: IAppConfiguration,
  key: string,
  value: string | undefined,
): Promise<void> {
  await appConfiguration.set(key, value);
}

function settingFromMirror(
  key: (typeof OBSERVED_SETTINGS)[number],
  mirror: AgentSettingsMirror,
  revision: string,
): string {
  switch (key) {
    case AppSetting.AGENT_LLM_PROVIDER:
      return mirror.provider;
    case AppSetting.AGENT_ANTHROPIC_BASE_URL:
      return mirror.anthropicBaseUrl;
    case AppSetting.AGENT_ANTHROPIC_MODEL:
      return mirror.anthropicModel;
    case AppSetting.AGENT_OPENAI_BASE_URL:
      return mirror.openAiBaseUrl;
    case AppSetting.AGENT_OPENAI_MODEL:
      return mirror.openAiModel;
    case PROFILES_SETTING:
      return serializeCredentialValue(mirror.profiles ?? []);
    case ACTIVE_PROFILE_ID_SETTING:
      return mirror.activeProfileId ?? DEFAULT_PROFILE_ID;
    case COMMIT_REVISION_SETTING:
      return revision;
  }
}

async function assertAppConfigurationSnapshot(
  store: AgentSettingsStore,
  expectedValues: ReadonlyMap<(typeof OBSERVED_SETTINGS)[number], string | undefined>,
): Promise<void> {
  const mismatches = [...expectedValues].filter(
    ([key, expectedValue]) => readAppSetting(store.appConfiguration, key) !== expectedValue,
  );
  if (mismatches.length === 0) {
    return;
  }

  // NativeStorageAppConfiguration has no multi-key CAS. Restore the coherent values mirrored in
  // the current credential revision before reporting a conflict. Another non-cooperating writer
  // can still change a non-sensitive key after this comparison; that accepted residual window only
  // affects configuration values, while the credential CAS and mirror keep secrets/config paired.
  store.suppressRefresh++;
  const restoreResults = await Promise.allSettled(
    mismatches.map(async ([key, expectedValue]) => {
      await restoreSetting(store.appConfiguration, key, expectedValue);
    }),
  ).finally(() => {
    store.suppressRefresh--;
  });
  publishStore(store);
  if (restoreResults.some((result) => result.status === "rejected")) {
    throw new Error("Failed to restore Agent settings after a configuration conflict");
  }
  throw new AgentSettingsConflictError();
}

async function assertCurrentRevision(
  store: AgentSettingsStore,
  expectedRevision: string,
): Promise<void> {
  const currentCredentials = await readCredentialState(store);
  const currentConfigurationRevision =
    readAppSetting(store.appConfiguration, COMMIT_REVISION_SETTING) ?? "";
  const mirroredWinner =
    currentCredentials.configuration != undefined &&
    currentCredentials.revision !== "" &&
    currentCredentials.revision !== currentConfigurationRevision;
  const currentRevision = mirroredWinner
    ? currentCredentials.revision
    : currentConfigurationRevision;
  const credentialsMatch =
    (currentCredentials.revision === currentConfigurationRevision || mirroredWinner) &&
    !currentCredentials.legacyFormat &&
    !currentCredentials.storageError;
  if (expectedRevision !== currentRevision || !credentialsMatch) {
    const winnerConfiguration = currentCredentials.configuration;
    if (mirroredWinner && winnerConfiguration != undefined) {
      store.suppressRefresh++;
      const restoreResults = await Promise.allSettled(
        OBSERVED_SETTINGS.map(async (key) => {
          await restoreSetting(
            store.appConfiguration,
            key,
            settingFromMirror(key, winnerConfiguration, currentCredentials.revision),
          );
        }),
      ).finally(() => {
        store.suppressRefresh--;
      });
      if (restoreResults.some((result) => result.status === "rejected")) {
        throw new Error("Failed to load winning Agent settings after a revision conflict");
      }
    }
    store.credentialState = currentCredentials;
    if (currentCredentials.legacyFormat) {
      store.migrated = false;
    }
    publishStore(store);
    throw new AgentSettingsConflictError();
  }
  store.credentialState = currentCredentials;
}

async function commitDraft(
  store: AgentSettingsStore,
  draft: AgentSettingsDraft,
  { allowLegacyState = false }: { allowLegacyState?: boolean } = {},
): Promise<void> {
  const appConfiguration = store.appConfiguration;
  if (!allowLegacyState) {
    await assertCurrentRevision(store, draft.revision);
  }
  const normalizedDraft = normalizeDraft(draft, makeSnapshot(store));
  const previousCredentials = await readCredentialState(store);
  const previousConfiguration =
    previousCredentials.configuration ??
    settingsMirrorFromDraft(draftFromSnapshot(makeSnapshot(store)));
  const persistedSettings = OBSERVED_SETTINGS;
  const previousValues = new Map<(typeof OBSERVED_SETTINGS)[number], string | undefined>(
    persistedSettings.map((key) => [
      key,
      previousCredentials.configuration == undefined ||
      ((key === PROFILES_SETTING || key === ACTIVE_PROFILE_ID_SETTING) &&
        previousCredentials.configuration.profiles == undefined)
        ? readAppSetting(appConfiguration, key)
        : settingFromMirror(key, previousCredentials.configuration, previousCredentials.revision),
    ]),
  );
  const nextCredentials: CredentialBundle = {
    profileKeys: Object.fromEntries(
      normalizedDraft.profiles.map((profile) => [
        profile.id,
        {
          anthropicApiKey: profile.anthropic.apiKey,
          openAiApiKey: profile.openAiCompatible.apiKey,
        },
      ]),
    ),
  };
  const nextConfiguration = settingsMirrorFromDraft(normalizedDraft);
  const removedProfileIds =
    previousConfiguration.profiles
      ?.map((profile) => profile.id)
      .filter((profileId) => !nextCredentials.profileKeys[profileId]) ?? [];
  const revision = nextRevision();

  // The cross-renderer lock makes this comparison atomic with the writes for Web clients. Desktop
  // additionally enforces this revision in the main-process credential transaction below.
  if (!allowLegacyState) {
    await assertCurrentRevision(store, draft.revision);
  }
  await assertAppConfigurationSnapshot(store, previousValues);

  store.suppressRefresh++;
  let credentialWriteCompleted = false;
  try {
    await writeCredentialState(store, nextCredentials, revision, nextConfiguration, {
      expectedRevision: previousCredentials.revision,
    });
    credentialWriteCompleted = true;
    if (store.desktop && store.credentialState.storage === "secure") {
      const bridge = getDesktopCredentialBridge();
      await Promise.all(
        removedProfileIds.map(async (profileId) => {
          await bridge.deleteSecureCredential(profileCredentialKey(profileId));
        }),
      );
    }
    const writes = [
      appConfiguration.set(AppSetting.AGENT_LLM_PROVIDER, normalizedDraft.provider),
      appConfiguration.set(AppSetting.AGENT_ANTHROPIC_BASE_URL, normalizedDraft.anthropic.baseUrl),
      appConfiguration.set(AppSetting.AGENT_ANTHROPIC_MODEL, normalizedDraft.anthropic.model),
      appConfiguration.set(
        AppSetting.AGENT_OPENAI_BASE_URL,
        normalizedDraft.openAiCompatible.baseUrl,
      ),
      appConfiguration.set(AppSetting.AGENT_OPENAI_MODEL, normalizedDraft.openAiCompatible.model),
      appConfiguration.set(
        PROFILES_SETTING,
        serializeCredentialValue(normalizedDraft.profiles.map(profileMirrorFromProfile)),
      ),
      appConfiguration.set(ACTIVE_PROFILE_ID_SETTING, normalizedDraft.activeProfileId),
    ];
    const writeResults = await Promise.allSettled(writes);
    const rejectedWrite = writeResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (rejectedWrite != undefined) {
      throw rejectedWrite.reason;
    }
    await appConfiguration.set(COMMIT_REVISION_SETTING, revision);
  } catch (error) {
    if (error instanceof AgentSettingsConflictError) {
      const winnerCredentials = await readCredentialState(store);
      const winnerConfiguration = winnerCredentials.configuration;
      const winnerRevision = winnerCredentials.revision;
      const restoreResults = await Promise.allSettled(
        [...previousValues].map(async ([key, previousValue]) => {
          await restoreSetting(
            appConfiguration,
            key,
            winnerConfiguration == undefined
              ? previousValue
              : settingFromMirror(key, winnerConfiguration, winnerRevision),
          );
        }),
      );
      store.credentialBackendUnavailable = false;
      store.credentialState = winnerCredentials;
      publishStore(store);
      if (restoreResults.some((result) => result.status === "rejected")) {
        throw new Error("Failed to restore the winning Agent settings after a conflict", {
          cause: error,
        });
      }
      throw error;
    }
    if (!credentialWriteCompleted) {
      store.credentialState = previousCredentials;
      throw error;
    }
    try {
      // Restore the authoritative credential bundle first. From this point onward, every
      // observable/restart snapshot is coherent because makeSnapshot always uses its mirror.
      // AppConfiguration is then repaired one key at a time; interruption or failure can leave
      // stale non-sensitive storage values, but never a mixed effective Agent settings snapshot.
      await writeCredentialState(
        store,
        previousCredentials.credentials,
        previousCredentials.revision,
        previousConfiguration,
        { expectedRevision: revision },
      );
      for (const [key, value] of previousValues) {
        await restoreSetting(appConfiguration, key, value);
      }
    } catch (rollbackError) {
      try {
        store.credentialState = await readCredentialState(store);
      } catch {
        // Keep the last successfully written credential mirror if the backend also became
        // unreadable. Either the forward or rollback mirror is still internally complete.
      }
      publishStore(store);
      throw new Error("Failed to save Agent settings and restore the previous snapshot", {
        cause: rollbackError,
      });
    }
    store.credentialState = previousCredentials;
    throw error;
  } finally {
    store.suppressRefresh--;
  }
  publishStore(store);
}

export async function commitAgentSettings(
  appConfiguration: IAppConfiguration,
  draft: AgentSettingsDraft,
  { desktop = false }: { desktop?: boolean } = {},
): Promise<void> {
  const store = getStore(appConfiguration, { desktop });
  await ensureMigration(store);
  const commitDraftValue =
    draft.profiles == undefined && draft.revision === ""
      ? { ...draft, revision: store.snapshot.revision }
      : draft;
  try {
    await withAgentSettingsPersistenceLock(async () => {
      await commitDraft(store, commitDraftValue);
    });
    if (store.credentialBackendUnavailable) {
      store.credentialBackendUnavailable = false;
      publishStore(store);
    }
  } catch (error) {
    if (error instanceof AgentCredentialsBackendUnavailableError) {
      store.credentialBackendUnavailable = true;
      publishStore(store);
    }
    throw error;
  }
}

function removeLegacyWebCredentials({ removeBundle }: { removeBundle: boolean }): void {
  const storage = getLocalStorage();
  if (storage == undefined) {
    throw new Error("Local storage is unavailable");
  }
  if (removeBundle) {
    storage.removeItem(WEB_CREDENTIAL_STORAGE_KEY);
  }
  storage.removeItem(PREVIOUS_API_KEY_STORAGE_KEYS.anthropic);
  storage.removeItem(PREVIOUS_API_KEY_STORAGE_KEYS["openai-compatible"]);
}

async function ensureMigration(store: AgentSettingsStore): Promise<void> {
  if (store.migrated) {
    return;
  }
  if (store.migration != undefined) {
    await store.migration;
    return;
  }

  const migrate = async () => {
    const appConfiguration = store.appConfiguration;
    const primaryCredentials = await readCredentialState(store);
    const legacyWebCredentials = readWebCredentialState();
    store.credentialState = primaryCredentials;
    const provider = getProvider(readAppSetting(appConfiguration, AppSetting.AGENT_LLM_PROVIDER));
    const legacyApiKey =
      readAppSetting(appConfiguration, LEGACY_API_KEY_SETTING) ?? primaryCredentials.legacyApiKey;
    const legacyModel = readAppSetting(appConfiguration, LEGACY_MODEL_SETTING);
    const legacyBaseUrl = readAppSetting(appConfiguration, LEGACY_BASE_URL_SETTING);
    const configurationRevision = readAppSetting(appConfiguration, COMMIT_REVISION_SETTING) ?? "";
    const legacyWebDefaultKeys =
      legacyWebCredentials.credentials.profileKeys[DEFAULT_PROFILE_ID] ??
      emptyProfileCredentialKeys();
    const needsMigration =
      hasLegacyAppSettings(appConfiguration) ||
      hasPreviousCredentialKeys() ||
      primaryCredentials.legacyFormat ||
      primaryCredentials.revision !== configurationRevision ||
      (primaryCredentials.configuration?.profiles == undefined &&
        parseStoredProfileMirrors(readAppSetting(appConfiguration, PROFILES_SETTING)) ==
          undefined) ||
      (store.desktop &&
        primaryCredentials.storage === "secure" &&
        (legacyWebCredentials.legacyFormat ||
          legacyWebDefaultKeys.anthropicApiKey !== "" ||
          legacyWebDefaultKeys.openAiApiKey !== ""));

    if (needsMigration) {
      const draft = draftFromSnapshot(makeSnapshot(store));
      if (draft.anthropic.apiKey === "") {
        draft.anthropic.apiKey = legacyWebDefaultKeys.anthropicApiKey;
      }
      if (draft.openAiCompatible.apiKey === "") {
        draft.openAiCompatible.apiKey = legacyWebDefaultKeys.openAiApiKey;
      }
      const providerDraft = provider === "anthropic" ? draft.anthropic : draft.openAiCompatible;
      const providerModelSetting =
        provider === "anthropic" ? AppSetting.AGENT_ANTHROPIC_MODEL : AppSetting.AGENT_OPENAI_MODEL;
      const providerBaseUrlSetting =
        provider === "anthropic"
          ? AppSetting.AGENT_ANTHROPIC_BASE_URL
          : AppSetting.AGENT_OPENAI_BASE_URL;
      if (providerDraft.apiKey === "" && legacyApiKey != undefined) {
        providerDraft.apiKey = legacyApiKey;
      }
      if (
        readAppSetting(appConfiguration, providerModelSetting) == undefined &&
        legacyModel != undefined
      ) {
        providerDraft.model = legacyModel;
      }
      if (
        readAppSetting(appConfiguration, providerBaseUrlSetting) == undefined &&
        legacyBaseUrl != undefined
      ) {
        providerDraft.baseUrl = legacyBaseUrl;
      }

      try {
        await commitDraft(store, draft, { allowLegacyState: true });
      } catch (error) {
        const winner = store.credentialState;
        if (
          !(error instanceof AgentSettingsConflictError) ||
          winner.revision === "" ||
          winner.storageError
        ) {
          throw error;
        }
        if (winner.legacyFormat) {
          // The other window may have committed the pre-profile format between our read and CAS.
          // Adopt that coherent winner, then upgrade it in a second revisioned transaction.
          await commitDraft(store, draftFromSnapshot(makeSnapshot(store)), {
            allowLegacyState: true,
          });
        }
        // Another Desktop window completed the same migration first. Its credential mirror is the
        // authoritative migrated snapshot; continue with idempotent legacy-key cleanup.
      }
      if (primaryCredentials.resaveRequired) {
        store.credentialState.resaveRequired = true;
      }
      await Promise.all([
        appConfiguration.set(LEGACY_API_KEY_SETTING, undefined),
        appConfiguration.set(LEGACY_MODEL_SETTING, undefined),
        appConfiguration.set(LEGACY_BASE_URL_SETTING, undefined),
      ]);
      removeLegacyWebCredentials({
        removeBundle: store.desktop && store.credentialState.storage === "secure",
      });
    } else {
      store.credentialState = primaryCredentials;
    }

    store.migrated = true;
    publishStore(store);
  };

  store.migration = withAgentSettingsPersistenceLock(migrate).catch((error: unknown) => {
    store.migration = undefined;
    throw error;
  });
  await store.migration;
}

export function useAgentSettings(
  appConfiguration: IAppConfiguration,
  { desktop = false }: { desktop?: boolean } = {},
): AgentSettingsState {
  const store = getStore(appConfiguration, { desktop });
  const snapshot = useSyncExternalStore(
    (listener) => subscribeStore(store, listener),
    () => store.snapshot,
    () => store.snapshot,
  );
  const [migrationState, setMigrationState] = useState<{
    error?: Error;
    ready: boolean;
  }>(() => ({ ready: store.migrated }));

  useEffect(() => {
    if (store.migrated) {
      return undefined;
    }
    let mounted = true;
    void ensureMigration(store).then(
      () => {
        if (mounted) {
          setMigrationState({ ready: true });
        }
      },
      (error: unknown) => {
        if (mounted) {
          setMigrationState({
            error: error instanceof Error ? error : new Error(String(error)),
            ready: false,
          });
        }
      },
    );
    return () => {
      mounted = false;
    };
  }, [store]);

  return {
    credentialBackendUnavailable: store.credentialBackendUnavailable,
    migrationError: migrationState.error,
    migrationReady: migrationState.ready,
    snapshot,
  };
}

export function createAgentSettingsDraft(snapshot: AgentSettingsSnapshot): AgentSettingsDraft {
  return draftFromSnapshot(snapshot);
}

type AgentSettingsSelectionSnapshot = Omit<AgentSettingsSnapshot, "activeProfileId" | "profiles"> &
  Partial<Pick<AgentSettingsSnapshot, "activeProfileId" | "profiles">>;

export function selectAgentConfiguration(
  snapshot: AgentSettingsSelectionSnapshot,
  { desktop, profileId }: { desktop: boolean; profileId?: string },
): AgentConfiguration {
  const profiles = snapshot.profiles ?? [];
  const selectedProfile =
    profiles.find((profile) => profile.id === (profileId ?? snapshot.activeProfileId)) ??
    profiles.find((profile) => profile.id === snapshot.activeProfileId) ??
    profiles[0];
  const provider = selectedProfile?.provider ?? snapshot.provider;
  const providerSettings =
    provider === "anthropic"
      ? (selectedProfile?.anthropic ?? snapshot.anthropic)
      : (selectedProfile?.openAiCompatible ?? snapshot.openAiCompatible);
  return {
    apiKey: providerSettings.apiKey,
    baseUrl: providerSettings.baseUrl,
    desktop,
    model: providerSettings.model,
    provider,
  };
}

function isHttpUrlWithoutRequestSuffix(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

export function validateAgentConfiguration(
  configuration: AgentConfiguration,
): AgentConfigurationErrors {
  const errors: AgentConfigurationErrors = {};

  if (configuration.apiKey.trim() === "") {
    errors.apiKey = "required";
  }
  if (configuration.model.trim() === "") {
    errors.model = "required";
  }
  if (configuration.provider === "openai-compatible" && configuration.baseUrl.trim() === "") {
    errors.baseUrl = "required";
  } else if (
    configuration.baseUrl.trim() !== "" &&
    !isHttpUrlWithoutRequestSuffix(configuration.baseUrl.trim())
  ) {
    errors.baseUrl = "invalidUrl";
  }

  return errors;
}

export function isAgentConfigurationValid(configuration: AgentConfiguration): boolean {
  return Object.keys(validateAgentConfiguration(configuration)).length === 0;
}
