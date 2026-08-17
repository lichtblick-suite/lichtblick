/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import AppConfigurationContext, {
  AppConfigurationValue,
  IAppConfiguration,
} from "@lichtblick/suite-base/context/AppConfigurationContext";
import {
  AgentSettingsDraft,
  commitAgentSettings,
} from "@lichtblick/suite-base/services/agent/agentSettings";
import * as agentSettingsModule from "@lichtblick/suite-base/services/agent/agentSettings";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";

import { AgentSettings, AgentSettingsCommitHandler } from "./AgentSettings";

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
const originalBridgeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "desktopBridge");
const originalLocksDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, "locks");

function installTestCrossRendererLock(): void {
  Object.defineProperty(globalThis.navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, callback: () => Promise<unknown>): Promise<unknown> =>
        await callback(),
    },
  });
}

function installDesktopCredentialBridge(): TestDesktopBridge {
  const credentials = new Map<string, string>();
  const bridge: TestDesktopBridge = {
    deleteSecureCredential: jest.fn(async (name) => {
      credentials.delete(name);
    }),
    getSecureCredential: jest.fn(async (name) => credentials.get(name)),
    setManySecureCredentials: jest.fn(async (entries) => {
      for (const entry of entries) {
        const storedValue = credentials.get(entry.key);
        let storedRevision = "";
        try {
          const record =
            storedValue == undefined
              ? undefined
              : (JSON.parse(storedValue) as Record<string, unknown>);
          storedRevision = typeof record?.revision === "string" ? record.revision : "";
        } catch {
          storedRevision = "";
        }
        if (entry.expectedRevision != undefined && entry.expectedRevision !== storedRevision) {
          return { code: "revision-conflict", ok: false };
        }
      }
      for (const entry of entries) {
        credentials.set(entry.key, entry.value);
      }
      return { ok: true };
    }),
  };
  Object.defineProperty(globalThis, "desktopBridge", {
    configurable: true,
    value: bridge,
    writable: true,
  });
  return bridge;
}

function makeSharedConfigurations(): [IAppConfiguration, IAppConfiguration] {
  const values = new Map<string, AppConfigurationValue>();
  const makeConfiguration = (): IAppConfiguration => {
    const listeners = new Map<string, Set<(newValue: AppConfigurationValue) => void>>();
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
  const listeners = new Map<string, Set<(newValue: AppConfigurationValue) => void>>();
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

const baseDraft: AgentSettingsDraft = {
  anthropic: { apiKey: "", baseUrl: "", model: "claude-test" },
  openAiCompatible: {
    apiKey: "secret-key",
    baseUrl: "https://llm.example.com/v1",
    model: "local-model",
  },
  provider: "openai-compatible",
  revision: "",
};

function multiProfileDraft(): AgentSettingsDraft {
  const anthropic = {
    apiKey: "alpha-key",
    baseUrl: "https://alpha.example.com",
    model: "alpha-model",
  };
  const openAiCompatible = {
    apiKey: "alpha-openai-key",
    baseUrl: "https://alpha-openai.example.com/v1",
    model: "alpha-openai-model",
  };
  return {
    ...baseDraft,
    activeProfileId: "profile-alpha",
    anthropic,
    openAiCompatible,
    profiles: [
      {
        anthropic,
        id: "profile-alpha",
        name: "Alpha",
        openAiCompatible,
        provider: "anthropic",
      },
      {
        anthropic: {
          apiKey: "beta-anthropic-key",
          baseUrl: "https://beta-anthropic.example.com",
          model: "beta-anthropic-model",
        },
        id: "profile-beta",
        name: "Beta",
        openAiCompatible: {
          apiKey: "beta-key",
          baseUrl: "https://beta.example.com/v1",
          model: "beta-model",
        },
        provider: "openai-compatible",
      },
    ],
    provider: "anthropic",
  };
}

function renderSettings(
  configuration: IAppConfiguration,
  {
    isDesktop = false,
    onCommitHandlerChange,
  }: {
    isDesktop?: boolean;
    onCommitHandlerChange?: (handler: AgentSettingsCommitHandler | undefined) => void;
  } = {},
) {
  return render(
    <AppConfigurationContext.Provider value={configuration}>
      <AgentSettings isDesktop={isDesktop} onCommitHandlerChange={onCommitHandlerChange} />
    </AppConfigurationContext.Provider>,
  );
}

describe("AgentSettings", () => {
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
      Object.defineProperty(globalThis.navigator, "locks", originalLocksDescriptor);
    }
    if (originalBridgeDescriptor == undefined) {
      delete testGlobal.desktopBridge;
    } else {
      Object.defineProperty(globalThis, "desktopBridge", originalBridgeDescriptor);
    }
  });

  it("does not export raw credential keys or storage readers", () => {
    expect(Object.values(AppSetting)).not.toContain("agent.llmApiKey");
    expect(agentSettingsModule).not.toHaveProperty("getAgentApiKeyStorageKey");
    expect(agentSettingsModule).not.toHaveProperty("readAgentApiKey");
    expect(agentSettingsModule).not.toHaveProperty("writeAgentApiKey");
  });

  it("publishes the enable toggle immediately without waiting for a draft save", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    renderSettings(configuration);

    const toggle = screen.getByRole("checkbox", { name: "Enable agent" });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(configuration.get(AppSetting.AGENT_ENABLED)).toBe(true);
    });
    expect(screen.getByRole("checkbox", { name: "Enable agent" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Enable agent" }));

    await waitFor(() => {
      expect(configuration.get(AppSetting.AGENT_ENABLED)).toBe(false);
    });
  });

  it("reflects an agent that was already enabled", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    await configuration.set(AppSetting.AGENT_ENABLED, true);
    renderSettings(configuration);

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Enable agent" })).toBeChecked();
    });
  });

  it("previews a skill body as rendered markdown", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    renderSettings(configuration);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Skills" }));
    fireEvent.click(await screen.findByRole("option", { name: /^panel-catalog/ }));

    // Edit view first: the raw markdown source.
    const editor = screen.getByRole("textbox", {
      name: /Panel catalog/,
    });
    expect((editor as HTMLTextAreaElement).value).toContain("# Panel catalog");

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    const preview = screen.getByTestId("agent-skill-preview");
    // The heading and table must come back as real elements, not literal markdown syntax.
    expect(preview.querySelector("h1")).toHaveTextContent("Panel catalog");
    expect(preview.querySelector("table")).toBeInTheDocument();
    expect(preview.textContent).not.toContain("| Panel type |");

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByTestId("agent-skill-preview")).not.toBeInTheDocument();
  });

  it("lists stored memories and deletes them without a draft save", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    await configuration.set(
      AppSetting.AGENT_MEMORY,
      JSON.stringify([
        { id: "m1", text: "Usually reviews SN001", createdAt: "2026-07-28T00:00:00Z" },
        { id: "m2", text: "Prefers 3D beside a plot", createdAt: "2026-07-28T00:00:00Z" },
      ]),
    );
    renderSettings(configuration);

    expect(screen.getByText("Usually reviews SN001")).toBeInTheDocument();
    expect(screen.getByText("Prefers 3D beside a plot")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Forget: Usually reviews SN001" }));

    await waitFor(() => {
      expect(screen.queryByText("Usually reviews SN001")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Prefers 3D beside a plot")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Forget all" }));

    await waitFor(() => {
      expect(screen.getByText("The agent has not stored anything yet.")).toBeInTheDocument();
    });
    expect(configuration.get(AppSetting.AGENT_MEMORY)).toBeUndefined();
  });

  it("keeps a complete draft local and publishes it with one save action", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    const set = jest.spyOn(configuration, "set");
    renderSettings(configuration);

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "next-model" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "next-key" },
    });
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://next.example.com/v1" },
    });

    expect(configuration.get(AppSetting.AGENT_OPENAI_MODEL)).toBe("local-model");
    expect(set).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));

    await waitFor(() => {
      expect(configuration.get(AppSetting.AGENT_OPENAI_MODEL)).toBe("next-model");
      expect(configuration.get(AppSetting.AGENT_OPENAI_BASE_URL)).toBe(
        "https://next.example.com/v1",
      );
    });
    expect(set).toHaveBeenCalledWith(AppSetting.AGENT_LLM_PROVIDER, "openai-compatible");
  });

  it("switches provider drafts without persisting or reusing credentials", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, {
      ...baseDraft,
      anthropic: {
        apiKey: "anthropic-key",
        baseUrl: "https://anthropic.example.com",
        model: "claude-test",
      },
      openAiCompatible: {
        apiKey: "openai-key",
        baseUrl: "https://openai.example.com/v1",
        model: "openai-test",
      },
      provider: "anthropic",
    });
    renderSettings(configuration);

    expect(screen.getByLabelText("API key")).toHaveValue("anthropic-key");
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "edited-anthropic-key" },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "LLM provider" }));
    fireEvent.click(screen.getByRole("option", { name: "OpenAI-compatible" }));

    expect(screen.getByLabelText("Model")).toHaveValue("openai-test");
    expect(screen.getByLabelText("API key")).toHaveValue("openai-key");
    expect(configuration.get(AppSetting.AGENT_LLM_PROVIDER)).toBe("anthropic");

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "LLM provider" }));
    fireEvent.click(screen.getByRole("option", { name: "Anthropic" }));
    expect(screen.getByLabelText("API key")).toHaveValue("edited-anthropic-key");
  });

  it("keeps edits isolated while switching between Agent profiles", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    const revision = configuration.get("agent.configurationRevision");
    expect(typeof revision).toBe("string");
    await commitAgentSettings(configuration, {
      ...multiProfileDraft(),
      revision: revision as string,
    });
    renderSettings(configuration);

    expect(screen.getByLabelText("Model")).toHaveValue("alpha-model");
    expect(screen.getByLabelText("API key")).toHaveValue("alpha-key");
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "edited-alpha-model" },
    });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Agent profile" }));
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(screen.getByLabelText("Model")).toHaveValue("beta-model");
    expect(screen.getByLabelText("API key")).toHaveValue("beta-key");
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "edited-beta-key" },
    });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Agent profile" }));
    fireEvent.click(screen.getByRole("option", { name: "Alpha (active)" }));
    expect(screen.getByLabelText("Model")).toHaveValue("edited-alpha-model");
    expect(screen.getByLabelText("API key")).toHaveValue("alpha-key");

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Agent profile" }));
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));
    expect(screen.getByLabelText("API key")).toHaveValue("edited-beta-key");
  });

  it("supports profile CRUD, default switching, and submits the complete profile draft", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    const commitSpy = jest.spyOn(agentSettingsModule, "commitAgentSettings");
    renderSettings(configuration);

    fireEvent.click(screen.getByRole("button", { name: "Create profile" }));
    expect(screen.getByLabelText("Model")).toHaveValue("claude-opus-4-8");

    fireEvent.click(screen.getByRole("button", { name: "Rename profile" }));
    const nameInput = screen.getByRole("textbox", { name: "Profile name" });
    fireEvent.change(nameInput, { target: { value: "Renamed profile" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Rename Agent profile" }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy profile" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Agent profile" }));
    expect(screen.getByRole("option", { name: "Copy of Renamed profile" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "Copy of Renamed profile" }));

    fireEvent.click(screen.getByRole("button", { name: "Set as default" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Agent profile" }));
    expect(screen.getByRole("option", { name: "Copy of Renamed profile (active)" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "Copy of Renamed profile (active)" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete profile" }));
    expect(screen.getByRole("combobox", { name: "Agent profile" })).toHaveTextContent(
      "Default (active)",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));

    await waitFor(() => {
      expect(commitSpy).toHaveBeenCalled();
      expect(configuration.get("agent.activeProfileId")).toBe("default");
    });
    const submittedDraft = commitSpy.mock.calls.at(-1)?.[1];
    expect(submittedDraft).toMatchObject({
      activeProfileId: "default",
      profiles: [
        expect.objectContaining({ id: "default", name: "Default" }),
        expect.objectContaining({ name: "Renamed profile" }),
      ],
    });
    const storedProfiles = JSON.parse(String(configuration.get("agent.profiles"))) as Array<
      Record<string, unknown>
    >;
    expect(storedProfiles).toHaveLength(2);
    expect(storedProfiles.map(({ name }) => name)).toEqual(["Default", "Renamed profile"]);
    expect(JSON.stringify(storedProfiles)).not.toContain("apiKey");
    const credentialBundle = JSON.parse(
      localStorage.getItem("lichtblick.agent.credentials.v1") ?? "",
    ) as { profileKeys: Record<string, unknown> };
    expect(credentialBundle).toMatchObject({
      profileKeys: {
        default: expect.any(Object),
      },
    });
    expect(Object.keys(credentialBundle.profileKeys)).toHaveLength(2);
  });

  it("prevents deleting the final stored profile", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    renderSettings(configuration);

    expect(screen.getByRole("button", { name: "Delete profile" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rename profile" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Agent profile" })).toHaveTextContent(
      "Default (active)",
    );
  });

  it("exposes a single commit handler for dialog close and tab changes", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    let commitHandler: AgentSettingsCommitHandler | undefined;
    renderSettings(configuration, {
      onCommitHandlerChange: (handler) => {
        commitHandler = handler;
      },
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "closed-model" },
    });
    await act(async () => {
      expect(await commitHandler?.()).toBe(true);
    });

    expect(configuration.get(AppSetting.AGENT_OPENAI_MODEL)).toBe("closed-model");
  });

  it("rejects URL query and fragment suffixes before constructing a client", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, {
      ...baseDraft,
      openAiCompatible: {
        ...baseDraft.openAiCompatible,
        baseUrl: "https://llm.example.com/v1?tenant=a",
      },
    });
    renderSettings(configuration);

    expect(
      screen.getByText("Agent is not configured. Fix the fields below to enable it."),
    ).toBeVisible();
    expect(
      screen.getAllByText(
        "Enter a valid HTTP or HTTPS URL without credentials, query parameters, or a fragment.",
      ),
    ).toHaveLength(1);
  });

  it("disables credential editing until desktop migration finishes", async () => {
    const configuration = makeMockAppConfiguration([
      [AppSetting.AGENT_LLM_PROVIDER, "anthropic"],
      ["agent.llmApiKey", "legacy-secret"],
    ]);
    let resolveCredentialRead: (() => void) | undefined;
    const credentialRead = new Promise<void>((resolve) => {
      resolveCredentialRead = resolve;
    });
    const bridge = installDesktopCredentialBridge();
    bridge.getSecureCredential.mockImplementation(async () => {
      await credentialRead;
      return undefined;
    });

    renderSettings(configuration, { isDesktop: true });

    expect(screen.getByLabelText("API key")).toBeDisabled();
    expect(screen.getByLabelText("Model")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Agent settings" })).toBeDisabled();
    expect(screen.getByText("Loading and migrating Agent credentials…")).toBeVisible();

    await act(async () => {
      resolveCredentialRead?.();
      await credentialRead;
    });
    await waitFor(() => {
      expect(screen.getByLabelText("API key")).toBeEnabled();
      expect(screen.getByLabelText("API key")).toHaveValue("legacy-secret");
    });
  });

  it("explains the credential trust boundary for Web and desktop", async () => {
    const webConfiguration = makeMockAppConfiguration();
    await commitAgentSettings(webConfiguration, baseDraft);
    const web = renderSettings(webConfiguration);
    expect(
      screen.getByText(
        "On the Web, credentials are stored in plain text and can be read by same-origin scripts. Installed extensions are trusted at the same level as the application and can access credentials stored on this device. Use desktop with a secure credential backend for encrypted at-rest storage.",
      ),
    ).toBeVisible();
    web.unmount();

    localStorage.clear();
    const desktopConfiguration = makeMockAppConfiguration();
    await commitAgentSettings(desktopConfiguration, baseDraft, {
      desktop: true,
    });
    renderSettings(desktopConfiguration, { isDesktop: true });
    expect(
      screen.getByText(
        "On desktop, credentials are encrypted at rest using the operating system's secure credential storage. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
      ),
    ).toBeVisible();
  });

  it("warns when desktop falls back to plaintext without a secure backend", async () => {
    const bridge = installDesktopCredentialBridge();
    bridge.setManySecureCredentials.mockResolvedValue({
      code: "insecure-backend",
      ok: false,
    });
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft, { desktop: true });
    renderSettings(configuration, { isDesktop: true });

    expect(
      await screen.findByText(
        "No secure credential backend is available (for example, Linux without a keyring), so credentials are stored in plain text. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("API key")).toBeEnabled();
  });

  it("keeps the draft retryable when plaintext fallback has no cross-window lock", async () => {
    const bridge = installDesktopCredentialBridge();
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft, { desktop: true });
    renderSettings(configuration, { isDesktop: true });
    await waitFor(() => {
      expect(screen.getByLabelText("Model")).toHaveValue(baseDraft.openAiCompatible.model);
    });
    Reflect.deleteProperty(globalThis.navigator, "locks");
    bridge.setManySecureCredentials.mockResolvedValue({
      code: "insecure-backend",
      ok: false,
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "retry-with-cross-window-lock" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));

    expect(
      await screen.findByText(
        "Plaintext credential storage cannot be saved because cross-window locking is unavailable. Use a secure desktop credential backend or a runtime with Web Locks support, then retry.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Model")).toHaveValue("retry-with-cross-window-lock");
    expect(screen.getByRole("button", { name: "Save Agent settings" })).toBeEnabled();
    expect(configuration.get(AppSetting.AGENT_OPENAI_MODEL)).toBe(baseDraft.openAiCompatible.model);
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toBeNull();
  });

  it("keeps the form disabled when the desktop credential backend is temporarily unavailable", async () => {
    const bridge = installDesktopCredentialBridge();
    bridge.getSecureCredential.mockResolvedValue({
      code: "backend-unavailable",
      ok: false,
    });
    const configuration = makeMockAppConfiguration([
      ["agent.configurationRevision", "existing-revision"],
    ]);

    renderSettings(configuration, { isDesktop: true });

    expect(
      await screen.findByText(
        "The operating system credential backend is temporarily unavailable. Existing desktop credentials and the current form values have been preserved; unlock or restore the credential service, then retry.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("API key")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Agent settings" })).toBeDisabled();
    expect(bridge.setManySecureCredentials).not.toHaveBeenCalled();
    expect(bridge.deleteSecureCredential).not.toHaveBeenCalled();
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toBeNull();
  });

  it("keeps the loaded draft retryable when the backend becomes unavailable during save", async () => {
    const bridge = installDesktopCredentialBridge();
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft, { desktop: true });
    renderSettings(configuration, { isDesktop: true });
    await waitFor(() => {
      expect(screen.getByLabelText("API key")).toHaveValue("secret-key");
    });
    bridge.setManySecureCredentials.mockResolvedValue({
      code: "backend-unavailable",
      ok: false,
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "retry-after-unlock" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));

    expect(
      await screen.findByText(
        "The operating system credential backend is temporarily unavailable. Existing desktop credentials and the current form values have been preserved; unlock or restore the credential service, then retry.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("API key")).toHaveValue("secret-key");
    expect(screen.getByLabelText("Model")).toHaveValue("retry-after-unlock");
    expect(
      screen.queryByText(
        "Agent credentials or settings could not be read or saved. Your draft has not been discarded.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Agent settings" })).toBeEnabled();

    bridge.setManySecureCredentials.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));
    await waitFor(() => {
      expect(
        screen.queryByText(
          "The operating system credential backend is temporarily unavailable. Existing desktop credentials and the current form values have been preserved; unlock or restore the credential service, then retry.",
        ),
      ).not.toBeInTheDocument();
      expect(configuration.get(AppSetting.AGENT_OPENAI_MODEL)).toBe("retry-after-unlock");
    });
  });

  it("loads legacy basic_text credentials and asks the user to save them again", async () => {
    const revision = "legacy-basic-text-revision";
    const configurationMirror = {
      anthropicBaseUrl: "",
      anthropicModel: "legacy-model",
      openAiBaseUrl: "",
      openAiModel: "",
      provider: "anthropic",
    };
    const legacyValues = new Map([
      [
        "agent.llmApiKey",
        JSON.stringify({
          anthropicApiKey: "legacy-basic-text-key",
          configuration: configurationMirror,
          openAiApiKey: "",
          revision,
        }),
      ],
    ]);
    const bridge = installDesktopCredentialBridge();
    bridge.getSecureCredential.mockImplementation(async (name) => ({
      code: "insecure-backend",
      ok: true,
      value: legacyValues.get(name),
    }));
    const configuration = makeMockAppConfiguration([
      [AppSetting.AGENT_LLM_PROVIDER, configurationMirror.provider],
      [AppSetting.AGENT_ANTHROPIC_BASE_URL, configurationMirror.anthropicBaseUrl],
      [AppSetting.AGENT_ANTHROPIC_MODEL, configurationMirror.anthropicModel],
      [AppSetting.AGENT_OPENAI_BASE_URL, configurationMirror.openAiBaseUrl],
      [AppSetting.AGENT_OPENAI_MODEL, configurationMirror.openAiModel],
      ["agent.configurationRevision", revision],
    ]);

    renderSettings(configuration, { isDesktop: true });

    expect(
      await screen.findByText(
        "These credentials are currently stored with plaintext-equivalent protection by a legacy insecure backend. Review and save Agent settings again to move them to the supported plaintext fallback. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("API key")).toHaveValue("legacy-basic-text-key");

    const saveButton = screen.getByRole("button", {
      name: "Save Agent settings",
    });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    expect(
      await screen.findByText(
        "No secure credential backend is available (for example, Linux without a keyring), so credentials are stored in plain text. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(
        "These credentials are currently stored with plaintext-equivalent protection by a legacy insecure backend. Review and save Agent settings again to move them to the supported plaintext fallback. Installed extensions are trusted at the same level as the application and can access credentials stored on this device.",
      ),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("lichtblick.agent.credentials.v1")).toContain(
      "legacy-basic-text-key",
    );
  });

  it("reloads the winner and warns when another tab makes the draft stale", async () => {
    const [firstConfiguration, secondConfiguration] = makeSharedConfigurations();
    await commitAgentSettings(firstConfiguration, baseDraft);
    renderSettings(secondConfiguration);
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "stale-model" },
    });

    const currentRevision = firstConfiguration.get("agent.configurationRevision");
    expect(typeof currentRevision).toBe("string");
    await commitAgentSettings(firstConfiguration, {
      ...baseDraft,
      anthropic: { ...baseDraft.anthropic, apiKey: "winner-key" },
      revision: currentRevision as string,
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));

    expect(
      await screen.findByText(
        "Agent settings changed in another tab. The latest saved values were reloaded; review them and try your edit again.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Model")).toHaveValue(baseDraft.openAiCompatible.model);
  });

  it("reloads a desktop winner from secure storage and saves on the next attempt", async () => {
    const durableValues = new Map<string, AppConfigurationValue>();
    const firstConfiguration = makeCachedConfiguration(durableValues);
    await commitAgentSettings(firstConfiguration, baseDraft, { desktop: true });
    const secondConfiguration = makeCachedConfiguration(durableValues);
    renderSettings(secondConfiguration, { isDesktop: true });
    await waitFor(() => {
      expect(screen.getByLabelText("Model")).toHaveValue("local-model");
    });
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "stale-model" },
    });

    const firstRevision = firstConfiguration.get("agent.configurationRevision");
    expect(typeof firstRevision).toBe("string");
    await commitAgentSettings(
      firstConfiguration,
      {
        ...baseDraft,
        openAiCompatible: {
          ...baseDraft.openAiCompatible,
          baseUrl: "https://winner.example.com/v1",
          model: "winner-model",
        },
        revision: firstRevision as string,
      },
      { desktop: true },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));

    expect(
      await screen.findByText(
        "Agent settings changed in another tab. The latest saved values were reloaded; review them and try your edit again.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Model")).toHaveValue("winner-model");
    expect(screen.getByLabelText("Base URL")).toHaveValue("https://winner.example.com/v1");

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "retry-model" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));
    await waitFor(() => {
      expect(secondConfiguration.get(AppSetting.AGENT_OPENAI_MODEL)).toBe("retry-model");
      expect(
        screen.queryByText(
          "Agent settings changed in another tab. The latest saved values were reloaded; review them and try your edit again.",
        ),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the draft retryable after a credential persistence failure", async () => {
    const configuration = makeMockAppConfiguration();
    await commitAgentSettings(configuration, baseDraft);
    renderSettings(configuration);
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "retry-key" },
    });

    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));
    expect(
      await screen.findByText(
        "Agent credentials or settings could not be read or saved. Your draft has not been discarded.",
      ),
    ).toBeVisible();

    setItem.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Save Agent settings" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Agent settings" })).toBeDisabled();
    });
  });
});
