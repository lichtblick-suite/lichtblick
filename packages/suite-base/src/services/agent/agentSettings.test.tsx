/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook, waitFor } from "@testing-library/react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import {
  AppConfigurationValue,
  IAppConfiguration,
} from "@lichtblick/suite-base/context/AppConfigurationContext";
import {
  AgentCredentialsBackendUnavailableError,
  AgentPlaintextCredentialLockUnavailableError,
  AgentSettingsConflictError,
  AgentSettingsDraft,
  commitAgentSettings,
  createAgentSettingsDraft,
  useAgentSettings,
} from "@lichtblick/suite-base/services/agent/agentSettings";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";

type TestDesktopBridge = {
  deleteSecureCredential: jest.Mock<Promise<unknown>, [string]>;
  getSecureCredential: jest.Mock<Promise<unknown>, [string]>;
  setManySecureCredentials: jest.Mock<
    Promise<unknown>,
    [Array<{ expectedRevision?: string; key: string; value: string }>]
  >;
};

const testGlobal = globalThis as typeof globalThis & {
  desktopBridge?: TestDesktopBridge;
};
const originalBridgeDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "desktopBridge",
);
const originalLocksDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.navigator,
  "locks",
);
let secureCredentials: Map<string, string>;
let desktopBridge: TestDesktopBridge;

function installDesktopCredentialBridge(): void {
  secureCredentials = new Map();
  desktopBridge = {
    deleteSecureCredential: jest.fn(async (name) => {
      secureCredentials.delete(name);
    }),
    getSecureCredential: jest.fn(async (name) => secureCredentials.get(name)),
    setManySecureCredentials: jest.fn(async (entries) => {
      for (const entry of entries) {
        const storedValue = secureCredentials.get(entry.key);
        const storedRevision =
          storedValue == undefined
            ? ""
            : getStringFromSerializedRecord(storedValue, "revision");
        if (
          entry.expectedRevision != undefined &&
          entry.expectedRevision !== storedRevision
        ) {
          return { code: "revision-conflict", ok: false };
        }
      }
      for (const entry of entries) {
        secureCredentials.set(entry.key, entry.value);
      }
      return { ok: true };
    }),
  };
  Object.defineProperty(globalThis, "desktopBridge", {
    configurable: true,
    value: desktopBridge,
    writable: true,
  });
}

function serializeTestValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized == undefined) {
    throw new Error("Unable to serialize test value");
  }
  return serialized;
}

function installTestCrossRendererLock(): void {
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        callback: () => Promise<unknown>,
      ): Promise<unknown> => await callback(),
    },
  });
}

function getStringFromSerializedRecord(
  serialized: string,
  key: string,
): string {
  try {
    const record = JSON.parse(serialized) as Record<string, unknown>;
    return typeof record[key] === "string" ? record[key] : "";
  } catch {
    return "";
  }
}

function makeSharedConfigurations(): [IAppConfiguration, IAppConfiguration] {
  const values = new Map<string, AppConfigurationValue>();
  const makeConfiguration = (): IAppConfiguration => {
    const listeners = new Map<
      string,
      Set<(newValue: AppConfigurationValue) => void>
    >();
    return {
      addChangeListener: (key, listener) => {
        const current = listeners.get(key) ?? new Set();
        current.add(listener);
        listeners.set(key, current);
      },
      get: (key) => values.get(key),
      removeChangeListener: (key, listener) => {
        listeners.get(key)?.delete(listener);
      },
      set: async (key, value) => {
        values.set(key, value);
        for (const listener of listeners.get(key) ?? []) {
          listener(value);
        }
      },
    };
  };
  return [makeConfiguration(), makeConfiguration()];
}

function makeCachedConfiguration(
  durableValues: Map<string, AppConfigurationValue>,
): IAppConfiguration {
  const cachedValues = new Map(durableValues);
  const listeners = new Map<
    string,
    Set<(newValue: AppConfigurationValue) => void>
  >();
  return {
    addChangeListener: (key, listener) => {
      const current = listeners.get(key) ?? new Set();
      current.add(listener);
      listeners.set(key, current);
    },
    get: (key) => cachedValues.get(key),
    removeChangeListener: (key, listener) => {
      listeners.get(key)?.delete(listener);
    },
    set: async (key, value) => {
      durableValues.set(key, value);
      cachedValues.set(key, value);
      for (const listener of listeners.get(key) ?? []) {
        listener(value);
      }
    },
  };
}

const completeDraft: AgentSettingsDraft = {
  anthropic: {
    apiKey: "anthropic-secret",
    baseUrl: "",
    model: "claude-current",
  },
  openAiCompatible: {
    apiKey: "openai-secret",
    baseUrl: "https://openai.example.com/v1",
    model: "openai-current",
  },
  provider: "anthropic",
  revision: "",
};

describe("Agent settings storage", () => {
  beforeEach(() => {
    localStorage.clear();
    installDesktopCredentialBridge();
    installTestCrossRendererLock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalLocksDescriptor == undefined) {
      Reflect.deleteProperty(globalThis.navigator, "locks");
    } else {
      Object.defineProperty(
        globalThis.navigator,
        "locks",
        originalLocksDescriptor,
      );
    }
    if (originalBridgeDescriptor == undefined) {
      delete testGlobal.desktopBridge;
    } else {
      Object.defineProperty(
        globalThis,
        "desktopBridge",
        originalBridgeDescriptor,
      );
    }
  });

  it("migrates generic settings once, preserves provider-specific values, and deletes legacy data", async () => {
    const configuration = makeMockAppConfiguration([
      [AppSetting.AGENT_LLM_PROVIDER, "openai-compatible"],
      ["agent.llmModel", "legacy-model"],
      ["agent.llmBaseUrl", "https://legacy.example.com/v1"],
      ["agent.llmApiKey", "legacy-secret"],
      [AppSetting.AGENT_OPENAI_MODEL, "already-specific"],
    ]);
    const set = jest.spyOn(configuration, "set");
    const { result, unmount } = renderHook(() =>
      useAgentSettings(configuration),
    );

    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });
    expect(result.current.snapshot.openAiCompatible).toEqual({
      apiKey: "legacy-secret",
      baseUrl: "https://legacy.example.com/v1",
      model: "already-specific",
    });
    expect(result.current.snapshot.activeProfileId).toBe("default");
    expect(result.current.snapshot.profiles).toEqual([
      expect.objectContaining({
        id: "default",
        name: "Default",
        openAiCompatible: result.current.snapshot.openAiCompatible,
        provider: "openai-compatible",
      }),
    ]);
    expect(
      JSON.parse(localStorage.getItem("lichtblick.agent.credentials.v1") ?? ""),
    ).toMatchObject({
      profileKeys: { default: { openAiApiKey: "legacy-secret" } },
    });
    expect(configuration.get("agent.llmApiKey")).toBeUndefined();
    expect(configuration.get("agent.llmModel")).toBeUndefined();
    expect(configuration.get("agent.llmBaseUrl")).toBeUndefined();

    const migrationWriteCount = set.mock.calls.length;
    unmount();
    const second = renderHook(() => useAgentSettings(configuration));
    await waitFor(() => {
      expect(second.result.current.migrationReady).toBe(true);
    });
    expect(set).toHaveBeenCalledTimes(migrationWriteCount);
  });

  it("publishes one runtime snapshot after all fields and credentials are durable", async () => {
    const configuration = makeMockAppConfiguration();
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useAgentSettings(configuration);
    });
    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });
    const rendersBeforeCommit = renderCount;

    await act(async () => {
      await commitAgentSettings(configuration, completeDraft);
    });

    expect(renderCount - rendersBeforeCommit).toBe(1);
    expect(result.current.snapshot).toMatchObject({
      anthropic: completeDraft.anthropic,
      openAiCompatible: completeDraft.openAiCompatible,
      provider: completeDraft.provider,
    });
  });

  it("commits profile CRUD, active switching, and the legacy active-profile projection", async () => {
    const configuration = makeMockAppConfiguration();
    const { result } = renderHook(() => useAgentSettings(configuration));
    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });

    const createDraft = createAgentSettingsDraft(result.current.snapshot);
    createDraft.profiles?.push({
      anthropic: {
        apiKey: "profile-anthropic-key",
        baseUrl: "https://anthropic.profile.example.com",
        model: "profile-claude",
      },
      id: "profile-2",
      name: "Second profile",
      openAiCompatible: {
        apiKey: "profile-openai-key",
        baseUrl: "https://openai.profile.example.com/v1",
        model: "profile-openai",
      },
      provider: "openai-compatible",
    });
    await act(async () => {
      await commitAgentSettings(configuration, createDraft);
    });
    expect(result.current.snapshot.profiles).toHaveLength(2);
    expect(result.current.snapshot.activeProfileId).toBe("default");

    const switchDraft = createAgentSettingsDraft(result.current.snapshot);
    switchDraft.activeProfileId = "profile-2";
    await act(async () => {
      await commitAgentSettings(configuration, switchDraft);
    });
    expect(result.current.snapshot).toMatchObject({
      activeProfileId: "profile-2",
      openAiCompatible: {
        apiKey: "profile-openai-key",
        baseUrl: "https://openai.profile.example.com/v1",
        model: "profile-openai",
      },
      provider: "openai-compatible",
    });
    expect(configuration.get(AppSetting.AGENT_LLM_PROVIDER)).toBe(
      "openai-compatible",
    );
    expect(
      JSON.parse(localStorage.getItem("lichtblick.agent.credentials.v1") ?? ""),
    ).toMatchObject({
      openAiApiKey: "profile-openai-key",
      profileKeys: {
        "profile-2": { openAiApiKey: "profile-openai-key" },
      },
    });

    const updateAndDeleteDraft = createAgentSettingsDraft(
      result.current.snapshot,
    );
    const profile = updateAndDeleteDraft.profiles?.find(
      ({ id }) => id === "profile-2",
    );
    if (profile == undefined || updateAndDeleteDraft.profiles == undefined) {
      throw new Error("Expected profile draft");
    }
    profile.name = "Renamed profile";
    profile.openAiCompatible.model = "updated-model";
    updateAndDeleteDraft.profiles = updateAndDeleteDraft.profiles.filter(
      ({ id }) => id !== "default",
    );
    await act(async () => {
      await commitAgentSettings(configuration, updateAndDeleteDraft);
    });
    expect(result.current.snapshot.profiles).toEqual([
      expect.objectContaining({
        id: "profile-2",
        name: "Renamed profile",
        openAiCompatible: expect.objectContaining({ model: "updated-model" }),
      }),
    ]);
    expect(result.current.snapshot.openAiCompatible.model).toBe(
      "updated-model",
    );
  });

  it("handles cross-tab clear and denied reads without throwing from the hook", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, completeDraft);
    const { result } = renderHook(() => useAgentSettings(configuration));
    await waitFor(() => {
      expect(result.current.snapshot.anthropic.apiKey).toBe("anthropic-secret");
    });

    await act(async () => {
      localStorage.clear();
      globalThis.dispatchEvent(new StorageEvent("storage", { key: null }));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.snapshot.anthropic.apiKey).toBe("");
    });

    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    await act(async () => {
      globalThis.dispatchEvent(new StorageEvent("storage", { key: null }));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.snapshot.storageError).toBe(true);
    });
  });

  it("migrates desktop credentials to the secure bridge before deleting legacy values", async () => {
    const configuration = makeMockAppConfiguration([
      [AppSetting.AGENT_LLM_PROVIDER, "openai-compatible"],
      ["agent.llmApiKey", "legacy-openai-key"],
    ]);
    localStorage.setItem(
      "lichtblick.agent.anthropic.apiKey",
      "legacy-anthropic-key",
    );
    const { result } = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );

    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });

    expect(desktopBridge.getSecureCredential).toHaveBeenCalledWith(
      "agent.llmApiKey",
    );
    const llmRecord = JSON.parse(
      secureCredentials.get("agent.llmApiKey") ?? "",
    ) as Record<string, string>;
    expect(llmRecord).toMatchObject({
      anthropicApiKey: "legacy-anthropic-key",
      openAiApiKey: "legacy-openai-key",
    });
    expect(llmRecord.revision).toMatch(/^\d+-/);
    expect(
      JSON.parse(
        secureCredentials.get("agent.profile.default.llmApiKey") ?? "",
      ),
    ).toMatchObject({
      anthropicApiKey: "legacy-anthropic-key",
      openAiApiKey: "legacy-openai-key",
      revision: llmRecord.revision,
    });
    const migrationEntries =
      desktopBridge.setManySecureCredentials.mock.calls[0]?.[0];
    expect(migrationEntries).toHaveLength(2);
    expect(migrationEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedRevision: "",
          key: "agent.llmApiKey",
        }),
        expect.objectContaining({ key: "agent.profile.default.llmApiKey" }),
      ]),
    );
    expect(configuration.get("agent.llmApiKey")).toBeUndefined();
    expect(
      localStorage.getItem("lichtblick.agent.anthropic.apiKey"),
    ).toBeNull();
  });

  it("prefers per-profile desktop credentials and deletes a removed profile key", async () => {
    const durableValues = new Map<string, AppConfigurationValue>();
    const configuration = makeCachedConfiguration(durableValues);
    await commitAgentSettings(configuration, completeDraft, { desktop: true });
    const current = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );
    await waitFor(() => {
      expect(current.result.current.migrationReady).toBe(true);
    });

    const draft = createAgentSettingsDraft(current.result.current.snapshot);
    draft.profiles?.push({
      anthropic: {
        apiKey: "second-profile-secret",
        baseUrl: "https://second.example.com",
        model: "second-model",
      },
      id: "profile-2",
      name: "Second profile",
      openAiCompatible: { apiKey: "", baseUrl: "", model: "" },
      provider: "anthropic",
    });
    draft.activeProfileId = "profile-2";
    await act(async () => {
      await commitAgentSettings(configuration, draft, { desktop: true });
    });

    const fixedRecord = JSON.parse(
      secureCredentials.get("agent.llmApiKey") ?? "",
    ) as Record<string, unknown>;
    secureCredentials.set(
      "agent.llmApiKey",
      serializeTestValue({
        ...fixedRecord,
        anthropicApiKey: "stale-fixed-key",
      }),
    );
    const reloadedConfiguration = makeCachedConfiguration(durableValues);
    const reloaded = renderHook(() =>
      useAgentSettings(reloadedConfiguration, { desktop: true }),
    );
    await waitFor(() => {
      expect(reloaded.result.current.migrationReady).toBe(true);
    });
    expect(reloaded.result.current.snapshot).toMatchObject({
      activeProfileId: "profile-2",
      anthropic: { apiKey: "second-profile-secret", model: "second-model" },
    });

    const deleteDraft = createAgentSettingsDraft(
      reloaded.result.current.snapshot,
    );
    deleteDraft.profiles = deleteDraft.profiles?.filter(
      ({ id }) => id !== "default",
    );
    await act(async () => {
      await commitAgentSettings(reloadedConfiguration, deleteDraft, {
        desktop: true,
      });
    });
    expect(
      secureCredentials.get("agent.profile.default.llmApiKey"),
    ).toBeUndefined();
    expect(secureCredentials.get("agent.llmApiKey")).toBeDefined();
  });

  it("adopts another Desktop window's atomic migration winner", async () => {
    const configuration = makeMockAppConfiguration([
      [AppSetting.AGENT_LLM_PROVIDER, "anthropic"],
      ["agent.llmApiKey", "losing-legacy-key"],
    ]);
    const winningRevision = "winning-migration-revision";
    const winningMirror = {
      anthropicBaseUrl: "",
      anthropicModel: "winning-migrated-model",
      openAiBaseUrl: "",
      openAiModel: "",
      provider: "anthropic",
    };
    desktopBridge.setManySecureCredentials.mockImplementationOnce(async () => {
      secureCredentials.set(
        "agent.llmApiKey",
        serializeTestValue({
          anthropicApiKey: "winning-migrated-key",
          configuration: winningMirror,
          openAiApiKey: "",
          revision: winningRevision,
        }),
      );
      return { code: "revision-conflict", ok: false };
    });

    const { result } = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );

    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });
    expect(result.current.migrationError).toBeUndefined();
    expect(result.current.snapshot).toMatchObject({
      anthropic: {
        apiKey: "winning-migrated-key",
        model: "winning-migrated-model",
      },
      revision: expect.stringMatching(/^\d+-/),
    });
    const migrationEntries =
      desktopBridge.setManySecureCredentials.mock.calls[0]?.[0];
    expect(migrationEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedRevision: "",
          key: "agent.llmApiKey",
        }),
      ]),
    );
    expect(configuration.get("agent.llmApiKey")).toBeUndefined();
  });

  it("rejects a stale complete draft and reloads the winning revision", async () => {
    const [firstConfiguration, secondConfiguration] =
      makeSharedConfigurations();
    await commitAgentSettings(firstConfiguration, completeDraft);
    const first = renderHook(() => useAgentSettings(firstConfiguration));
    const second = renderHook(() => useAgentSettings(secondConfiguration));
    await waitFor(() => {
      expect(first.result.current.migrationReady).toBe(true);
      expect(second.result.current.migrationReady).toBe(true);
    });
    const staleDraft = createAgentSettingsDraft(second.result.current.snapshot);
    const winningDraft = createAgentSettingsDraft(
      first.result.current.snapshot,
    );
    winningDraft.anthropic.apiKey = "winning-key";

    await act(async () => {
      await commitAgentSettings(firstConfiguration, winningDraft);
    });
    let conflict: unknown;
    await act(async () => {
      try {
        await commitAgentSettings(secondConfiguration, {
          ...staleDraft,
          openAiCompatible: {
            ...staleDraft.openAiCompatible,
            model: "https://stale.example.com/v1",
          },
        });
      } catch (error) {
        conflict = error;
      }
    });
    expect(conflict).toBeInstanceOf(AgentSettingsConflictError);

    await waitFor(() => {
      expect(second.result.current.snapshot.anthropic.apiKey).toBe(
        "winning-key",
      );
    });
    expect(second.result.current.snapshot.openAiCompatible.model).toBe(
      completeDraft.openAiCompatible.model,
    );
  });

  it("serializes concurrent commits from different stores before rechecking revisions", async () => {
    const [firstConfiguration, secondConfiguration] =
      makeSharedConfigurations();
    await commitAgentSettings(firstConfiguration, completeDraft);
    const revision = firstConfiguration.get("agent.configurationRevision");
    expect(typeof revision).toBe("string");
    const firstDraft: AgentSettingsDraft = {
      ...completeDraft,
      anthropic: {
        ...completeDraft.anthropic,
        apiKey: "first-winner-key",
      },
      revision: revision as string,
    };
    const secondDraft: AgentSettingsDraft = {
      ...completeDraft,
      openAiCompatible: {
        ...completeDraft.openAiCompatible,
        model: "second-lost-update",
      },
      revision: revision as string,
    };
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteReleased = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let firstWriteStarted: (() => void) | undefined;
    const firstWritePending = new Promise<void>((resolve) => {
      firstWriteStarted = resolve;
    });
    const originalFirstSet = firstConfiguration.set.bind(firstConfiguration);
    let shouldPause = true;
    jest
      .spyOn(firstConfiguration, "set")
      .mockImplementation(async (key, value) => {
        if (shouldPause && key === AppSetting.AGENT_LLM_PROVIDER) {
          shouldPause = false;
          firstWriteStarted?.();
          await firstWriteReleased;
        }
        await originalFirstSet(key, value);
      });

    const firstCommit = commitAgentSettings(firstConfiguration, firstDraft);
    await firstWritePending;
    const secondCommit = commitAgentSettings(secondConfiguration, secondDraft);
    releaseFirstWrite?.();

    await expect(firstCommit).resolves.toBeUndefined();
    await expect(secondCommit).rejects.toBeInstanceOf(
      AgentSettingsConflictError,
    );
    expect(
      JSON.parse(localStorage.getItem("lichtblick.agent.credentials.v1") ?? ""),
    ).toMatchObject({
      anthropicApiKey: "first-winner-key",
      configuration: {
        openAiModel: completeDraft.openAiCompatible.model,
      },
    });
    expect(secondConfiguration.get(AppSetting.AGENT_OPENAI_MODEL)).toBe(
      completeDraft.openAiCompatible.model,
    );
  });

  it("rechecks the winner after acquiring the cross-renderer commit lock", async () => {
    const [firstConfiguration, winningConfiguration] =
      makeSharedConfigurations();
    await commitAgentSettings(firstConfiguration, completeDraft);
    const staleRevision = firstConfiguration.get("agent.configurationRevision");
    expect(typeof staleRevision).toBe("string");
    const staleDraft: AgentSettingsDraft = {
      ...completeDraft,
      anthropic: {
        ...completeDraft.anthropic,
        apiKey: "stale-renderer-key",
      },
      revision: staleRevision as string,
    };
    const winningRevision = "cross-renderer-winning-revision";
    const winningConfigurationMirror = {
      anthropicBaseUrl: completeDraft.anthropic.baseUrl,
      anthropicModel: "cross-renderer-winning-model",
      openAiBaseUrl: completeDraft.openAiCompatible.baseUrl,
      openAiModel: completeDraft.openAiCompatible.model,
      provider: completeDraft.provider,
    };
    const request = jest.fn(
      async (
        _name: string,
        callback: () => Promise<unknown>,
      ): Promise<unknown> => {
        await Promise.all([
          winningConfiguration.set(
            AppSetting.AGENT_LLM_PROVIDER,
            winningConfigurationMirror.provider,
          ),
          winningConfiguration.set(
            AppSetting.AGENT_ANTHROPIC_BASE_URL,
            winningConfigurationMirror.anthropicBaseUrl,
          ),
          winningConfiguration.set(
            AppSetting.AGENT_ANTHROPIC_MODEL,
            winningConfigurationMirror.anthropicModel,
          ),
          winningConfiguration.set(
            AppSetting.AGENT_OPENAI_BASE_URL,
            winningConfigurationMirror.openAiBaseUrl,
          ),
          winningConfiguration.set(
            AppSetting.AGENT_OPENAI_MODEL,
            winningConfigurationMirror.openAiModel,
          ),
        ]);
        localStorage.setItem(
          "lichtblick.agent.credentials.v1",
          serializeTestValue({
            anthropicApiKey: "cross-renderer-winning-key",
            configuration: winningConfigurationMirror,
            openAiApiKey: completeDraft.openAiCompatible.apiKey,
            revision: winningRevision,
          }),
        );
        await winningConfiguration.set(
          "agent.configurationRevision",
          winningRevision,
        );
        return await callback();
      },
    );
    Object.defineProperty(globalThis.navigator, "locks", {
      configurable: true,
      value: { request },
    });

    await expect(
      commitAgentSettings(firstConfiguration, staleDraft),
    ).rejects.toBeInstanceOf(AgentSettingsConflictError);

    expect(request).toHaveBeenCalledWith(
      "lichtblick.agent-settings.commit",
      expect.any(Function),
    );
    expect(firstConfiguration.get(AppSetting.AGENT_ANTHROPIC_MODEL)).toBe(
      "cross-renderer-winning-model",
    );
    expect(
      JSON.parse(localStorage.getItem("lichtblick.agent.credentials.v1") ?? ""),
    ).toMatchObject({
      anthropicApiKey: "cross-renderer-winning-key",
      revision: winningRevision,
    });
  });

  it("recovers a desktop cached configuration after one revision conflict", async () => {
    const durableValues = new Map<string, AppConfigurationValue>();
    const firstConfiguration = makeCachedConfiguration(durableValues);
    await commitAgentSettings(firstConfiguration, completeDraft, {
      desktop: true,
    });
    const secondConfiguration = makeCachedConfiguration(durableValues);
    const first = renderHook(() =>
      useAgentSettings(firstConfiguration, { desktop: true }),
    );
    const second = renderHook(() =>
      useAgentSettings(secondConfiguration, { desktop: true }),
    );
    await waitFor(() => {
      expect(first.result.current.migrationReady).toBe(true);
      expect(second.result.current.migrationReady).toBe(true);
    });
    const staleDraft = createAgentSettingsDraft(second.result.current.snapshot);
    const winningDraft = createAgentSettingsDraft(
      first.result.current.snapshot,
    );
    winningDraft.openAiCompatible = {
      ...winningDraft.openAiCompatible,
      baseUrl: "https://winner.example.com/v1",
      model: "winner-model",
    };

    await act(async () => {
      await commitAgentSettings(firstConfiguration, winningDraft, {
        desktop: true,
      });
    });
    let conflict: unknown;
    await act(async () => {
      try {
        await commitAgentSettings(
          secondConfiguration,
          { ...staleDraft, provider: "openai-compatible" },
          { desktop: true },
        );
      } catch (error) {
        conflict = error;
      }
    });
    expect(conflict).toBeInstanceOf(AgentSettingsConflictError);
    await waitFor(() => {
      expect(second.result.current.snapshot.openAiCompatible).toMatchObject({
        baseUrl: "https://winner.example.com/v1",
        model: "winner-model",
      });
    });

    const retry = createAgentSettingsDraft(second.result.current.snapshot);
    retry.openAiCompatible.model = "retry-model";
    await act(async () => {
      await expect(
        commitAgentSettings(secondConfiguration, retry, { desktop: true }),
      ).resolves.toBeUndefined();
    });
    expect(second.result.current.snapshot.openAiCompatible.model).toBe(
      "retry-model",
    );
  });

  it("uses one desktop credential CAS and reloads the winning renderer on conflict", async () => {
    const durableValues = new Map<string, AppConfigurationValue>();
    const writerConfiguration = makeCachedConfiguration(durableValues);
    await commitAgentSettings(writerConfiguration, completeDraft, {
      desktop: true,
    });
    const staleConfiguration = makeCachedConfiguration(durableValues);
    const winnerConfiguration = makeCachedConfiguration(durableValues);
    const stale = renderHook(() =>
      useAgentSettings(staleConfiguration, { desktop: true }),
    );
    await waitFor(() => {
      expect(stale.result.current.migrationReady).toBe(true);
    });
    const staleDraft = createAgentSettingsDraft(stale.result.current.snapshot);
    staleDraft.anthropic.model = "losing-renderer-model";
    const expectedRevision = staleDraft.revision;
    const winningRevision = "desktop-winning-revision";
    const winningMirror = {
      activeProfileId: "default",
      anthropicBaseUrl: completeDraft.anthropic.baseUrl,
      anthropicModel: "desktop-winning-model",
      openAiBaseUrl: completeDraft.openAiCompatible.baseUrl,
      openAiModel: completeDraft.openAiCompatible.model,
      profiles: [
        {
          anthropic: {
            baseUrl: completeDraft.anthropic.baseUrl,
            model: "desktop-winning-model",
          },
          id: "default",
          name: "Default",
          openAiCompatible: {
            baseUrl: completeDraft.openAiCompatible.baseUrl,
            model: completeDraft.openAiCompatible.model,
          },
          provider: completeDraft.provider,
        },
      ],
      provider: completeDraft.provider,
    };
    desktopBridge.setManySecureCredentials.mockImplementationOnce(async () => {
      secureCredentials.set(
        "agent.llmApiKey",
        serializeTestValue({
          anthropicApiKey: "desktop-winning-key",
          configuration: winningMirror,
          openAiApiKey: completeDraft.openAiCompatible.apiKey,
          revision: winningRevision,
        }),
      );
      secureCredentials.set(
        "agent.profile.default.llmApiKey",
        serializeTestValue({
          anthropicApiKey: "desktop-winning-key",
          openAiApiKey: completeDraft.openAiCompatible.apiKey,
          revision: winningRevision,
        }),
      );
      await Promise.all([
        winnerConfiguration.set(
          AppSetting.AGENT_LLM_PROVIDER,
          winningMirror.provider,
        ),
        winnerConfiguration.set(
          AppSetting.AGENT_ANTHROPIC_BASE_URL,
          winningMirror.anthropicBaseUrl,
        ),
        winnerConfiguration.set(
          AppSetting.AGENT_ANTHROPIC_MODEL,
          winningMirror.anthropicModel,
        ),
        winnerConfiguration.set(
          AppSetting.AGENT_OPENAI_BASE_URL,
          winningMirror.openAiBaseUrl,
        ),
        winnerConfiguration.set(
          AppSetting.AGENT_OPENAI_MODEL,
          winningMirror.openAiModel,
        ),
        winnerConfiguration.set("agent.configurationRevision", winningRevision),
      ]);
      return { code: "revision-conflict", ok: false };
    });

    await act(async () => {
      await expect(
        commitAgentSettings(staleConfiguration, staleDraft, {
          desktop: true,
        }),
      ).rejects.toBeInstanceOf(AgentSettingsConflictError);
    });

    const entries =
      desktopBridge.setManySecureCredentials.mock.calls.at(-1)?.[0];
    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedRevision,
          key: "agent.llmApiKey",
        }),
        expect.objectContaining({ key: "agent.profile.default.llmApiKey" }),
      ]),
    );
    await waitFor(() => {
      expect(stale.result.current.snapshot.anthropic).toMatchObject({
        apiKey: "desktop-winning-key",
        model: "desktop-winning-model",
      });
    });
    expect(staleConfiguration.get("agent.configurationRevision")).toBe(
      winningRevision,
    );
    expect(
      getStringFromSerializedRecord(
        secureCredentials.get("agent.llmApiKey") ?? "",
        "revision",
      ),
    ).toBe(winningRevision);
  });

  it("commits credentials before non-sensitive settings and atomically rolls them back on failure", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, completeDraft, {
      desktop: true,
    });
    const previousRevision = configuration.get("agent.configurationRevision");
    expect(typeof previousRevision).toBe("string");
    const previousLlmRecord = secureCredentials.get("agent.llmApiKey");
    const draft: AgentSettingsDraft = {
      ...completeDraft,
      anthropic: {
        ...completeDraft.anthropic,
        model: "must-roll-back",
      },
      revision: previousRevision as string,
    };
    const operationOrder: string[] = [];
    const persistCredentials =
      desktopBridge.setManySecureCredentials.getMockImplementation();
    if (persistCredentials == undefined) {
      throw new Error("Missing credential persistence test implementation");
    }
    desktopBridge.setManySecureCredentials.mockImplementation(
      async (entries) => {
        operationOrder.push("credentials");
        return await persistCredentials(entries);
      },
    );
    desktopBridge.setManySecureCredentials.mockClear();
    const originalSet = configuration.set.bind(configuration);
    let rejectModelWrite = true;
    jest.spyOn(configuration, "set").mockImplementation(async (key, value) => {
      operationOrder.push(`configuration:${key}`);
      if (rejectModelWrite && key === AppSetting.AGENT_ANTHROPIC_MODEL) {
        rejectModelWrite = false;
        throw new Error("settings write failed");
      }
      await originalSet(key, value);
    });

    await expect(
      commitAgentSettings(configuration, draft, { desktop: true }),
    ).rejects.toThrow("settings write failed");

    expect(operationOrder[0]).toBe("credentials");
    const rollbackCredentialIndex = operationOrder.lastIndexOf("credentials");
    const firstRollbackConfigurationIndex = operationOrder.findIndex(
      (operation, index) =>
        index > rollbackCredentialIndex &&
        operation.startsWith("configuration:"),
    );
    expect(rollbackCredentialIndex).toBeGreaterThan(0);
    expect(firstRollbackConfigurationIndex).toBeGreaterThan(
      rollbackCredentialIndex,
    );
    expect(desktopBridge.setManySecureCredentials).toHaveBeenCalledTimes(2);
    const forwardEntries =
      desktopBridge.setManySecureCredentials.mock.calls[0]?.[0];
    const rollbackEntries =
      desktopBridge.setManySecureCredentials.mock.calls[1]?.[0];
    expect(forwardEntries).toHaveLength(2);
    expect(rollbackEntries).toHaveLength(2);
    const committedRevision = getStringFromSerializedRecord(
      forwardEntries?.find((entry) => entry.key === "agent.llmApiKey")?.value ??
        "",
      "revision",
    );
    expect(committedRevision).not.toBe(previousRevision);
    expect(rollbackEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          expectedRevision: committedRevision,
          key: "agent.llmApiKey",
          value: previousLlmRecord,
        }),
      ]),
    );
    expect(secureCredentials.get("agent.llmApiKey")).toBe(previousLlmRecord);
    expect(configuration.get(AppSetting.AGENT_ANTHROPIC_MODEL)).toBe(
      completeDraft.anthropic.model,
    );
    expect(configuration.get("agent.configurationRevision")).toBe(
      previousRevision,
    );
  });

  it("keeps the credential mirror authoritative when configuration rollback fails midway", async () => {
    const durableValues = new Map<string, AppConfigurationValue>();
    const configuration = makeCachedConfiguration(durableValues);
    await commitAgentSettings(configuration, completeDraft, { desktop: true });
    const previousRevision = configuration.get("agent.configurationRevision");
    expect(typeof previousRevision).toBe("string");

    const draft: AgentSettingsDraft = {
      ...completeDraft,
      anthropic: {
        ...completeDraft.anthropic,
        model: "forward-model",
      },
      provider: "openai-compatible",
      revision: previousRevision as string,
    };
    const persistCredentials =
      desktopBridge.setManySecureCredentials.getMockImplementation();
    if (persistCredentials == undefined) {
      throw new Error("Missing credential persistence test implementation");
    }
    let credentialWriteCount = 0;
    let rollbackCredentialCompleted = false;
    desktopBridge.setManySecureCredentials.mockImplementation(
      async (entries) => {
        credentialWriteCount++;
        const result = await persistCredentials(entries);
        if (credentialWriteCount === 2) {
          rollbackCredentialCompleted = true;
        }
        return result;
      },
    );
    const originalSet = configuration.set.bind(configuration);
    let rejectForwardModel = true;
    jest.spyOn(configuration, "set").mockImplementation(async (key, value) => {
      if (
        rejectForwardModel &&
        key === AppSetting.AGENT_ANTHROPIC_MODEL &&
        value === "forward-model"
      ) {
        rejectForwardModel = false;
        throw new Error("forward configuration failed");
      }
      if (
        rollbackCredentialCompleted &&
        key === AppSetting.AGENT_LLM_PROVIDER &&
        value === completeDraft.provider
      ) {
        throw new Error("rollback configuration failed");
      }
      await originalSet(key, value);
    });

    await expect(
      commitAgentSettings(configuration, draft, { desktop: true }),
    ).rejects.toThrow(
      "Failed to save Agent settings and restore the previous snapshot",
    );

    expect(credentialWriteCount).toBe(2);
    expect(configuration.get(AppSetting.AGENT_LLM_PROVIDER)).toBe(
      "openai-compatible",
    );
    const reloadedConfiguration = makeCachedConfiguration(durableValues);
    const reloaded = renderHook(() =>
      useAgentSettings(reloadedConfiguration, { desktop: true }),
    );
    await waitFor(() => {
      expect(reloaded.result.current.migrationReady).toBe(true);
      expect(reloaded.result.current.snapshot).toMatchObject({
        anthropic: completeDraft.anthropic,
        openAiCompatible: completeDraft.openAiCompatible,
        provider: completeDraft.provider,
        revision: previousRevision,
      });
    });
  });

  it("rejects a non-sensitive configuration drift before the credential CAS", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, completeDraft, {
      desktop: true,
    });
    const revision = configuration.get("agent.configurationRevision");
    expect(typeof revision).toBe("string");
    const draft: AgentSettingsDraft = {
      ...completeDraft,
      revision: revision as string,
    };
    await configuration.set(
      AppSetting.AGENT_ANTHROPIC_MODEL,
      "out-of-band-model",
    );
    desktopBridge.setManySecureCredentials.mockClear();

    await expect(
      commitAgentSettings(configuration, draft, { desktop: true }),
    ).rejects.toBeInstanceOf(AgentSettingsConflictError);

    expect(desktopBridge.setManySecureCredentials).not.toHaveBeenCalled();
    expect(configuration.get(AppSetting.AGENT_ANTHROPIC_MODEL)).toBe(
      completeDraft.anthropic.model,
    );
  });

  it("refuses desktop plaintext credential writes without a cross-window lock", async () => {
    Reflect.deleteProperty(globalThis.navigator, "locks");
    desktopBridge.setManySecureCredentials.mockResolvedValue({
      code: "insecure-backend",
      ok: false,
    });
    const configuration = makeMockAppConfiguration();

    await expect(
      commitAgentSettings(configuration, completeDraft, { desktop: true }),
    ).rejects.toBeInstanceOf(AgentPlaintextCredentialLockUnavailableError);

    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toBeNull();
    expect(configuration.get(AppSetting.AGENT_LLM_PROVIDER)).toBeUndefined();
    expect(configuration.get("agent.configurationRevision")).toBeUndefined();
    expect(desktopBridge.deleteSecureCredential).not.toHaveBeenCalled();
  });

  it("falls back to revisioned plaintext storage when desktop reports insecure-backend", async () => {
    desktopBridge.setManySecureCredentials.mockResolvedValue({
      code: "insecure-backend",
      ok: false,
    });
    const durableValues = new Map<string, AppConfigurationValue>();
    const configuration = makeCachedConfiguration(durableValues);
    const { result } = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );
    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });

    const draft = createAgentSettingsDraft(result.current.snapshot);
    draft.anthropic.apiKey = "plaintext-secret";
    await act(async () => {
      await commitAgentSettings(configuration, draft, { desktop: true });
    });

    expect(desktopBridge.setManySecureCredentials).toHaveBeenCalled();
    expect(desktopBridge.deleteSecureCredential).not.toHaveBeenCalled();
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toContain(
      "plaintext-secret",
    );
    expect(result.current.snapshot.credentialStorage).toBe("plaintext");
    expect(result.current.snapshot.storageError).toBe(false);

    const retry = createAgentSettingsDraft(result.current.snapshot);
    retry.anthropic.model = "plaintext-retry-model";
    await act(async () => {
      await expect(
        commitAgentSettings(configuration, retry, { desktop: true }),
      ).resolves.toBeUndefined();
    });
    expect(result.current.snapshot.anthropic.model).toBe(
      "plaintext-retry-model",
    );

    const reloadedConfiguration = makeCachedConfiguration(durableValues);
    const reloaded = renderHook(() =>
      useAgentSettings(reloadedConfiguration, { desktop: true }),
    );
    await waitFor(() => {
      expect(reloaded.result.current.migrationReady).toBe(true);
      expect(reloaded.result.current.snapshot.credentialStorage).toBe(
        "plaintext",
      );
      expect(reloaded.result.current.snapshot.anthropic.apiKey).toBe(
        "plaintext-secret",
      );
    });
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toContain(
      "plaintext-secret",
    );
  });

  it("preserves secure credentials while the desktop backend is temporarily unavailable", async () => {
    const durableValues = new Map<string, AppConfigurationValue>();
    const writerConfiguration = makeCachedConfiguration(durableValues);
    await commitAgentSettings(writerConfiguration, completeDraft, {
      desktop: true,
    });
    const llmRecordBefore = secureCredentials.get("agent.llmApiKey");
    expect(llmRecordBefore).toContain("anthropic-secret");

    const readerConfiguration = makeCachedConfiguration(durableValues);
    desktopBridge.getSecureCredential.mockResolvedValue({
      code: "backend-unavailable",
      ok: false,
    });
    const unavailable = renderHook(() =>
      useAgentSettings(readerConfiguration, { desktop: true }),
    );

    await waitFor(() => {
      expect(unavailable.result.current.migrationError).toBeInstanceOf(
        AgentCredentialsBackendUnavailableError,
      );
    });
    expect(unavailable.result.current.migrationReady).toBe(false);
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toBeNull();
    expect(desktopBridge.deleteSecureCredential).not.toHaveBeenCalled();
    expect(secureCredentials.get("agent.llmApiKey")).toBe(llmRecordBefore);

    unavailable.unmount();
    desktopBridge.getSecureCredential.mockImplementation(async (name) =>
      secureCredentials.get(name),
    );
    const recovered = renderHook(() =>
      useAgentSettings(readerConfiguration, { desktop: true }),
    );
    await waitFor(() => {
      expect(recovered.result.current.migrationReady).toBe(true);
    });
    expect(recovered.result.current.migrationError).toBeUndefined();
    expect(recovered.result.current.snapshot.anthropic.apiKey).toBe(
      "anthropic-secret",
    );
    expect(desktopBridge.deleteSecureCredential).not.toHaveBeenCalled();
  });

  it("does not downgrade or delete secure records when the backend becomes unavailable during save", async () => {
    const durableValues = new Map<string, AppConfigurationValue>();
    const configuration = makeCachedConfiguration(durableValues);
    await commitAgentSettings(configuration, completeDraft, { desktop: true });
    const llmRecordBefore = secureCredentials.get("agent.llmApiKey");
    const { result } = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );
    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });
    const draft = createAgentSettingsDraft(result.current.snapshot);
    draft.anthropic.model = "must-not-commit";
    desktopBridge.setManySecureCredentials.mockResolvedValue({
      code: "backend-unavailable",
      ok: false,
    });

    await act(async () => {
      await expect(
        commitAgentSettings(configuration, draft, { desktop: true }),
      ).rejects.toBeInstanceOf(AgentCredentialsBackendUnavailableError);
    });

    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toBeNull();
    expect(desktopBridge.deleteSecureCredential).not.toHaveBeenCalled();
    expect(secureCredentials.get("agent.llmApiKey")).toBe(llmRecordBefore);
    expect(result.current.credentialBackendUnavailable).toBe(true);
    expect(result.current.snapshot.anthropic).toMatchObject({
      apiKey: completeDraft.anthropic.apiKey,
      model: completeDraft.anthropic.model,
    });

    desktopBridge.setManySecureCredentials.mockImplementation(
      async (entries) => {
        for (const entry of entries) {
          secureCredentials.set(entry.key, entry.value);
        }
        return { ok: true };
      },
    );
    await act(async () => {
      await commitAgentSettings(configuration, draft, { desktop: true });
    });
    expect(result.current.credentialBackendUnavailable).toBe(false);
    expect(result.current.snapshot.anthropic.model).toBe("must-not-commit");
  });

  it("preserves the loaded snapshot when a runtime refresh cannot access the backend", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, completeDraft, { desktop: true });
    const { result } = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );
    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
      expect(result.current.snapshot.anthropic.apiKey).toBe(
        completeDraft.anthropic.apiKey,
      );
    });

    desktopBridge.getSecureCredential.mockResolvedValue({
      code: "backend-unavailable",
      ok: false,
    });
    await act(async () => {
      await configuration.set(
        AppSetting.AGENT_ANTHROPIC_MODEL,
        "external-model-while-locked",
      );
    });
    await waitFor(() => {
      expect(result.current.credentialBackendUnavailable).toBe(true);
    });
    expect(result.current.migrationReady).toBe(true);
    expect(result.current.migrationError).toBeUndefined();
    expect(result.current.snapshot.anthropic).toMatchObject({
      apiKey: completeDraft.anthropic.apiKey,
      model: completeDraft.anthropic.model,
    });
    expect(result.current.snapshot.storageError).toBe(false);

    desktopBridge.getSecureCredential.mockImplementation(async (name) =>
      secureCredentials.get(name),
    );
    await act(async () => {
      await configuration.set(
        AppSetting.AGENT_ANTHROPIC_MODEL,
        "external-model-after-unlock",
      );
    });
    await waitFor(() => {
      expect(result.current.credentialBackendUnavailable).toBe(false);
    });
    expect(result.current.snapshot.anthropic).toMatchObject({
      apiKey: completeDraft.anthropic.apiKey,
      model: completeDraft.anthropic.model,
    });
  });

  it("marks legacy basic_text reads for a plaintext fallback re-save", async () => {
    const revision = "legacy-basic-text-revision";
    const configurationMirror = {
      anthropicBaseUrl: "",
      anthropicModel: "legacy-model",
      openAiBaseUrl: "https://openai.example.com/v1",
      openAiModel: "openai-model",
      provider: "anthropic",
    };
    const configuration = makeMockAppConfiguration([
      [AppSetting.AGENT_LLM_PROVIDER, configurationMirror.provider],
      [
        AppSetting.AGENT_ANTHROPIC_BASE_URL,
        configurationMirror.anthropicBaseUrl,
      ],
      [AppSetting.AGENT_ANTHROPIC_MODEL, configurationMirror.anthropicModel],
      [AppSetting.AGENT_OPENAI_BASE_URL, configurationMirror.openAiBaseUrl],
      [AppSetting.AGENT_OPENAI_MODEL, configurationMirror.openAiModel],
      ["agent.configurationRevision", revision],
    ]);
    const legacyValues = new Map([
      [
        "agent.llmApiKey",
        JSON.stringify({
          anthropicApiKey: "legacy-basic-text-key",
          configuration: configurationMirror,
          openAiApiKey: "legacy-openai-key",
          revision,
        }),
      ],
    ]);
    desktopBridge.getSecureCredential.mockImplementation(async (name) => ({
      code: "insecure-backend",
      ok: true,
      value: legacyValues.get(name),
    }));
    const { result } = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );

    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });
    expect(result.current.snapshot).toMatchObject({
      anthropic: { apiKey: "legacy-basic-text-key" },
      credentialResaveRequired: true,
      credentialStorage: "plaintext",
    });
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toContain(
      "legacy-basic-text-key",
    );

    const draft = createAgentSettingsDraft(result.current.snapshot);
    await act(async () => {
      await commitAgentSettings(configuration, draft, { desktop: true });
    });

    expect(result.current.snapshot.credentialResaveRequired).toBe(false);
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toContain(
      "legacy-basic-text-key",
    );
    expect(desktopBridge.setManySecureCredentials).not.toHaveBeenCalled();
    expect(desktopBridge.deleteSecureCredential).toHaveBeenCalledWith(
      "agent.llmApiKey",
    );
  });

  it("prefers a completed plaintext fallback over stale insecure desktop records", async () => {
    const revision = "plaintext-winner";
    const configurationMirror = {
      anthropicBaseUrl: "",
      anthropicModel: "new-model",
      openAiBaseUrl: "",
      openAiModel: "",
      provider: "anthropic" as const,
    };
    const configuration = makeMockAppConfiguration([
      [AppSetting.AGENT_LLM_PROVIDER, configurationMirror.provider],
      [
        AppSetting.AGENT_ANTHROPIC_BASE_URL,
        configurationMirror.anthropicBaseUrl,
      ],
      [AppSetting.AGENT_ANTHROPIC_MODEL, configurationMirror.anthropicModel],
      [AppSetting.AGENT_OPENAI_BASE_URL, configurationMirror.openAiBaseUrl],
      [AppSetting.AGENT_OPENAI_MODEL, configurationMirror.openAiModel],
      ["agent.configurationRevision", revision],
    ]);
    localStorage.setItem(
      "lichtblick.agent.credentials.v1",
      serializeTestValue({
        anthropicApiKey: "new-plaintext-key",
        configuration: configurationMirror,
        openAiApiKey: "",
        revision,
      }),
    );
    desktopBridge.getSecureCredential.mockImplementation(async (name) => ({
      code: "insecure-backend",
      ok: true,
      value:
        name === "agent.llmApiKey"
          ? JSON.stringify({
              anthropicApiKey: "stale-basic-text-key",
              configuration: {
                ...configurationMirror,
                anthropicModel: "stale-model",
              },
              openAiApiKey: "",
              revision: "stale-revision",
            })
          : undefined,
    }));

    const { result } = renderHook(() =>
      useAgentSettings(configuration, { desktop: true }),
    );

    await waitFor(() => {
      expect(result.current.migrationReady).toBe(true);
    });
    expect(result.current.snapshot.anthropic).toMatchObject({
      apiKey: "new-plaintext-key",
      model: "new-model",
    });
    expect(result.current.snapshot.credentialStorage).toBe("plaintext");
    expect(
      JSON.parse(localStorage.getItem("lichtblick.agent.credentials.v1") ?? ""),
    ).toMatchObject({
      profileKeys: {
        default: { anthropicApiKey: "new-plaintext-key" },
      },
    });
    expect(desktopBridge.deleteSecureCredential).toHaveBeenCalledWith(
      "agent.llmApiKey",
    );
  });
});
