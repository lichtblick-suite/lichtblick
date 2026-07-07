// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMountedState } from "react-use";

import {
  App,
  AppSetting,
  FoxgloveWebSocketDataSourceFactory,
  IAppConfiguration,
  IDataSourceFactory,
  IdbExtensionLoader,
  McapLocalDataSourceFactory,
  OsContext,
  RemoteDataSourceFactory,
  Ros1LocalBagDataSourceFactory,
  Ros1SocketDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  RosbridgeDataSourceFactory,
  SampleNuscenesDataSourceFactory,
  UlogLocalDataSourceFactory,
  VelodyneDataSourceFactory,
  Workspace,
  WorkspacesProvider,
} from "@lichtblick/suite-base";

import { DesktopExtensionLoader } from "./services/DesktopExtensionLoader";
import { DesktopLayoutLoader } from "./services/DesktopLayoutLoader";
import { DesktopWorkspacesManager } from "./services/DesktopWorkspacesManager";
import { NativeAppMenu } from "./services/NativeAppMenu";
import { NativeWindow } from "./services/NativeWindow";
import { CLIFlags, Desktop, NativeMenuBridge, Storage } from "../common/types";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;
const storageBridge = (global as unknown as { storageBridge?: Storage }).storageBridge;
const menuBridge = (global as { menuBridge?: NativeMenuBridge }).menuBridge;
const ctxbridge = (global as { ctxbridge?: OsContext }).ctxbridge;

type RootProps = {
  appParameters: CLIFlags;
  appConfiguration: IAppConfiguration;
  extraProviders: React.JSX.Element[] | undefined;
  dataSources: IDataSourceFactory[] | undefined;
};

export default function Root(props: RootProps): React.JSX.Element {
  if (!storageBridge) {
    throw new Error("storageBridge is missing");
  }
  const { appConfiguration, appParameters, extraProviders } = props;

  useEffect(() => {
    const handler = () => {
      void desktopBridge.updateNativeColorScheme();
    };

    appConfiguration.addChangeListener(AppSetting.COLOR_SCHEME, handler);
    return () => {
      appConfiguration.removeChangeListener(AppSetting.COLOR_SCHEME, handler);
    };
  }, [appConfiguration]);

  useEffect(() => {
    const handler = () => {
      desktopBridge.updateLanguage();
    };
    appConfiguration.addChangeListener(AppSetting.LANGUAGE, handler);
    return () => {
      appConfiguration.removeChangeListener(AppSetting.LANGUAGE, handler);
    };
  }, [appConfiguration]);

  const workspacesManager = useMemo(() => new DesktopWorkspacesManager(desktopBridge), []);
  const isMounted = useMountedState();

  // Active workspace drives the keyed remount of the workspace-scoped provider subtree (B1).
  // It is seeded once from the persisted selection; an undefined workspace uses the legacy folders.
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | undefined>(undefined);
  const [workspaceInitialized, setWorkspaceInitialized] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const workspace = await workspacesManager.getCurrent();
        if (isMounted()) {
          setCurrentWorkspace(workspace);
        }
      } catch (err: unknown) {
        console.error("Failed to resolve the current workspace", err);
      } finally {
        if (isMounted()) {
          setWorkspaceInitialized(true);
        }
      }
    })();
  }, [workspacesManager, isMounted]);

  const workspaceId = currentWorkspace?.id;
  const workspaceNamespace = currentWorkspace?.namespace ?? "local";

  const handleSwitchWorkspace = useCallback(() => {
    void (async () => {
      try {
        const workspace = await workspacesManager.getCurrent();
        if (isMounted()) {
          setCurrentWorkspace(workspace);
        }
      } catch (err: unknown) {
        console.error("Failed to resolve the current workspace after switching", err);
      }
    })();
  }, [workspacesManager, isMounted]);

  const extensionLoaders = useMemo(
    () => [
      new IdbExtensionLoader("org"),
      new DesktopExtensionLoader(desktopBridge, workspaceNamespace),
    ],
    [workspaceNamespace],
  );

  const layoutLoaders = useMemo(() => [new DesktopLayoutLoader(desktopBridge)], []);

  const nativeAppMenu = useMemo(() => new NativeAppMenu(menuBridge), []);
  const nativeWindow = useMemo(() => new NativeWindow(desktopBridge), []);

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    if (props.dataSources) {
      return props.dataSources;
    }

    const sources = [
      new FoxgloveWebSocketDataSourceFactory(),
      new RosbridgeDataSourceFactory(),
      new Ros1SocketDataSourceFactory(),
      new Ros1LocalBagDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new VelodyneDataSourceFactory(),
      new SampleNuscenesDataSourceFactory(),
      new McapLocalDataSourceFactory(),
      new RemoteDataSourceFactory(),
    ];

    return sources;
  }, [props.dataSources]);

  // App url state in window.location will represent the user's current session state
  // better than the initial deep link so we prioritize the current window.location
  // url for startup state. This persists state across user-initiated refreshes.
  const [deepLinks] = useState(() => {
    // We treat presence of the `ds` or `layoutId` params as indicative of active state.
    const windowUrl = new URL(window.location.href);
    const hasActiveURLState =
      windowUrl.searchParams.has("ds") || windowUrl.searchParams.has("layoutId");
    return hasActiveURLState ? [window.location.href] : desktopBridge.getDeepLinks();
  });

  const [isFullScreen, setFullScreen] = useState(false);
  const [isMaximized, setMaximized] = useState(nativeWindow.isMaximized());

  const onMinimizeWindow = useCallback(() => {
    nativeWindow.minimize();
  }, [nativeWindow]);
  const onMaximizeWindow = useCallback(() => {
    nativeWindow.maximize();
  }, [nativeWindow]);
  const onUnmaximizeWindow = useCallback(() => {
    nativeWindow.unmaximize();
  }, [nativeWindow]);
  const onCloseWindow = useCallback(() => {
    nativeWindow.close();
  }, [nativeWindow]);

  useEffect(() => {
    const unregisterFull = desktopBridge.addIpcEventListener("enter-full-screen", () => {
      setFullScreen(true);
    });
    const unregisterLeave = desktopBridge.addIpcEventListener("leave-full-screen", () => {
      setFullScreen(false);
    });
    const unregisterMax = desktopBridge.addIpcEventListener("maximize", () => {
      setMaximized(true);
    });
    const unregisterUnMax = desktopBridge.addIpcEventListener("unmaximize", () => {
      setMaximized(false);
    });
    return () => {
      unregisterFull();
      unregisterLeave();
      unregisterMax();
      unregisterUnMax();
    };
  }, []);

  // Wait for the persisted workspace selection to resolve before mounting the workspace-scoped
  // subtree so users with an active workspace do not briefly mount the legacy folders first.
  if (!workspaceInitialized) {
    return <></>;
  }

  return (
    <WorkspacesProvider
      manager={workspacesManager}
      currentWorkspaceId={workspaceId}
      onSwitchWorkspace={handleSwitchWorkspace}
    >
      <App
        appParameters={appParameters}
        deepLinks={deepLinks}
        dataSources={dataSources}
        appConfiguration={appConfiguration}
        extensionLoaders={extensionLoaders}
        layoutLoaders={layoutLoaders}
        workspaceId={workspaceId}
        nativeAppMenu={nativeAppMenu}
        nativeWindow={nativeWindow}
        enableGlobalCss
        appBarLeftInset={ctxbridge?.platform === "darwin" && !isFullScreen ? 72 : undefined}
        onAppBarDoubleClick={() => {
          nativeWindow.handleTitleBarDoubleClick();
        }}
        isMaximized={isMaximized}
        onMinimizeWindow={onMinimizeWindow}
        onMaximizeWindow={onMaximizeWindow}
        onUnmaximizeWindow={onUnmaximizeWindow}
        onCloseWindow={onCloseWindow}
        extraProviders={extraProviders}
      />
    </WorkspacesProvider>
  );
}
