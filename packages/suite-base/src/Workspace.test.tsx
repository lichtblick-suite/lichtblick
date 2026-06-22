/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/react";

import {
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@lichtblick/suite-base/components/MessagePipeline";
import Sidebars from "@lichtblick/suite-base/components/Sidebars";
import { SidebarItem } from "@lichtblick/suite-base/components/Sidebars/types";
import { useAppContext } from "@lichtblick/suite-base/context/AppContext";
import {
  useCurrentUser,
  useCurrentUserType,
} from "@lichtblick/suite-base/context/CurrentUserContext";
import { useEvents } from "@lichtblick/suite-base/context/EventsContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import useAlertCount from "@lichtblick/suite-base/hooks/useAlertCount";
import { useHandleFiles } from "@lichtblick/suite-base/hooks/useHandleFiles";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { parseAppURLState } from "@lichtblick/suite-base/util/appURLState";

import Workspace from "./Workspace";

// ── style ─────────────────────────────────────────────────────────────────────
vi.mock("@lichtblick/suite-base/Workspace.style", async () => ({
  useStyles: () => ({ classes: { container: "" } }),
}));

// ── external libs ─────────────────────────────────────────────────────────────
vi.mock("i18next", async () => ({ t: (key: string) => key }));
vi.mock("react-i18next", async () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@lichtblick/log", async () => ({
  __esModule: true,
  default: { getLogger: () => ({ debug: vi.fn(), error: vi.fn() }) },
}));

const mockEnqueueSnackbar = vi.fn();
vi.mock("notistack", async () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

// ── api ───────────────────────────────────────────────────────────────────────
const mockGetSession = vi.fn();
vi.mock("@lichtblick/suite-base/api/session/SessionAPI", async () => ({
  __esModule: true,
  default: { getSession: (...args: unknown[]) => mockGetSession(...args) },
}));

// ── components (rendered as null — Sidebars is the exception below) ────────────
vi.mock("@lichtblick/suite-base/components/Sidebars", async () => ({
  __esModule: true,
  default: vi.fn(() => undefined),
}));
vi.mock("@lichtblick/suite-base/components/AppBar", async () => ({
  AppBar: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/AlertsList", async () => ({
  AlertsList: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/AccountSettingsSidebar/AccountSettings", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/DataSourceDialog", async () => ({
  DataSourceDialog: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/DataSourceSidebar/DataSourceSidebar", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/DocumentDropListener", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/EventsList", async () => ({
  EventsList: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/ExtensionsSettings", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/KeyListener", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/LayoutBrowser", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/PanelCatalog", async () => ({
  PanelCatalog: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/PanelLayout", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/PanelSettings", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/PlaybackControls", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/RemountOnValueChange", async () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@lichtblick/suite-base/components/SidebarContent", async () => ({
  SidebarContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@lichtblick/suite-base/components/Stack", async () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@lichtblick/suite-base/components/StudioLogsSettings", async () => ({
  StudioLogsSettings: () => undefined,
  StudioLogsSettingsSidebar: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/SyncAdapters", async () => ({
  SyncAdapters: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/TopicList", async () => ({
  TopicList: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/VariablesList", async () => ({
  __esModule: true,
  default: () => undefined,
}));
vi.mock("@lichtblick/suite-base/components/WorkspaceDialogs", async () => ({
  WorkspaceDialogs: () => undefined,
}));

// ── providers ─────────────────────────────────────────────────────────────────
vi.mock("@lichtblick/suite-base/providers/WorkspaceContextProvider", async () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", async () => ({
  PanelStateContextProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// ── hooks ─────────────────────────────────────────────────────────────────────
vi.mock("@lichtblick/suite-base/components/MessagePipeline", async () => ({
  useMessagePipeline: vi.fn(),
  useMessagePipelineGetter: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/context/AppContext", async () => ({
  useAppContext: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/context/CurrentLayoutContext", async () => ({
  useCurrentLayoutSelector: vi.fn().mockReturnValue(undefined),
}));
vi.mock("@lichtblick/suite-base/context/CurrentUserContext", async () => ({
  useCurrentUser: vi.fn(),
  useCurrentUserType: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/context/EventsContext", async () => ({
  useEvents: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/context/PlayerSelectionContext", async () => ({
  usePlayerSelection: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", async () => ({
  useWorkspaceStore: vi.fn(),
  SidebarItemKeys: [],
}));
vi.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", async () => ({
  useWorkspaceActions: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/hooks", async () => ({
  useAppConfigurationValue: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/hooks/useAlertCount", async () => ({
  __esModule: true,
  default: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/hooks/useAddPanel", async () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("@lichtblick/suite-base/hooks/useDefaultWebLaunchPreference", async () => ({
  useDefaultWebLaunchPreference: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/hooks/useElectronFilesToOpen", async () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue(undefined),
}));
vi.mock("@lichtblick/suite-base/hooks/useHandleFiles", async () => ({
  useHandleFiles: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/hooks/useSeekTimeFromCLI", async () => ({
  __esModule: true,
  default: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/panels/Plot/hooks/useStructureItemsStoreManager", async () => ({
  useStructureItemsStoreManager: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/theme/icons", async () => ({
  __esModule: true,
  default: {},
}));
vi.mock("@lichtblick/suite-base/util/appURLState", async () => ({
  parseAppURLState: vi.fn().mockReturnValue(undefined),
}));
vi.mock("@lichtblick/suite-base/util/broadcast/useBroadcast", async () => ({
  __esModule: true,
  default: vi.fn(),
}));
vi.mock("@lichtblick/suite-base/util/isDesktopApp", async () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue(false),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const MockedSidebars = Sidebars as unknown as Mock;

const mockPipelineContext = {
  playerState: {
    presence: PlayerPresence.NOT_PRESENT,
    playerId: "",
    activeData: undefined,
    alerts: [],
  },
  startPlayback: undefined,
  pausePlayback: undefined,
  seekPlayback: undefined,
  playUntil: undefined,
};

const mockWorkspaceStore = {
  dialogs: {
    dataSource: { open: false, activeDataSource: undefined, item: undefined },
    preferences: { open: false, initialTab: undefined },
  },
  sidebars: {
    left: { item: undefined, open: false, size: undefined },
    right: { item: undefined, open: false, size: undefined },
  },
};

const mockWorkspaceActions = {
  dialogActions: {
    dataSource: { open: vi.fn(), close: vi.fn() },
    preferences: { open: vi.fn() },
    openFile: { open: vi.fn().mockResolvedValue(undefined) },
  },
  sidebarActions: {
    left: { setOpen: vi.fn(), selectItem: vi.fn(), setSize: vi.fn() },
    right: { setOpen: vi.fn(), selectItem: vi.fn(), setSize: vi.fn() },
  },
  openLayoutBrowser: vi.fn(),
};

describe("Workspace - alerts badge in leftSidebarItems", () => {
  beforeEach(() => {
    (useMessagePipeline as Mock).mockImplementation(
      (selector: (ctx: typeof mockPipelineContext) => unknown) => selector(mockPipelineContext),
    );
    (useMessagePipelineGetter as Mock).mockReturnValue(() => mockPipelineContext);
    (useWorkspaceStore as Mock).mockImplementation(
      (selector: (store: typeof mockWorkspaceStore) => unknown) => selector(mockWorkspaceStore),
    );
    (useWorkspaceActions as Mock).mockReturnValue(mockWorkspaceActions);
    (usePlayerSelection as Mock).mockReturnValue({
      availableSources: [],
      selectSource: vi.fn(),
    });
    (useAlertCount as Mock).mockReturnValue({
      playerAlerts: [],
      sessionAlerts: [],
      alertCount: 0,
    });
    (useHandleFiles as Mock).mockReturnValue({ handleFiles: vi.fn() });
    (useAppConfigurationValue as Mock).mockReturnValue([false]);
    (useCurrentUser as Mock).mockReturnValue({ currentUser: undefined, signIn: undefined });
    (useCurrentUserType as Mock).mockReturnValue("unauthenticated");
    (useEvents as Mock).mockImplementation(
      (selector: (store: { eventsSupported: boolean; selectEvent: Mock }) => unknown) =>
        selector({ eventsSupported: false, selectEvent: vi.fn() }),
    );
    (useAppContext as Mock).mockReturnValue({
      PerformanceSidebarComponent: undefined,
      sidebarItems: [],
      layoutBrowser: undefined,
      workspaceStoreCreator: undefined,
    });
  });

  afterEach(() => {
    MockedSidebars.mockClear();
  });

  it("should not set badge on alerts sidebar item when alertCount is 0", () => {
    // Given
    (useAlertCount as Mock).mockReturnValue({
      playerAlerts: [],
      sessionAlerts: [],
      alertCount: 0,
    });

    // When
    render(<Workspace />);

    // Then
    const leftItems = MockedSidebars.mock.lastCall?.[0]?.leftItems as Map<string, SidebarItem>;
    expect(leftItems.get("alerts")?.badge).toBeUndefined();
  });

  it("should set badge with count and error color on alerts sidebar item when alertCount > 0", () => {
    // Given
    (useAlertCount as Mock).mockReturnValue({
      playerAlerts: [{ message: "err", severity: "error" }],
      sessionAlerts: [],
      alertCount: 1,
    });

    // When
    render(<Workspace />);

    // Then
    const leftItems = MockedSidebars.mock.lastCall?.[0]?.leftItems as Map<string, SidebarItem>;
    expect(leftItems.get("alerts")?.badge).toEqual({ count: 1, color: "error" });
  });

  it("should reflect the exact alertCount in the badge", () => {
    // Given
    (useAlertCount as Mock).mockReturnValue({
      playerAlerts: [],
      sessionAlerts: [],
      alertCount: 5,
    });

    // When
    render(<Workspace />);

    // Then
    const leftItems = MockedSidebars.mock.lastCall?.[0]?.leftItems as Map<string, SidebarItem>;
    expect(leftItems.get("alerts")?.badge?.count).toBe(5);
  });
});

describe("Workspace - session-based MCAP resolution", () => {
  const mockSelectSource = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useMessagePipeline as Mock).mockImplementation(
      (selector: (ctx: typeof mockPipelineContext) => unknown) => selector(mockPipelineContext),
    );
    (useMessagePipelineGetter as Mock).mockReturnValue(() => mockPipelineContext);
    (useWorkspaceStore as Mock).mockImplementation(
      (selector: (store: typeof mockWorkspaceStore) => unknown) => selector(mockWorkspaceStore),
    );
    (useWorkspaceActions as Mock).mockReturnValue(mockWorkspaceActions);
    (usePlayerSelection as Mock).mockReturnValue({
      availableSources: [],
      selectSource: mockSelectSource,
    });
    (useAlertCount as Mock).mockReturnValue({
      playerAlerts: [],
      sessionAlerts: [],
      alertCount: 0,
    });
    (useHandleFiles as Mock).mockReturnValue({ handleFiles: vi.fn() });
    (useAppConfigurationValue as Mock).mockReturnValue([false]);
    (useCurrentUser as Mock).mockReturnValue({ currentUser: undefined, signIn: undefined });
    (useCurrentUserType as Mock).mockReturnValue("unauthenticated");
    (useEvents as Mock).mockImplementation(
      (selector: (store: { eventsSupported: boolean; selectEvent: Mock }) => unknown) =>
        selector({ eventsSupported: false, selectEvent: vi.fn() }),
    );
    (useAppContext as Mock).mockReturnValue({
      PerformanceSidebarComponent: undefined,
      sidebarItems: [],
      layoutBrowser: undefined,
      workspaceStoreCreator: undefined,
    });
  });

  it("should fetch session and call selectSource with resolved URLs and metadata", async () => {
    // Given
    const sessionId = "test-session-123";
    const mockMcaps = [
      { url: "https://example.com/file1.mcap", metadata: { robot: "r1" } },
      { url: "https://example.com/file2.mcap", metadata: { robot: "r2" } },
    ];
    mockGetSession.mockResolvedValue(mockMcaps);
    (parseAppURLState as Mock).mockReturnValue({ sessionId });

    // When
    render(<Workspace deepLinks={["https://app.example.com/?sessionid=test-session-123"]} />);

    // Then
    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledWith(sessionId, expect.any(AbortSignal));
    });
    await waitFor(() => {
      expect(mockSelectSource).toHaveBeenCalledWith("remote-file", {
        type: "connection",
        params: { url: "https://example.com/file1.mcap,https://example.com/file2.mcap" },
        sourceMetadata: [{ robot: "r1" }, { robot: "r2" }],
      });
    });
  });

  it("should show error snackbar when session fetch fails", async () => {
    // Given
    const sessionId = "failing-session";
    mockGetSession.mockRejectedValue(new Error("Network error"));
    (parseAppURLState as Mock).mockReturnValue({ sessionId });

    // When
    render(<Workspace deepLinks={["https://app.example.com/?sessionid=failing-session"]} />);

    // Then
    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalledWith(sessionId, expect.any(AbortSignal));
    });
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to load session data sources", {
        variant: "error",
      });
    });
  });

  it("should not fetch session when sessionId is not present", () => {
    // Given
    (parseAppURLState as Mock).mockReturnValue({
      ds: "remote-file",
      dsParams: { url: "https://example.com/file.mcap" },
    });

    // When
    render(<Workspace deepLinks={["https://app.example.com/?ds=remote-file"]} />);

    // Then
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});
