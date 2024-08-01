// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCrash } from "@lichtblick/hooks";
import { CaptureErrorBoundary } from "@lichtblick/studio-base/components/CaptureErrorBoundary";
import {
  ForwardAnalyticsContextProvider,
  ForwardedAnalytics,
  useForwardAnalytics,
} from "@lichtblick/studio-base/components/ForwardAnalyticsContextProvider";
import Panel from "@lichtblick/studio-base/components/Panel";
import {
  BuiltinPanelExtensionContext,
  PanelExtensionAdapter,
} from "@lichtblick/studio-base/components/PanelExtensionAdapter";
import { INJECTED_FEATURE_KEYS, useAppContext } from "@lichtblick/studio-base/context/AppContext";
import { TestOptions } from "@lichtblick/studio-base/panels/ThreeDeeRender/IRenderer";
import { createSyncRoot } from "@lichtblick/studio-base/panels/createSyncRoot";
import { SaveConfig } from "@lichtblick/studio-base/types/panels";
import { StrictMode, useMemo } from "react";
import { DeepPartial } from "ts-essentials";

import { SceneExtensionConfig } from "./SceneExtensionConfig";
import { ThreeDeeRender } from "./ThreeDeeRender";
import { InterfaceMode } from "./types";

type InitPanelArgs = {
  crash: ReturnType<typeof useCrash>;
  forwardedAnalytics: ForwardedAnalytics;
  interfaceMode: InterfaceMode;
  testOptions: TestOptions;
  customSceneExtensions?: DeepPartial<SceneExtensionConfig>;
};

function initPanel(args: InitPanelArgs, context: BuiltinPanelExtensionContext) {
  const { crash, forwardedAnalytics, interfaceMode, testOptions, customSceneExtensions } = args;
  return createSyncRoot(
    <StrictMode>
      <CaptureErrorBoundary onError={crash}>
        <ForwardAnalyticsContextProvider forwardedAnalytics={forwardedAnalytics}>
          <ThreeDeeRender
            context={context}
            interfaceMode={interfaceMode}
            testOptions={testOptions}
            customSceneExtensions={customSceneExtensions}
          />
        </ForwardAnalyticsContextProvider>
      </CaptureErrorBoundary>
    </StrictMode>,
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
        testOptions: { onDownloadImage: props.onDownloadImage, debugPicking: props.debugPicking },
        customSceneExtensions,
      }),
    [
      crash,
      forwardedAnalytics,
      interfaceMode,
      props.onDownloadImage,
      props.debugPicking,
      customSceneExtensions,
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
