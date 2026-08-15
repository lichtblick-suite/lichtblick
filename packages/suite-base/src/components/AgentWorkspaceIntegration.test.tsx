/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, render } from "@testing-library/react";

import type { AgentChatProfileOption } from "@lichtblick/suite-base/context/AgentChatContext";
import type {
  AgentProfile,
  AgentSettingsSnapshot,
} from "@lichtblick/suite-base/services/agent/agentSettings";
import type { LayoutProposal } from "@lichtblick/suite-base/services/agent/types";

import { AgentWorkspaceIntegration } from "./AgentWorkspaceIntegration";

const mockWorkspaceTools = {
  openDataSource: jest.fn(),
  getCatalog: jest.fn(() => ({ topics: [], datatypes: new Map() })),
  applyLayout: jest.fn().mockResolvedValue(undefined),
  getCurrentLayout: jest.fn(() => undefined),
  getCurrentLayoutId: jest.fn(() => undefined),
};

type ProviderProps = {
  onSelectProfile?: (profileId: string) => void;
  profileOptions?: readonly AgentChatProfileOption[];
  selectedProfileId?: string;
  selectedProfileName?: string;
  onApplyProposal?: (proposal: LayoutProposal, signal: AbortSignal) => Promise<void>;
  getInstalledPanelTypes?: () => ReadonlySet<string>;
};

const lastProviderPropsRef: { current?: ProviderProps } = {};
const mockAgentChatProvider = jest.fn(
  ({ children, ...props }: React.PropsWithChildren<ProviderProps>) => {
    lastProviderPropsRef.current = props;
    return <>{children}</>;
  },
);

jest.mock("@lichtblick/suite-base/components/AgentCatalogWatcher", () => ({
  AgentCatalogWatcher: () => null,
}));
jest.mock("@lichtblick/suite-base/providers/AgentChatProvider", () => ({
  __esModule: true,
  default: (props: React.PropsWithChildren<ProviderProps>) =>
    mockAgentChatProvider(props),
}));
jest.mock("@lichtblick/suite-base/context/PanelCatalogContext", () => ({
  usePanelCatalog: () => ({
    getPanels: () => [{ type: "Acme Extension.Custom Panel" }],
  }),
}));
jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: (
    selector: (state: { installedExtensions: [] }) => unknown,
  ) => selector({ installedExtensions: [] }),
}));
jest.mock("@lichtblick/suite-base/context/AppConfigurationContext", () => ({
  useAppConfiguration: () => ({}),
}));
jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: () => ({ topics: [], datatypes: new Map() }),
}));
jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineGetter: () => () => ({}),
}));
jest.mock("@lichtblick/suite-base/services/agent/workspaceTools", () => ({
  useAgentWorkspaceTools: () => mockWorkspaceTools,
}));
jest.mock("@lichtblick/suite-base/services/agent/localAgentClient", () => ({
  useLocalAgentClient: () => undefined,
}));
jest.mock("@lichtblick/suite-base/services/agent/memory/agentConversationPersistence", () => ({
  getOrCreateConversationId: () => "conversation-1",
  createAgentConversationPersistence: () => ({
    getActiveConversationId: () => "conversation-1",
    restoreUiMessages: jest.fn().mockResolvedValue([]),
    onUiMessagesChanged: jest.fn(),
    setProfileName: jest.fn(),
    startNewConversation: jest.fn(),
    switchConversation: jest.fn(),
    deleteConversation: jest.fn(),
    listConversations: jest.fn().mockResolvedValue({ items: [], total: 0, offline: false }),
    clear: jest.fn(),
    restorePiLlmHistory: jest.fn().mockResolvedValue([]),
    onPiLlmHistoryChanged: jest.fn(),
  }),
}));
jest.mock("@lichtblick/suite-base/services/agent/memory/agentMemory", () => ({
  createAgentMemoryStore: () => ({}),
}));
jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => ({
  __esModule: true,
  default: () => false,
}));

// The agent settings module stays real except for the snapshot source, so
// selectAgentConfiguration exercises the production selection path.
jest.mock("@lichtblick/suite-base/services/agent/agentSettings", () => {
  const actual = jest.requireActual<
    typeof import("@lichtblick/suite-base/services/agent/agentSettings")
  >("@lichtblick/suite-base/services/agent/agentSettings");
  return {
    ...actual,
    useAgentSettings: (): {
      migrationReady: boolean;
      snapshot: AgentSettingsSnapshot;
    } => ({
      migrationReady: true,
      snapshot: mockSnapshotRef.current,
    }),
  };
});

function profile(id: string, name: string): AgentProfile {
  return {
    anthropic: { apiKey: "", baseUrl: "", model: "claude-test" },
    id,
    name,
    openAiCompatible: { apiKey: "", baseUrl: "", model: "" },
    provider: "anthropic",
  };
}

const mockSnapshotRef: { current: AgentSettingsSnapshot } = {
  current: undefined as unknown as AgentSettingsSnapshot,
};

function makeSnapshot(
  profiles: AgentProfile[],
  activeProfileId: string,
): AgentSettingsSnapshot {
  const active = profiles.find((entry) => entry.id === activeProfileId) ?? profiles[0]!;
  return {
    activeProfileId,
    anthropic: { ...active.anthropic },
    credentialResaveRequired: false,
    credentialStorage: "plaintext",
    openAiCompatible: { ...active.openAiCompatible },
    profiles,
    provider: active.provider,
    revision: "snapshot-revision",
    storageError: false,
  };
}

function Probe({ onProps }: { onProps: (props: ProviderProps) => void }): ReactNull {
  onProps(lastProviderPropsRef.current ?? {});
  return null;
}

describe("AgentWorkspaceIntegration profile wiring", () => {
  beforeEach(() => {
    mockAgentChatProvider.mockClear();
    lastProviderPropsRef.current = undefined;
  });

  it("exposes local profiles and forwards the user's selection", () => {
    mockSnapshotRef.current = makeSnapshot(
      [profile("default", "Default"), profile("p2", "Second profile")],
      "default",
    );
    const root = render(
      <AgentWorkspaceIntegration agentEnabled>
        <Probe onProps={() => {}} />
      </AgentWorkspaceIntegration>,
    );

    expect(lastProviderPropsRef.current?.profileOptions).toEqual([
      expect.objectContaining({ id: "default", name: "Default", isActive: true }),
      expect.objectContaining({ id: "p2", name: "Second profile", isActive: false }),
    ]);
    expect(lastProviderPropsRef.current?.selectedProfileId).toBe("default");
    expect(lastProviderPropsRef.current?.selectedProfileName).toBe("Default");

    act(() => {
      lastProviderPropsRef.current?.onSelectProfile?.("p2");
    });
    expect(lastProviderPropsRef.current?.selectedProfileId).toBe("p2");
    expect(lastProviderPropsRef.current?.selectedProfileName).toBe("Second profile");
    root.unmount();
  });

  it("falls back to the active profile when the selected profile is deleted", () => {
    mockSnapshotRef.current = makeSnapshot(
      [profile("default", "Default"), profile("p2", "Second profile")],
      "default",
    );
    const root = render(
      <AgentWorkspaceIntegration agentEnabled>
        <Probe
          onProps={() => {
            // The selection is driven through the provider surface below.
          }}
        />
      </AgentWorkspaceIntegration>,
    );
    act(() => {
      lastProviderPropsRef.current?.onSelectProfile?.("p2");
    });
    expect(lastProviderPropsRef.current?.selectedProfileId).toBe("p2");

    // The selected profile disappears from the snapshot (deleted in another tab).
    mockSnapshotRef.current = makeSnapshot([profile("default", "Default")], "default");
    root.rerender(
      <AgentWorkspaceIntegration agentEnabled>
        <Probe onProps={() => {}} />
      </AgentWorkspaceIntegration>,
    );

    expect(lastProviderPropsRef.current?.selectedProfileId).toBe("default");
    expect(lastProviderPropsRef.current?.profileOptions).toEqual([
      expect.objectContaining({ id: "default", isActive: true }),
    ]);
    root.unmount();
  });

  it("wires the live installed panel-type set into the provider", () => {
    mockSnapshotRef.current = makeSnapshot([profile("default", "Default")], "default");
    const root = render(
      <AgentWorkspaceIntegration agentEnabled>
        <Probe onProps={() => {}} />
      </AgentWorkspaceIntegration>,
    );

    // Same trusted source the orchestrator tool runtime validates against: the panel inventory
    // built from the panel catalog (built-ins plus installed extensions).
    expect(lastProviderPropsRef.current?.getInstalledPanelTypes?.()).toEqual(
      new Set(["Acme Extension.Custom Panel"]),
    );
    root.unmount();
  });

  it("applies proposals through workspace tools with the proposal baseline", async () => {
    mockSnapshotRef.current = makeSnapshot([profile("default", "Default")], "default");
    mockWorkspaceTools.applyLayout.mockClear();
    const root = render(
      <AgentWorkspaceIntegration agentEnabled>
        <Probe onProps={() => {}} />
      </AgentWorkspaceIntegration>,
    );
    const proposal: LayoutProposal = {
      name: "Add gauge",
      data: {
        configById: {},
        globalVariables: {},
        playbackConfig: { speed: 1 },
        userNodes: {},
      },
      baseLayoutId: "layout-1",
      baseFingerprint: "fingerprint-1",
    };

    await act(async () => {
      await lastProviderPropsRef.current?.onApplyProposal?.(
        proposal,
        new AbortController().signal,
      );
    });

    // The landing chain forwards the validated proposal to the workspace-tools apply path with
    // the baseline that decides the incremental ADD_PANELS_ATOMIC dispatch.
    expect(mockWorkspaceTools.applyLayout).toHaveBeenCalledWith(
      "Add gauge",
      proposal.data,
      {
        baseLayoutId: "layout-1",
        baseFingerprint: "fingerprint-1",
      },
    );
    root.unmount();
  });
});
