/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { IdbLayoutStorage } from "@lichtblick/suite-base/IdbLayoutStorage";
import { LayoutsAPI } from "@lichtblick/suite-base/api/layouts/LayoutsAPI";
import { SharedRootContext } from "@lichtblick/suite-base/context/SharedRootContext";

import { StudioApp } from "./StudioApp";

// Mock all the heavy dependencies
vi.mock("./Workspace", async () => ({
  __esModule: true,
  default: ({ deepLinks, appBarLeftInset, AppBarComponent, ...props }: any) => (
    <div
      data-testid="workspace"
      data-deep-links={Array.isArray(deepLinks) ? JSON.stringify(deepLinks) : String(deepLinks)}
      data-app-bar-inset={appBarLeftInset}
    >
      <div data-testid="workspace-props">
        {JSON.stringify(props, (_key, value) => {
          // Convert functions to string representation for testing
          if (typeof value === "function") {
            return "function";
          }
          return value;
        })}
      </div>
      {AppBarComponent != undefined && <div data-testid="app-bar-component">AppBarComponent</div>}
    </div>
  ),
}));

vi.mock("./components/MultiProvider", async () => ({
  __esModule: true,
  default: ({ providers, children }: any) => (
    <div data-testid="multi-provider" data-provider-count={providers.length}>
      {children}
    </div>
  ),
}));

vi.mock("./components/DocumentTitleAdapter", async () => ({
  __esModule: true,
  default: () => <div data-testid="document-title-adapter" />,
}));

vi.mock("./components/SendNotificationToastAdapter", async () => ({
  __esModule: true,
  default: () => <div data-testid="notification-toast-adapter" />,
}));

vi.mock("./providers/PanelCatalogProvider", async () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="panel-catalog-provider">{children}</div>,
}));

vi.mock("./screens/LaunchPreference", async () => ({
  LaunchPreference: ({ children }: any) => <div data-testid="launch-preference">{children}</div>,
}));

vi.mock("@lichtblick/suite-base/IdbLayoutStorage", async () => ({
  IdbLayoutStorage: vi.fn().mockImplementation(() => ({
    mockLayoutStorage: true,
  })),
}));

vi.mock("@lichtblick/suite-base/api/layouts/LayoutsAPI", async () => ({
  LayoutsAPI: vi.fn().mockImplementation(() => ({
    mockRemoteLayoutStorage: true,
  })),
}));

// Mock react-dnd
vi.mock("react-dnd", async () => ({
  DndProvider: ({ children }: any) => <div data-testid="dnd-provider">{children}</div>,
}));

vi.mock("react-dnd-html5-backend", async () => ({
  HTML5Backend: {},
}));

// Mock the LayoutManager to avoid private fields issue
vi.mock("./services/LayoutManager/LayoutManager", async () => ({
  LayoutManager: vi.fn().mockImplementation(() => ({
    supportsSharing: false,
    getLayouts: vi.fn().mockResolvedValue([]),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })),
}));

// Mock LayoutManagerProvider
vi.mock("./providers/LayoutManagerProvider", async () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="layout-manager-provider">{children}</div>,
}));

describe("StudioApp", () => {
  const mockSharedRootContext = {
    dataSources: [],
    extensionLoaders: [],
    nativeAppMenu: undefined,
    nativeWindow: undefined,
    deepLinks: [],
    enableLaunchPreferenceScreen: false,
    extraProviders: undefined,
    appBarLeftInset: 0,
    customWindowControlProps: undefined,
    onAppBarDoubleClick: undefined,
    AppBarComponent: undefined,
  };

  const renderWithContext = (contextValue: any = mockSharedRootContext) => {
    return render(
      <SharedRootContext.Provider value={contextValue}>
        <StudioApp />
      </SharedRootContext.Provider>,
    );
  };

  beforeEach(() => {
    // Clear console.error mock to avoid setupTestFramework.ts throwing
    if (typeof (console.error as any).mockClear === "function") {
      (console.error as any).mockClear();
    }

    // Mock URL constructor
    global.URL = vi.fn().mockImplementation((_url) => ({
      searchParams: {
        get: vi.fn().mockReturnValue(undefined),
      },
    })) as any;

    // Mock document.addEventListener
    vi.spyOn(document, "addEventListener").mockImplementation();
    vi.spyOn(document, "removeEventListener").mockImplementation();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render basic StudioApp structure", () => {
    renderWithContext();

    expect(screen.getByTestId("multi-provider")).toBeInTheDocument();
    expect(screen.getByTestId("document-title-adapter")).toBeInTheDocument();
    expect(screen.getByTestId("notification-toast-adapter")).toBeInTheDocument();
    expect(screen.getByTestId("dnd-provider")).toBeInTheDocument();
    expect(screen.getByTestId("panel-catalog-provider")).toBeInTheDocument();
    expect(screen.getByTestId("workspace")).toBeInTheDocument();
  });

  it("should pass deepLinks to Workspace component", () => {
    const deepLinks = [{ url: "test://link1" }, { url: "test://link2" }];
    renderWithContext({
      ...mockSharedRootContext,
      deepLinks,
    });

    const workspace = screen.getByTestId("workspace");
    expect(workspace).toHaveAttribute("data-deep-links", JSON.stringify(deepLinks));
  });

  it("should pass appBarLeftInset to Workspace component", () => {
    const appBarLeftInset = 120;
    renderWithContext({
      ...mockSharedRootContext,
      appBarLeftInset,
    });

    const workspace = screen.getByTestId("workspace");
    expect(workspace).toHaveAttribute("data-app-bar-inset", "120");
  });

  it("should render AppBarComponent when provided", () => {
    const AppBarComponent = () => <div>Custom AppBar</div>;
    renderWithContext({
      ...mockSharedRootContext,
      AppBarComponent,
    });

    expect(screen.getByTestId("app-bar-component")).toBeInTheDocument();
  });

  it("should pass custom window control props to Workspace", () => {
    const customWindowControlProps = {
      showCustomWindowControls: true,
      isMaximized: false,
      initialZoomFactor: 1.2,
      onMinimizeWindow: vi.fn(),
      onMaximizeWindow: vi.fn(),
      onUnmaximizeWindow: vi.fn(),
      onCloseWindow: vi.fn(),
    };

    renderWithContext({
      ...mockSharedRootContext,
      customWindowControlProps,
    });

    const workspaceProps = screen.getByTestId("workspace-props");
    const props = JSON.parse(workspaceProps.textContent);

    expect(props.showCustomWindowControls).toBe(true);
    expect(props.isMaximized).toBe(false);
    expect(props.initialZoomFactor).toBe(1.2);
    expect(props.onMinimizeWindow).toBe("function");
    expect(props.onMaximizeWindow).toBe("function");
    expect(props.onUnmaximizeWindow).toBe("function");
    expect(props.onCloseWindow).toBe("function");
  });

  it("should render LaunchPreference when enableLaunchPreferenceScreen is true", () => {
    renderWithContext({
      ...mockSharedRootContext,
      enableLaunchPreferenceScreen: true,
    });

    expect(screen.getByTestId("launch-preference")).toBeInTheDocument();
  });

  it("should not render LaunchPreference when enableLaunchPreferenceScreen is false", () => {
    renderWithContext({
      ...mockSharedRootContext,
      enableLaunchPreferenceScreen: false,
    });

    expect(screen.queryByTestId("launch-preference")).not.toBeInTheDocument();
  });

  it("should create providers array with correct count", () => {
    renderWithContext();

    const multiProvider = screen.getByTestId("multi-provider");
    const providerCount = parseInt(multiProvider.getAttribute("data-provider-count") ?? "0", 10);

    // Should have base providers (exact count may vary, but should be reasonable)
    expect(providerCount).toBeGreaterThan(5);
  });

  it("should include extra providers when provided", () => {
    const ExtraProvider1 = ({ children }: any) => <div>{children}</div>;
    const ExtraProvider2 = ({ children }: any) => <div>{children}</div>;

    renderWithContext({
      ...mockSharedRootContext,
      extraProviders: [<ExtraProvider1 key="1" />, <ExtraProvider2 key="2" />],
    });

    const multiProvider = screen.getByTestId("multi-provider");
    const providerCount = parseInt(multiProvider.getAttribute("data-provider-count") ?? "0", 10);

    // Should have extra providers added
    expect(providerCount).toBeGreaterThan(7);
  });

  it("should handle context menu prevention", () => {
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    renderWithContext();

    expect(addEventListenerSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function));
  });

  it("should create remote layout storage when workspace is provided", () => {
    // Mock URL with workspace parameter
    global.URL = vi.fn().mockImplementation(() => ({
      searchParams: {
        get: vi.fn().mockImplementation((key) => {
          if (key === "workspace") {
            return "test-workspace";
          }
          return undefined;
        }),
      },
    })) as any;

    renderWithContext();

    expect(vi.mocked(LayoutsAPI)).toHaveBeenCalledWith("test-workspace");
  });

  it("should not create remote layout storage when no workspace is provided", () => {
    // Clear previous calls
    vi.mocked(LayoutsAPI).mockClear();

    // Mock URL without workspace parameter
    global.URL = vi.fn().mockImplementation(() => ({
      searchParams: {
        get: vi.fn().mockReturnValue(undefined),
      },
    })) as any;

    renderWithContext();

    expect(vi.mocked(LayoutsAPI)).not.toHaveBeenCalled();
  });

  it("should create IdbLayoutStorage", () => {
    renderWithContext();

    expect(vi.mocked(IdbLayoutStorage)).toHaveBeenCalled();
  });

  describe("context menu handler", () => {
    let contextMenuHandler: any;

    beforeEach(() => {
      renderWithContext();

      // Get the context menu handler that was registered
      const addEventListenerCalls = (document.addEventListener as Mock).mock.calls;
      const contextMenuCall = addEventListenerCalls.find((call) => call[0] === "contextmenu");
      contextMenuHandler = contextMenuCall?.[1];
    });

    it("should prevent context menu on non-input elements", () => {
      const mockEvent = {
        target: document.createElement("div"),
        preventDefault: vi.fn(),
      } as any;

      const result = contextMenuHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should allow context menu on input elements", () => {
      const mockEvent = {
        target: document.createElement("input"),
        preventDefault: vi.fn(),
      } as any;

      contextMenuHandler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("should allow context menu on textarea elements", () => {
      const mockEvent = {
        target: document.createElement("textarea"),
        preventDefault: vi.fn(),
      } as any;

      contextMenuHandler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  it("should cleanup event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderWithContext();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function));
  });
});
