// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { uniq, omit, debounce } from "lodash";
import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";

import { CameraState } from "@foxglove/regl-worldview";
import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import Layout from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/Layout";
import helpContent from "@foxglove/studio-base/panels/ThreeDimensionalViz/index.help.md";
import {
  useTransformedCameraState,
  getNewCameraStateOnFollowChange,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { ThreeDimensionalVizConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { PanelConfigSchema, SaveConfig } from "@foxglove/studio-base/types/panels";

import useFrame from "./useFrame";
import useTransforms from "./useTransforms";

// The amount of time to wait before dispatching the saveConfig action to save the cameraState into the layout
export const CAMERA_STATE_UPDATE_DEBOUNCE_DELAY_MS = 250;

export type Save3DConfig = SaveConfig<ThreeDimensionalVizConfig>;

export type Props = {
  config: ThreeDimensionalVizConfig;
  saveConfig: Save3DConfig;
};

const TimeZero = { sec: 0, nsec: 0 };
function selectCurrentTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.currentTime ?? TimeZero;
}

function selectIsPlaying(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.isPlaying ?? false;
}

function BaseRenderer(props: Props): JSX.Element {
  const {
    config,
    saveConfig,
    config: { autoSyncCameraState = false, followOrientation = false, followTf },
  } = props;
  const { updatePanelConfigs } = React.useContext(PanelContext) ?? {};

  const { topics } = useDataSourceInfo();

  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const setSubscriptions = useCallback((newTopics: string[]) => {
    setSubscribedTopics(uniq(newTopics));
  }, []);

  const { reset: resetFrame, frame } = useFrame(subscribedTopics);
  const transforms = useTransforms(topics, frame, resetFrame);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const isPlaying = useMessagePipeline(selectIsPlaying);

  // We use useState to store the cameraState instead of using config directly in order to
  // speed up the pan/rotate performance of the 3D panel. This allows us to update the cameraState
  // immediately instead of setting the new cameraState by dispatching a saveConfig.
  const [configCameraState, setConfigCameraState] = useState(config.cameraState);
  useEffect(() => setConfigCameraState(config.cameraState), [config]);

  const { transformedCameraState, targetPose } = useTransformedCameraState({
    configCameraState,
    followTf,
    followOrientation,
    transforms,
  });

  const onSetSubscriptions = useCallback(
    (subscriptions: string[]) => setSubscriptions(subscriptions),
    [setSubscriptions],
  );

  // use callbackInputsRef to make sure the input changes don't trigger `onFollowChange` or `onAlignXYAxis` to change
  const callbackInputsRef = useRef({
    transformedCameraState,
    configCameraState,
    targetPose,
    configFollowOrientation: config.followOrientation,
    configFollowTf: config.followTf,
  });
  callbackInputsRef.current = {
    transformedCameraState,
    configCameraState,
    targetPose,
    configFollowOrientation: config.followOrientation,
    configFollowTf: config.followTf,
  };
  const onFollowChange = useCallback(
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    (newFollowTf?: string | false, newFollowOrientation?: boolean) => {
      const {
        configCameraState: prevCameraState,
        configFollowOrientation: prevFollowOrientation,
        configFollowTf: prevFollowTf,
        targetPose: prevTargetPose,
      } = callbackInputsRef.current;
      const newCameraState = getNewCameraStateOnFollowChange({
        prevCameraState,
        prevTargetPose,
        prevFollowTf,
        prevFollowOrientation,
        newFollowTf,
        newFollowOrientation,
      });
      saveConfig({
        followTf: newFollowTf,
        followOrientation: newFollowOrientation,
        cameraState: newCameraState,
      });
    },
    [saveConfig],
  );

  const onAlignXYAxis = useCallback(
    () =>
      saveConfig({
        followOrientation: false,
        cameraState: {
          ...omit(callbackInputsRef.current.transformedCameraState, [
            "target",
            "targetOrientation",
          ]),
          thetaOffset: 0,
        },
      }),
    [saveConfig],
  );

  const saveCameraState = useCallback(
    (newCameraStateObj: Partial<CameraState>) => saveConfig({ cameraState: newCameraStateObj }),
    [saveConfig],
  );
  const saveCameraStateDebounced = useMemo(
    () => debounce(saveCameraState, CAMERA_STATE_UPDATE_DEBOUNCE_DELAY_MS),
    [saveCameraState],
  );

  const onCameraStateChange = useCallback(
    (newCameraState: CameraState) => {
      const newCurrentCameraState = omit(newCameraState, ["target", "targetOrientation"]);
      setConfigCameraState(newCurrentCameraState);

      // If autoSyncCameraState is enabled, we can't wait for the debounce and need to call updatePanelConfig right away
      if (autoSyncCameraState) {
        updatePanelConfigs?.("3D Panel", (oldConfig) => ({
          ...oldConfig,
          cameraState: newCurrentCameraState,
        }));
      } else {
        saveCameraStateDebounced(newCurrentCameraState);
      }
    },
    [autoSyncCameraState, saveCameraStateDebounced, updatePanelConfigs],
  );

  return (
    <Layout
      cameraState={transformedCameraState}
      config={config}
      currentTime={currentTime}
      followOrientation={followOrientation}
      followTf={followTf}
      resetFrame={resetFrame}
      frame={frame}
      helpContent={helpContent}
      isPlaying={isPlaying}
      onAlignXYAxis={onAlignXYAxis}
      onCameraStateChange={onCameraStateChange}
      onFollowChange={onFollowChange}
      saveConfig={saveConfig}
      topics={topics}
      targetPose={targetPose}
      transforms={transforms}
      setSubscriptions={onSetSubscriptions}
    />
  );
}

const configSchema: PanelConfigSchema<ThreeDimensionalVizConfig> = [
  {
    key: "flattenMarkers",
    type: "toggle",
    title: "Flatten markers with a z-value of 0 to be located at the base frame's z value",
  },
  {
    key: "autoTextBackgroundColor",
    type: "toggle",
    title: "Automatically apply dark/light background color to text",
  },
];

BaseRenderer.displayName = "ThreeDimensionalViz";
BaseRenderer.panelType = "3D Panel";
BaseRenderer.defaultConfig = {
  checkedKeys: ["name:Topics"],
  expandedKeys: ["name:Topics"],
  followTf: undefined,
  followOrientation: false,
  cameraState: {},
  modifiedNamespaceTopics: [],
  pinTopics: false,
  settingsByKey: {},
  autoSyncCameraState: false,
  autoTextBackgroundColor: true,
  diffModeEnabled: true,
} as ThreeDimensionalVizConfig;
BaseRenderer.supportsStrictMode = false;
BaseRenderer.configSchema = configSchema;

export default Panel(BaseRenderer);
