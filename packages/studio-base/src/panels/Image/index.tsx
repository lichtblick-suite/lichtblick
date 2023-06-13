// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert, Link } from "@mui/material";
import { StrictMode, useCallback, useContext, useMemo } from "react";
import ReactDOM from "react-dom";
import { useLatest } from "react-use";

import { filterMap } from "@foxglove/den/collection";
import { useCrash } from "@foxglove/hooks";
import { PanelExtensionContext } from "@foxglove/studio";
import { CaptureErrorBoundary } from "@foxglove/studio-base/components/CaptureErrorBoundary";
import {
  ForwardAnalyticsContextProvider,
  ForwardedAnalytics,
  useForwardAnalytics,
} from "@foxglove/studio-base/components/ForwardAnalyticsContextProvider";
import { useMessagePipelineGetter } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import { PanelExtensionAdapter } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import Stack from "@foxglove/studio-base/components/Stack";
import { CAMERA_CALIBRATION_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/foxglove";
import { getTopicMatchPrefix } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/topicPrefixMatching";
import { CAMERA_INFO_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/ros";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { defaultConfig, ImageView } from "./ImageView";
import { Config } from "./types";

function initPanel(
  crash: ReturnType<typeof useCrash>,
  forwardedAnalytics: ForwardedAnalytics,
  context: PanelExtensionContext,
) {
  ReactDOM.render(
    <StrictMode>
      <CaptureErrorBoundary onError={crash}>
        <ForwardAnalyticsContextProvider forwardedAnalytics={forwardedAnalytics}>
          <ImageView context={context} />
        </ForwardAnalyticsContextProvider>
      </CaptureErrorBoundary>
    </StrictMode>,
    context.panelElement,
  );
  return () => {
    ReactDOM.unmountComponentAtNode(context.panelElement);
  };
}

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

function ImagePanelAdapter(props: Props) {
  const { saveConfig } = props;
  const crash = useCrash();
  const forwardedAnalytics = useForwardAnalytics();
  const boundInitPanel = useMemo(
    () => initPanel.bind(undefined, crash, forwardedAnalytics),
    [crash, forwardedAnalytics],
  );

  const closedBanner = props.config.closedDeprecationBanner === true;
  const onCloseBanner = useCallback(() => {
    saveConfig({ closedDeprecationBanner: true });
  }, [saveConfig]);
  const panelContext = useContext(PanelContext);
  const latestConfig = useLatest(props.config);
  const getMessagePipelineContext = useMessagePipelineGetter();

  const deprecationBanner = closedBanner ? undefined : (
    <Alert severity="info" color="warning" onClose={onCloseBanner}>
      The Image (Legacy) panel is now deprecated.{" "}
      <Link
        color="inherit"
        onClick={(event) => {
          const { sortedTopics } = getMessagePipelineContext();
          const prefix = getTopicMatchPrefix(latestConfig.current.cameraTopic);
          const calibrationSchemas = new Set([
            ...CAMERA_INFO_DATATYPES,
            ...CAMERA_CALIBRATION_DATATYPES,
          ]);
          const calibrationTopic =
            prefix == undefined
              ? undefined
              : sortedTopics.find(
                  (topic) =>
                    topic.schemaName != undefined &&
                    calibrationSchemas.has(topic.schemaName) &&
                    topic.name.startsWith(prefix),
                )?.name;

          event.stopPropagation(); // prevent click from re-selecting old panel after it's replaced
          panelContext?.replacePanel("Image", {
            imageMode: {
              imageTopic: latestConfig.current.cameraTopic,
              calibrationTopic,
              synchronize: latestConfig.current.synchronize,
              rotation: latestConfig.current.rotation,
              flipHorizontal: latestConfig.current.flipHorizontal,
              flipVertical: latestConfig.current.flipVertical,
              minValue: latestConfig.current.minValue,
              maxValue: latestConfig.current.maxValue,
              annotations: Object.fromEntries(
                filterMap(latestConfig.current.enabledMarkerTopics, (topicName) => {
                  const topic = sortedTopics.find((t) => t.name === topicName);
                  if (topic?.schemaName != undefined) {
                    return [topicName, { visible: true }];
                  }
                  return undefined;
                }),
              ),
            },
          });
        }}
      >
        Upgrade to the new Image panel
      </Link>
      .
    </Alert>
  );

  return (
    <Stack fullHeight>
      <PanelExtensionAdapter
        config={props.config}
        saveConfig={props.saveConfig}
        initPanel={boundInitPanel}
        highestSupportedConfigVersion={1}
      >
        {deprecationBanner}
      </PanelExtensionAdapter>
    </Stack>
  );
}

ImagePanelAdapter.panelType = "ImageViewPanel";
ImagePanelAdapter.defaultConfig = defaultConfig;

export default Panel(ImagePanelAdapter);
