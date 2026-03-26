/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import {
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@lichtblick/suite-base/components/MessagePipeline";
import Sidebars from "@lichtblick/suite-base/components/Sidebars";
import { SidebarItem } from "@lichtblick/suite-base/components/Sidebars/types";
import { useAlertsActions } from "@lichtblick/suite-base/context/AlertsContext";
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
  default: { getLogger: () => ({ debug: jest.fn() }) },
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
}));
jest.mock("@lichtblick/suite-base/context/CurrentUserContext", () => ({
  useCurrentUser: jest.fn(),
  useCurrentUserType: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/AlertsContext", () => ({
  useAlertsActions: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/context/EventsContext", () => ({
  useEvents: jest.fn(),
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
    (useAlertsActions as jest.Mock).mockReturnValue({ clearAlerts: jest.fn() });
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
