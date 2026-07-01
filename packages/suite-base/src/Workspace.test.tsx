/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
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
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import useAlertCount from "@lichtblick/suite-base/hooks/useAlertCount";
import { useHandleFiles } from "@lichtblick/suite-base/hooks/useHandleFiles";
import { useLayoutTransfer } from "@lichtblick/suite-base/hooks/useLayoutTransfer";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { parseAppURLState } from "@lichtblick/suite-base/util/appURLState";

import Workspace from "./Workspace";

// ── style ─────────────────────────────────────────────────────────────────────
jest.mock("@lichtblick/suite-base/Workspace.style", () => ({
  useStyles: () => ({ classes: { container: "" } }),
}));

// ── external libs ─────────────────────────────────────────────────────────────
jest.mock("i18next", () => ({ t: (key: string) => key }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: { getLogger: () => ({ debug: jest.fn(), error: jest.fn() }) },
}));

const mockEnqueueSnackbar = jest.fn();
jest.mock("notistack", () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

// ── api ───────────────────────────────────────────────────────────────────────
const mockGetSession = jest.fn();
jest.mock("@lichtblick/suite-base/api/session/SessionAPI", () => ({
  __esModule: true,
  default: { getSession: (...args: unknown[]) => mockGetSession(...args) },
}));

// ── components (rendered as null — Sidebars is the exception below) ────────────
jest.mock("@lichtblick/suite-base/components/Sidebars", () => ({
  __esModule: true,
  default: jest.fn(() => undefined),
}));
jest.mock("@lichtblick/suite-base/components/AppBar", () => ({
  AppBar: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/AlertsList", () => ({
  AlertsList: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/AccountSettingsSidebar/AccountSettings", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/DataSourceDialog", () => ({
  DataSourceDialog: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/DataSourceSidebar/DataSourceSidebar", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/DocumentDropListener", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/EventsList", () => ({
  EventsList: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/ExtensionsSettings", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/KeyListener", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/LayoutBrowser", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/PanelCatalog", () => ({
  PanelCatalog: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/PanelLayout", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/PanelSettings", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/PlaybackControls", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/RemountOnValueChange", () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("@lichtblick/suite-base/components/SidebarContent", () => ({
  SidebarContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("@lichtblick/suite-base/components/Stack", () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("@lichtblick/suite-base/components/StudioLogsSettings", () => ({
  StudioLogsSettings: () => undefined,
  StudioLogsSettingsSidebar: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/SyncAdapters", () => ({
  SyncAdapters: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/TopicList", () => ({
  TopicList: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/VariablesList", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@lichtblick/suite-base/components/WorkspaceDialogs", () => ({
  WorkspaceDialogs: () => undefined,
}));

// ── providers ─────────────────────────────────────────────────────────────────
jest.mock("@lichtblick/suite-base/providers/WorkspaceContextProvider", () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("@lichtblick/suite-base/providers/PanelStateContextProvider", () => ({
  PanelStateContextProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// ── hooks ─────────────────────────────────────────────────────────────────────
jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipeline: jest.fn(),
  useMessagePipelineGetter: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/AppContext", () => ({
  useAppContext: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutSelector: jest.fn().mockReturnValue(undefined),
  useCurrentLayoutActions: jest.fn().mockReturnValue({
    setSelectedLayoutId: jest.fn(),
  }),
}));
jest.mock("@lichtblick/suite-base/context/CurrentUserContext", () => ({
  useCurrentUser: jest.fn(),
  useCurrentUserType: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/EventsContext", () => ({
  useEvents: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => ({
  useLayoutManager: jest.fn().mockReturnValue({
    getLayouts: jest.fn().mockResolvedValue([]),
    deleteLayout: jest.fn().mockResolvedValue(undefined),
    saveNewLayout: jest.fn().mockResolvedValue({ id: "test-layout-id" }),
  }),
}));
jest.mock("@lichtblick/suite-base/context/PlayerSelectionContext", () => ({
  usePlayerSelection: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", () => ({
  useWorkspaceStore: jest.fn(),
  SidebarItemKeys: [],
}));
jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppConfigurationValue: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/hooks/useAlertCount", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/hooks/useAddPanel", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(jest.fn()),
}));
jest.mock("@lichtblick/suite-base/hooks/useDefaultWebLaunchPreference", () => ({
  useDefaultWebLaunchPreference: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/hooks/useElectronFilesToOpen", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(undefined),
}));
jest.mock("@lichtblick/suite-base/hooks/useHandleFiles", () => ({
  useHandleFiles: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/hooks/useLayoutTransfer", () => ({
  useLayoutTransfer: jest.fn().mockReturnValue({
    parseAndInstallLayout: jest.fn().mockResolvedValue({ id: "default-layout-id" }),
    importLayout: jest.fn(),
    exportLayout: jest.fn(),
  }),
}));
jest.mock("@lichtblick/suite-base/hooks/useSeekTimeFromCLI", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/panels/Plot/hooks/useStructureItemsStoreManager", () => ({
  useStructureItemsStoreManager: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/theme/icons", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("@lichtblick/suite-base/util/appURLState", () => ({
  parseAppURLState: jest.fn().mockReturnValue(undefined),
}));
jest.mock("@lichtblick/suite-base/util/broadcast/useBroadcast", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(false),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const MockedSidebars = Sidebars as unknown as jest.Mock;

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
    dataSource: { open: jest.fn(), close: jest.fn() },
    preferences: { open: jest.fn() },
    openFile: { open: jest.fn().mockResolvedValue(undefined) },
  },
  sidebarActions: {
    left: { setOpen: jest.fn(), selectItem: jest.fn(), setSize: jest.fn() },
    right: { setOpen: jest.fn(), selectItem: jest.fn(), setSize: jest.fn() },
  },
  openLayoutBrowser: jest.fn(),
};

describe("Workspace - alerts badge in leftSidebarItems", () => {
  beforeEach(() => {
    (useMessagePipeline as jest.Mock).mockImplementation(
      (selector: (ctx: typeof mockPipelineContext) => unknown) => selector(mockPipelineContext),
    );
    (useMessagePipelineGetter as jest.Mock).mockReturnValue(() => mockPipelineContext);
    (useWorkspaceStore as jest.Mock).mockImplementation(
      (selector: (store: typeof mockWorkspaceStore) => unknown) => selector(mockWorkspaceStore),
    );
    (useWorkspaceActions as jest.Mock).mockReturnValue(mockWorkspaceActions);
    (usePlayerSelection as jest.Mock).mockReturnValue({
      availableSources: [],
      selectSource: jest.fn(),
    });
    (useAlertCount as jest.Mock).mockReturnValue({
      playerAlerts: [],
      sessionAlerts: [],
      alertCount: 0,
    });
    (useHandleFiles as jest.Mock).mockReturnValue({ handleFiles: jest.fn() });
    (useAppConfigurationValue as jest.Mock).mockReturnValue([false]);
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUser: undefined, signIn: undefined });
    (useCurrentUserType as jest.Mock).mockReturnValue("unauthenticated");
    (useEvents as jest.Mock).mockImplementation(
      (selector: (store: { eventsSupported: boolean; selectEvent: jest.Mock }) => unknown) =>
        selector({ eventsSupported: false, selectEvent: jest.fn() }),
    );
    (useAppContext as jest.Mock).mockReturnValue({
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
    (useAlertCount as jest.Mock).mockReturnValue({
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
    (useAlertCount as jest.Mock).mockReturnValue({
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
    (useAlertCount as jest.Mock).mockReturnValue({
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
  const mockSelectSource = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useMessagePipeline as jest.Mock).mockImplementation(
      (selector: (ctx: typeof mockPipelineContext) => unknown) => selector(mockPipelineContext),
    );
    (useMessagePipelineGetter as jest.Mock).mockReturnValue(() => mockPipelineContext);
    (useWorkspaceStore as jest.Mock).mockImplementation(
      (selector: (store: typeof mockWorkspaceStore) => unknown) => selector(mockWorkspaceStore),
    );
    (useWorkspaceActions as jest.Mock).mockReturnValue(mockWorkspaceActions);
    (usePlayerSelection as jest.Mock).mockReturnValue({
      availableSources: [],
      selectSource: mockSelectSource,
    });
    (useAlertCount as jest.Mock).mockReturnValue({
      playerAlerts: [],
      sessionAlerts: [],
      alertCount: 0,
    });
    (useHandleFiles as jest.Mock).mockReturnValue({ handleFiles: jest.fn() });
    (useAppConfigurationValue as jest.Mock).mockReturnValue([false]);
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUser: undefined, signIn: undefined });
    (useCurrentUserType as jest.Mock).mockReturnValue("unauthenticated");
    (useEvents as jest.Mock).mockImplementation(
      (selector: (store: { eventsSupported: boolean; selectEvent: jest.Mock }) => unknown) =>
        selector({ eventsSupported: false, selectEvent: jest.fn() }),
    );
    (useAppContext as jest.Mock).mockReturnValue({
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
    (parseAppURLState as jest.Mock).mockReturnValue({ sessionId });

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
    (parseAppURLState as jest.Mock).mockReturnValue({ sessionId });

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
    (parseAppURLState as jest.Mock).mockReturnValue({
      ds: "remote-file",
      dsParams: { url: "https://example.com/file.mcap" },
    });

    // When
    render(<Workspace deepLinks={["https://app.example.com/?ds=remote-file"]} />);

    // Then
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});

describe("Workspace - fetchLayoutFromUrl", () => {
  const mockParseAndInstallLayout = jest.fn();
  const mockGetLayouts = jest.fn();
  const mockDeleteLayout = jest.fn();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const setupWorkspaceMocks = () => {
    (useMessagePipeline as jest.Mock).mockImplementation(
      (selector: (ctx: typeof mockPipelineContext) => unknown) => selector(mockPipelineContext),
    );
    (useMessagePipelineGetter as jest.Mock).mockReturnValue(() => mockPipelineContext);
    (useWorkspaceStore as jest.Mock).mockImplementation(
      (selector: (store: typeof mockWorkspaceStore) => unknown) => selector(mockWorkspaceStore),
    );
    (useWorkspaceActions as jest.Mock).mockReturnValue(mockWorkspaceActions);
    (usePlayerSelection as jest.Mock).mockReturnValue({
      availableSources: [],
      selectSource: jest.fn(),
    });
    (useAlertCount as jest.Mock).mockReturnValue({
      playerAlerts: [],
      sessionAlerts: [],
      alertCount: 0,
    });
    (useHandleFiles as jest.Mock).mockReturnValue({ handleFiles: jest.fn() });
    (useAppConfigurationValue as jest.Mock).mockReturnValue([false]);
    (useCurrentUser as jest.Mock).mockReturnValue({ currentUser: undefined, signIn: undefined });
    (useCurrentUserType as jest.Mock).mockReturnValue("unauthenticated");
    (useEvents as jest.Mock).mockImplementation(
      (selector: (store: { eventsSupported: boolean; selectEvent: jest.Mock }) => unknown) =>
        selector({ eventsSupported: false, selectEvent: jest.fn() }),
    );
    (useAppContext as jest.Mock).mockReturnValue({
      PerformanceSidebarComponent: undefined,
      sidebarItems: [],
      layoutBrowser: undefined,
      workspaceStoreCreator: undefined,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLayouts.mockResolvedValue([]);
    mockDeleteLayout.mockResolvedValue(undefined);
    mockParseAndInstallLayout.mockResolvedValue({ id: "new-layout-id" });
    (useLayoutManager as jest.Mock).mockReturnValue({
      getLayouts: mockGetLayouts,
      deleteLayout: mockDeleteLayout,
      saveNewLayout: jest.fn().mockResolvedValue({ id: "test-layout-id" }),
    });
    (useLayoutTransfer as jest.Mock).mockReturnValue({
      parseAndInstallLayout: mockParseAndInstallLayout,
      importLayout: jest.fn(),
      exportLayout: jest.fn(),
    });
    setupWorkspaceMocks();
  });

  it("should fetch and install layout from valid https URL", async () => {
    // Given
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('{"configById":{}}'),
    });
    (parseAppURLState as jest.Mock).mockReturnValue({
      layoutUrl: "https://example.com/my-layout.json",
    });

    // When
    render(
      <Workspace
        deepLinks={["https://app.example.com/?layoutUrl=https://example.com/my-layout.json"]}
      />,
    );

    // Then
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("https://example.com/my-layout.json");
    });
    await waitFor(() => {
      expect(mockParseAndInstallLayout).toHaveBeenCalledWith(
        expect.objectContaining({ name: "my-layout.json" }),
        "local",
      );
    });
  });

  it("should delete existing layouts with same name after successful install", async () => {
    // Given
    mockGetLayouts.mockResolvedValue([{ id: "old-id", name: "my-layout" }]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue("{}"),
    });
    (parseAppURLState as jest.Mock).mockReturnValue({
      layoutUrl: "https://example.com/my-layout.json",
    });

    // When
    render(
      <Workspace
        deepLinks={["https://app.example.com/?layoutUrl=https://example.com/my-layout.json"]}
      />,
    );

    // Then
    await waitFor(() => {
      expect(mockDeleteLayout).toHaveBeenCalledWith({ id: "old-id" });
    });
  });

  it("should not delete existing layouts if parseAndInstallLayout returns undefined", async () => {
    // Given
    mockGetLayouts.mockResolvedValue([{ id: "old-id", name: "my-layout" }]);
    mockParseAndInstallLayout.mockResolvedValue(undefined);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue("{}"),
    });
    (parseAppURLState as jest.Mock).mockReturnValue({
      layoutUrl: "https://example.com/my-layout.json",
    });

    // When
    render(
      <Workspace
        deepLinks={["https://app.example.com/?layoutUrl=https://example.com/my-layout.json"]}
      />,
    );

    // Then
    await waitFor(() => {
      expect(mockParseAndInstallLayout).toHaveBeenCalled();
    });
    expect(mockDeleteLayout).not.toHaveBeenCalled();
  });

  it("should show error snackbar for non-http(s) URL", async () => {
    // Given
    (parseAppURLState as jest.Mock).mockReturnValue({
      layoutUrl: "file:///local/layout.json",
    });

    // When
    render(
      <Workspace deepLinks={["https://app.example.com/?layoutUrl=file:///local/layout.json"]} />,
    );

    // Then
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        "Layout URL must use http or https protocol",
        {
          variant: "error",
        },
      );
    });
  });

  it("should show error snackbar on HTTP error response", async () => {
    // Given
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    (parseAppURLState as jest.Mock).mockReturnValue({
      layoutUrl: "https://example.com/layout.json",
    });

    // When
    render(
      <Workspace
        deepLinks={["https://app.example.com/?layoutUrl=https://example.com/layout.json"]}
      />,
    );

    // Then
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to load layout (HTTP 404)", {
        variant: "error",
      });
    });
  });

  it("should show error snackbar on network error", async () => {
    // Given
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    (parseAppURLState as jest.Mock).mockReturnValue({
      layoutUrl: "https://example.com/layout.json",
    });

    // When
    render(
      <Workspace
        deepLinks={["https://app.example.com/?layoutUrl=https://example.com/layout.json"]}
      />,
    );

    // Then
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to load layout from URL", {
        variant: "error",
      });
    });
  });

  it("should not fetch layout when layoutUrl is absent from URL state", () => {
    // Given
    global.fetch = jest.fn();
    (parseAppURLState as jest.Mock).mockReturnValue({
      ds: "remote-file",
      dsParams: { url: "https://example.com/file.mcap" },
    });

    // When
    render(<Workspace deepLinks={["https://app.example.com/?ds=remote-file"]} />);

    // Then
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should show error snackbar for malformed URL that cannot be parsed", async () => {
    // Given
    (parseAppURLState as jest.Mock).mockReturnValue({
      layoutUrl: "not a valid url ://",
    });

    // When
    render(<Workspace deepLinks={["https://app.example.com/?layoutUrl=not+a+valid+url"]} />);

    // Then
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Invalid layout URL", { variant: "error" });
    });
  });
});
