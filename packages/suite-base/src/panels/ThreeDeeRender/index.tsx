// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useSnackbar } from "notistack";
import { useMemo } from "react";

import { CameraModelsMap } from "@lichtblick/den/image/types";
import { useCrash } from "@lichtblick/hooks";
import { CaptureErrorBoundary } from "@lichtblick/suite-base/components/CaptureErrorBoundary";
import {
  ForwardAnalyticsContextProvider,
  useForwardAnalytics,
} from "@lichtblick/suite-base/components/ForwardAnalyticsContextProvider";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import {
  BuiltinPanelExtensionContext,
  PanelExtensionAdapter,
} from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { INJECTED_FEATURE_KEYS, useAppContext } from "@lichtblick/suite-base/context/AppContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { createSyncRoot } from "@lichtblick/suite-base/panels/createSyncRoot";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { ThreeDeeRender } from "./ThreeDeeRender";
import { InitPanelArgs, InterfaceMode } from "./types";

function initPanel(args: InitPanelArgs, context: BuiltinPanelExtensionContext) {
  const {
    crash,
    forwardedAnalytics,
    interfaceMode,
    testOptions,
    customSceneExtensions,
    customCameraModels,
    enqueueSnackbarFromParent,
    logError,
  } = args;
  return createSyncRoot(
    <CaptureErrorBoundary onError={crash}>
      <ForwardAnalyticsContextProvider forwardedAnalytics={forwardedAnalytics}>
        <ThreeDeeRender
          context={context}
          interfaceMode={interfaceMode}
          testOptions={testOptions}
          customSceneExtensions={customSceneExtensions}
          customCameraModels={customCameraModels}
          enqueueSnackbarFromParent={enqueueSnackbarFromParent}
          logError={logError}
        />
      </ForwardAnalyticsContextProvider>
    </CaptureErrorBoundary>,
    context.panelElement,
  );
}

type Props = {
  config: Record<string, unknown>;
  saveConfig: SaveConfig<Record<string, unknown>>;
  onDownloadImage?: (blob: Blob, fileName: string) => void;
  debugPicking?: boolean;
};

function ThreeDeeRenderAdapter(interfaceMode: InterfaceMode, props: Props) {
  const crash = useCrash();
  const { enqueueSnackbar } = useSnackbar();
  const panelContext = React.useContext(PanelContext);

  const customCameraModels = useExtensionCatalog(
    (state) => state.installedCameraModels,
  ) as CameraModelsMap;

  const forwardedAnalytics = useForwardAnalytics();
  const { injectedFeatures } = useAppContext();
  const customSceneExtensions = useMemo(() => {
    if (injectedFeatures == undefined) {
      return undefined;
    }
    const injectedSceneExtensions =
      injectedFeatures.availableFeatures[INJECTED_FEATURE_KEYS.customSceneExtensions]
        ?.customSceneExtensions;
    return injectedSceneExtensions;
  }, [injectedFeatures]);

  const boundInitPanel = useMemo(
    () =>
      initPanel.bind(undefined, {
        crash,
        forwardedAnalytics,
        interfaceMode,
        testOptions: {
          onDownloadImage: props.onDownloadImage,
          debugPicking: props.debugPicking,
        },
        customSceneExtensions,
        customCameraModels,
        enqueueSnackbarFromParent: (
          message: string,
          variant?: "default" | "error" | "success" | "warning" | "info",
        ) => {
          enqueueSnackbar(message, { variant: variant ?? "default" });
        },
        logError: panelContext?.logError,
      }),
    [
      crash,
      forwardedAnalytics,
      interfaceMode,
      props.onDownloadImage,
      props.debugPicking,
      customSceneExtensions,
      customCameraModels,
      enqueueSnackbar,
      panelContext?.logError,
    ],
  );

  return (
    <PanelExtensionAdapter
      config={props.config}
      highestSupportedConfigVersion={1}
      saveConfig={props.saveConfig}
      initPanel={boundInitPanel}
    />
  );
}

/**
 * The Image panel is a special case of the 3D panel with `interfaceMode` set to `"image"`.
 */
export const ImagePanel = Panel<Record<string, unknown>, Props>(
  Object.assign(ThreeDeeRenderAdapter.bind(undefined, "image"), {
    panelType: "Image",
    defaultConfig: {},
  }),
);

export default Panel(
  Object.assign(ThreeDeeRenderAdapter.bind(undefined, "3d"), {
    panelType: "3D",
    defaultConfig: {},
  }),
);
