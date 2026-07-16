/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, render, screen, waitFor } from "@testing-library/react";
import React, { PropsWithChildren } from "react";

import type { IAppConfiguration, IDataSourceFactory, OsContext } from "@lichtblick/suite-base";
import type { Workspace } from "@lichtblick/suite-base/services/workspaces/IWorkspacesManager";

import type { CLIFlags, Desktop, NativeMenuBridge, Storage } from "../common/types";

// Records the props each mocked collaborator receives so tests can make behavior-focused assertions.
const mockAppSpy = jest.fn();
const mockWorkspacesProviderSpy = jest.fn();

// The mocked DesktopWorkspacesManager and NativeWindow expose their instances so tests can inspect
// the calls Root makes at runtime (the instances are created lazily inside `useMemo`).
type WorkspacesManagerInstance = {
  getCurrent: jest.Mock<Promise<Workspace | undefined>>;
  setCurrent: jest.Mock;
  list: jest.Mock;
  create: jest.Mock;
  rename: jest.Mock;
  delete: jest.Mock;
};
type NativeWindowInstance = {
  isMaximized: jest.Mock<boolean>;
  minimize: jest.Mock;
  maximize: jest.Mock;
  unmaximize: jest.Mock;
  close: jest.Mock;
  handleTitleBarDoubleClick: jest.Mock;
};
const mockWorkspacesManagerInstances: WorkspacesManagerInstance[] = [];
const mockNativeWindowInstances: NativeWindowInstance[] = [];

// Records DesktopExtensionLoader constructor args. A module-scope spy survives the isolated module
// registry created by `loadRoot`, so assertions see the calls Root actually made.
const mockDesktopExtensionLoaderSpy = jest.fn();

// Controls what the current workspacesManager instance resolves from getCurrent(). It is read at
// render time (after each test's beforeEach), so tests can swap the behavior mid-test.
let mockGetCurrentImpl: () => Promise<Workspace | undefined> = async () => undefined;

jest.mock("@lichtblick/suite-base", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const react = require("react");
  const factory = () => jest.fn();
  return {
    App: (props: unknown) => {
      mockAppSpy(props);
      return react.createElement("div", { "data-testid": "mock-app" });
    },
    WorkspacesProvider: (props: PropsWithChildren) => {
      mockWorkspacesProviderSpy(props);
      return react.createElement(react.Fragment, undefined, props.children);
    },
    AppSetting: { COLOR_SCHEME: "colorScheme", LANGUAGE: "language" },
    IdbExtensionLoader: jest.fn(),
    FoxgloveWebSocketDataSourceFactory: factory(),
    RosbridgeDataSourceFactory: factory(),
    Ros1SocketDataSourceFactory: factory(),
    Ros1LocalBagDataSourceFactory: factory(),
    Ros2LocalBagDataSourceFactory: factory(),
    UlogLocalDataSourceFactory: factory(),
    VelodyneDataSourceFactory: factory(),
    SampleNuscenesDataSourceFactory: factory(),
    McapLocalDataSourceFactory: factory(),
    RemoteDataSourceFactory: factory(),
  };
});

jest.mock("./services/DesktopWorkspacesManager", () => ({
  DesktopWorkspacesManager: jest.fn().mockImplementation(() => {
    const instance = {
      getCurrent: jest.fn(async () => await mockGetCurrentImpl()),
      setCurrent: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      rename: jest.fn(),
      delete: jest.fn(),
    };
    mockWorkspacesManagerInstances.push(instance);
    return instance;
  }),
}));

jest.mock("./services/DesktopExtensionLoader", () => ({
  DesktopExtensionLoader: jest.fn().mockImplementation((...args: unknown[]) => {
    mockDesktopExtensionLoaderSpy(...args);
  }),
}));

jest.mock("./services/DesktopLayoutLoader", () => ({
  DesktopLayoutLoader: jest.fn(),
}));

jest.mock("./services/NativeAppMenu", () => ({
  NativeAppMenu: jest.fn(),
}));

jest.mock("./services/NativeWindow", () => ({
  NativeWindow: jest.fn().mockImplementation(() => {
    const instance = {
      isMaximized: jest.fn(() => false),
      minimize: jest.fn(),
      maximize: jest.fn(),
      unmaximize: jest.fn(),
      close: jest.fn(),
      handleTitleBarDoubleClick: jest.fn(),
    };
    mockNativeWindowInstances.push(instance);
    return instance;
  }),
}));

type RootProps = {
  appParameters: CLIFlags;
  appConfiguration: IAppConfiguration;
  extraProviders: React.JSX.Element[] | undefined;
  dataSources: IDataSourceFactory[] | undefined;
};

// The mocked bridges expose plain `jest.Mock` members (rather than the real method signatures) so
// that assertions like `expect(bridge.method)` do not trip the `unbound-method` lint rule.
type MockAppConfiguration = {
  get: jest.Mock;
  set: jest.Mock;
  addChangeListener: jest.Mock;
  removeChangeListener: jest.Mock;
};
type MockDesktopBridge = {
  updateNativeColorScheme: jest.Mock;
  updateLanguage: jest.Mock;
  getDeepLinks: jest.Mock;
  addIpcEventListener: jest.Mock;
};

type GlobalBridges = {
  desktopBridge?: MockDesktopBridge;
  storageBridge?: Storage;
  menuBridge?: NativeMenuBridge;
  ctxbridge?: OsContext;
};

function setGlobals(bridges: GlobalBridges): void {
  const target = global as unknown as {
    desktopBridge?: Desktop;
    storageBridge?: Storage;
    menuBridge?: NativeMenuBridge;
    ctxbridge?: OsContext;
  };
  target.desktopBridge = bridges.desktopBridge as unknown as Desktop | undefined;
  target.storageBridge = bridges.storageBridge;
  target.menuBridge = bridges.menuBridge;
  target.ctxbridge = bridges.ctxbridge;
}

// Root reads the bridges from `global` at module-load time, so it MUST be required only after the
// globals are configured. Re-requiring inside `isolateModules` re-runs those module-level reads.
// We force the isolated module graph to reuse the outer React instance so that hooks share the same
// dispatcher as react-dom / @testing-library (otherwise a second React copy breaks all hooks).
const sharedReact = jest.requireActual("react");
function loadRoot(): React.ComponentType<RootProps> {
  let RootComponent: React.ComponentType<RootProps> | undefined;
  jest.isolateModules(() => {
    jest.doMock("react", () => sharedReact);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RootComponent = require("./Root").default as React.ComponentType<RootProps>;
  });
  if (!RootComponent) {
    throw new Error("Failed to load Root");
  }
  return RootComponent;
}

// Local, deterministic Workspace builder. The shared `WorkspaceBuilder` cannot be imported here
// because it depends on the ESM-only `@lichtblick/test-builders`, which is not part of the
// suite-desktop jest transform allowlist.
let workspaceCounter = 0;
function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  workspaceCounter += 1;
  return {
    id: `workspace-${workspaceCounter}`,
    name: `Workspace ${workspaceCounter}`,
    namespace: "local",
    ...overrides,
  };
}

function makeAppConfiguration(): MockAppConfiguration {
  return {
    get: jest.fn(),
    set: jest.fn(),
    addChangeListener: jest.fn(),
    removeChangeListener: jest.fn(),
  };
}

function makeDesktopBridge(): MockDesktopBridge {
  return {
    updateNativeColorScheme: jest.fn(async () => {}),
    updateLanguage: jest.fn(),
    getDeepLinks: jest.fn(() => []),
    addIpcEventListener: jest.fn(() => jest.fn()),
  };
}

type MakePropsOverrides = {
  appParameters?: CLIFlags;
  appConfiguration?: MockAppConfiguration;
  extraProviders?: React.JSX.Element[] | undefined;
  dataSources?: IDataSourceFactory[] | undefined;
};

function makeProps(overrides: MakePropsOverrides = {}): RootProps {
  const { appConfiguration = makeAppConfiguration(), ...rest } = overrides;
  return {
    appParameters: {},
    extraProviders: undefined,
    dataSources: undefined,
    ...rest,
    appConfiguration,
  };
}

function lastAppProps(): Record<string, unknown> {
  const call = mockAppSpy.mock.calls.at(-1);
  return (call?.[0] ?? {}) as Record<string, unknown>;
}

function lastWorkspacesProviderProps(): Record<string, unknown> {
  const call = mockWorkspacesProviderSpy.mock.calls.at(-1);
  return (call?.[0] ?? {}) as Record<string, unknown>;
}

let desktopBridge: MockDesktopBridge;

beforeEach(() => {
  mockAppSpy.mockClear();
  mockWorkspacesProviderSpy.mockClear();
  mockWorkspacesManagerInstances.length = 0;
  mockNativeWindowInstances.length = 0;
  mockDesktopExtensionLoaderSpy.mockClear();
  mockGetCurrentImpl = async () => undefined;

  desktopBridge = makeDesktopBridge();
  setGlobals({ desktopBridge, storageBridge: {} as Storage });

  // Root.tsx uses the classic JSX runtime without importing React, so it relies on a global React
  // binding (provided by the bundler in production). Supply it for the test environment.
  (globalThis as unknown as { React: typeof React }).React = React;

  // Reset the URL so deep-link tests start from a clean slate.
  window.history.pushState(undefined, "", "/");
});

afterEach(() => {
  setGlobals({});
});

describe("Root", () => {
  it("should throw when storageBridge is missing", () => {
    // GIVEN there is no storageBridge on the global scope
    setGlobals({ desktopBridge, storageBridge: undefined });
    const Root = loadRoot();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // WHEN rendering Root
    // THEN it throws a descriptive error
    expect(() => render(<Root {...makeProps()} />)).toThrow("storageBridge is missing");

    errorSpy.mockRestore();
  });

  it("should render nothing until the workspace selection resolves, then render the App", async () => {
    // GIVEN getCurrent resolves a workspace
    mockGetCurrentImpl = async () => makeWorkspace();
    const Root = loadRoot();

    // WHEN rendering Root
    const { container } = render(<Root {...makeProps()} />);

    // THEN nothing is rendered until initialization completes
    expect(mockAppSpy).not.toHaveBeenCalled();

    // THEN once the selection resolves the App is rendered
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });
    expect(container).toBeDefined();
  });

  it("should seed the current workspace id from workspacesManager.getCurrent", async () => {
    // GIVEN getCurrent resolves a known workspace
    const workspace = makeWorkspace({ namespace: "org" });
    mockGetCurrentImpl = async () => workspace;
    const Root = loadRoot();

    // WHEN rendering Root
    render(<Root {...makeProps()} />);

    // THEN both App and WorkspacesProvider receive the resolved workspace id
    await waitFor(() => {
      expect(lastAppProps().workspaceId).toBe(workspace.id);
    });
    expect(lastWorkspacesProviderProps().currentWorkspaceId).toBe(workspace.id);
  });

  it("should default the extension namespace to local when getCurrent resolves undefined", async () => {
    // GIVEN getCurrent resolves undefined
    mockGetCurrentImpl = async () => undefined;
    const Root = loadRoot();

    // WHEN rendering Root
    render(<Root {...makeProps()} />);

    // THEN App has no workspace id and the extension loader uses the "local" namespace
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });
    expect(lastAppProps().workspaceId).toBeUndefined();
    expect(mockDesktopExtensionLoaderSpy).toHaveBeenCalledWith(desktopBridge, "local");
  });

  it("should still initialize and log the error when getCurrent rejects on mount", async () => {
    // GIVEN getCurrent rejects
    mockGetCurrentImpl = async () => {
      throw new Error("boom");
    };
    const Root = loadRoot();
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // WHEN rendering Root
    render(<Root {...makeProps()} />);

    // THEN the App still renders (initialization completes via the finally block)
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });
    expect(lastAppProps().workspaceId).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to resolve the current workspace",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it("should register and react to color-scheme and language change listeners", async () => {
    // GIVEN a rendered Root
    const appConfiguration = makeAppConfiguration();
    const Root = loadRoot();
    const { unmount } = render(<Root {...makeProps({ appConfiguration })} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });

    // THEN change listeners are registered for both settings
    expect(appConfiguration.addChangeListener).toHaveBeenCalledWith(
      "colorScheme",
      expect.any(Function),
    );
    expect(appConfiguration.addChangeListener).toHaveBeenCalledWith(
      "language",
      expect.any(Function),
    );

    const colorSchemeHandler = appConfiguration.addChangeListener.mock.calls.find(
      ([key]) => key === "colorScheme",
    )?.[1];
    const languageHandler = appConfiguration.addChangeListener.mock.calls.find(
      ([key]) => key === "language",
    )?.[1];

    // WHEN the registered handlers fire
    colorSchemeHandler?.(undefined);
    languageHandler?.(undefined);

    // THEN the desktop bridge is notified
    expect(desktopBridge.updateNativeColorScheme).toHaveBeenCalledTimes(1);
    expect(desktopBridge.updateLanguage).toHaveBeenCalledTimes(1);

    // WHEN Root unmounts THEN the listeners are removed
    unmount();
    expect(appConfiguration.removeChangeListener).toHaveBeenCalledWith(
      "colorScheme",
      colorSchemeHandler,
    );
    expect(appConfiguration.removeChangeListener).toHaveBeenCalledWith("language", languageHandler);
  });

  it("should re-resolve the current workspace when onSwitchWorkspace is invoked", async () => {
    // GIVEN a rendered Root with an initial workspace
    const initial = makeWorkspace();
    const next = makeWorkspace();
    mockGetCurrentImpl = async () => initial;
    const Root = loadRoot();
    render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(lastAppProps().workspaceId).toBe(initial.id);
    });
    const manager = mockWorkspacesManagerInstances.at(-1)!;
    const getCurrentCallsBefore = manager.getCurrent.mock.calls.length;

    // WHEN the provider requests a workspace switch that resolves a new workspace
    mockGetCurrentImpl = async () => next;
    const onSwitchWorkspace = lastWorkspacesProviderProps().onSwitchWorkspace as () => void;
    await act(async () => {
      onSwitchWorkspace();
    });

    // THEN getCurrent is called again and App re-renders with the new workspace id
    expect(manager.getCurrent.mock.calls.length).toBeGreaterThan(getCurrentCallsBefore);
    await waitFor(() => {
      expect(lastAppProps().workspaceId).toBe(next.id);
    });
  });

  it("should not throw and should log when onSwitchWorkspace rejects", async () => {
    // GIVEN a rendered Root
    mockGetCurrentImpl = async () => makeWorkspace();
    const Root = loadRoot();
    render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // WHEN the switch handler rejects
    mockGetCurrentImpl = async () => {
      throw new Error("switch failed");
    };
    const onSwitchWorkspace = lastWorkspacesProviderProps().onSwitchWorkspace as () => void;

    // THEN it does not throw and logs the switch error
    await act(async () => {
      onSwitchWorkspace();
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to resolve the current workspace after switching",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });

  it("should use window.location.href as deep links when URL has active state", async () => {
    // GIVEN the window URL carries a `ds` param
    window.history.pushState(undefined, "", "/?ds=sample");
    const Root = loadRoot();

    // WHEN rendering Root
    render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });

    // THEN the deep links come from the current location and the bridge is not consulted
    expect(lastAppProps().deepLinks).toEqual([window.location.href]);
    expect(desktopBridge.getDeepLinks).not.toHaveBeenCalled();
  });

  it("should use desktopBridge.getDeepLinks when the URL has no active state", async () => {
    // GIVEN no `ds` or `layoutId` params and the bridge provides deep links
    const bridgeLinks = ["lichtblick://open?foo=bar"];
    desktopBridge.getDeepLinks.mockReturnValue(bridgeLinks);
    const Root = loadRoot();

    // WHEN rendering Root
    render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });

    // THEN the deep links come from the desktop bridge
    expect(desktopBridge.getDeepLinks).toHaveBeenCalledTimes(1);
    expect(lastAppProps().deepLinks).toEqual(bridgeLinks);
  });

  it("should pass through the provided data sources verbatim", async () => {
    // GIVEN explicit data sources
    const dataSources = [{ id: "custom" } as unknown as IDataSourceFactory];
    const Root = loadRoot();

    // WHEN rendering Root
    render(<Root {...makeProps({ dataSources })} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });

    // THEN App receives exactly those data sources
    expect(lastAppProps().dataSources).toBe(dataSources);
  });

  it("should build the default data sources when none are provided", async () => {
    // GIVEN no explicit data sources
    const Root = loadRoot();

    // WHEN rendering Root
    render(<Root {...makeProps({ dataSources: undefined })} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });

    // THEN App receives the full set of default factory instances
    const dataSources = lastAppProps().dataSources as IDataSourceFactory[];
    expect(Array.isArray(dataSources)).toBe(true);
    expect(dataSources).toHaveLength(10);
  });

  it("should wire window controls and IPC listeners and clean them up on unmount", async () => {
    // GIVEN a rendered Root
    const Root = loadRoot();
    const { unmount } = render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });
    const nativeWindow = mockNativeWindowInstances.at(-1)!;
    const props = lastAppProps();

    // THEN the maximized state comes from the native window
    expect(props.isMaximized).toBe(false);
    expect(nativeWindow.isMaximized).toHaveBeenCalled();

    // WHEN each window control callback fires THEN the native window method is invoked
    (props.onMinimizeWindow as () => void)();
    (props.onMaximizeWindow as () => void)();
    (props.onUnmaximizeWindow as () => void)();
    (props.onCloseWindow as () => void)();
    (props.onAppBarDoubleClick as () => void)();
    expect(nativeWindow.minimize).toHaveBeenCalledTimes(1);
    expect(nativeWindow.maximize).toHaveBeenCalledTimes(1);
    expect(nativeWindow.unmaximize).toHaveBeenCalledTimes(1);
    expect(nativeWindow.close).toHaveBeenCalledTimes(1);
    expect(nativeWindow.handleTitleBarDoubleClick).toHaveBeenCalledTimes(1);

    // THEN IPC listeners are registered for the window events
    const registeredEvents = desktopBridge.addIpcEventListener.mock.calls.map(([event]) => event);
    expect(registeredEvents).toEqual(
      expect.arrayContaining(["enter-full-screen", "leave-full-screen", "maximize", "unmaximize"]),
    );

    // WHEN Root unmounts THEN every returned unregister callback is invoked
    const unregisterFns = desktopBridge.addIpcEventListener.mock.results.map(
      (result) => result.value as jest.Mock,
    );
    unmount();
    for (const unregister of unregisterFns) {
      expect(unregister).toHaveBeenCalledTimes(1);
    }
  });

  it("should set appBarLeftInset to 72 on darwin and clear it in full screen", async () => {
    // GIVEN the platform is darwin
    setGlobals({
      desktopBridge,
      storageBridge: {} as Storage,
      ctxbridge: { platform: "darwin" } as OsContext,
    });
    const Root = loadRoot();
    render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });

    // THEN the macOS traffic-light inset is applied
    expect(lastAppProps().appBarLeftInset).toBe(72);

    // WHEN an enter-full-screen event is received
    const enterFullScreen = desktopBridge.addIpcEventListener.mock.calls.find(
      ([event]) => event === "enter-full-screen",
    )?.[1];
    await act(async () => {
      enterFullScreen?.();
    });

    // THEN the inset is cleared while full screen
    expect(lastAppProps().appBarLeftInset).toBeUndefined();
  });

  it("should leave appBarLeftInset undefined on non-darwin platforms", async () => {
    // GIVEN a non-darwin platform
    setGlobals({
      desktopBridge,
      storageBridge: {} as Storage,
      ctxbridge: { platform: "linux" } as OsContext,
    });
    const Root = loadRoot();

    // WHEN rendering Root
    render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });

    // THEN no inset is applied
    expect(lastAppProps().appBarLeftInset).toBeUndefined();
  });

  it("should reflect maximize IPC events in the App isMaximized prop", async () => {
    // GIVEN a rendered Root
    const Root = loadRoot();
    render(<Root {...makeProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-app")).toBeDefined();
    });
    expect(lastAppProps().isMaximized).toBe(false);

    // WHEN a maximize IPC event is received
    const maximize = desktopBridge.addIpcEventListener.mock.calls.find(
      ([event]) => event === "maximize",
    )?.[1];
    await act(async () => {
      maximize?.();
    });

    // THEN the App reflects the maximized state
    expect(lastAppProps().isMaximized).toBe(true);
  });
});
