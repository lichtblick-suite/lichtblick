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

import CameraControlIcon from "@mdi/svg/svg/camera-control.svg";
import { vec3 } from "gl-matrix";
import { isEqual } from "lodash";
import { CameraState, cameraStateSelectors } from "regl-worldview";
import styled from "styled-components";

import Button from "@foxglove-studio/app/components/Button";
import ExpandingToolbar, { ToolGroup } from "@foxglove-studio/app/components/ExpandingToolbar";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import {
  UncontrolledValidatedInput,
  YamlInput,
} from "@foxglove-studio/app/components/ValidatedInput";
import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import {
  SValue,
  SLabel,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/styling";
import styles from "@foxglove-studio/app/panels/ThreeDimensionalViz/Layout.module.scss";
import {
  getNewCameraStateOnFollowChange,
  TargetPose,
} from "@foxglove-studio/app/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { ThreeDimensionalVizConfig } from "@foxglove-studio/app/panels/ThreeDimensionalViz/types";
import { point2DValidator, cameraStateValidator } from "@foxglove-studio/app/shared/validators";
import colors from "@foxglove-studio/app/styles/colors.module.scss";
import clipboard from "@foxglove-studio/app/util/clipboard";

export const CAMERA_TAB_TYPE = "Camera";

const LABEL_WIDTH = 112;
const TEMP_VEC3 = [0, 0, 0];
const ZERO_VEC3 = Object.freeze([0, 0, 0]);
const DEFAULT_CAMERA_INFO_WIDTH = 260;

const SRow = styled.div`
  display: flex;
  align-items: center;
`;

type CameraStateInfoProps = {
  cameraState: Partial<CameraState>;
  onAlignXYAxis: () => void;
};

export type CameraInfoPropsWithoutCameraState = {
  followOrientation: boolean;
  followTf?: string | false;
  isPlaying?: boolean;
  onAlignXYAxis: () => void;
  onCameraStateChange: (arg0: CameraState) => void;
  showCrosshair?: boolean;
  autoSyncCameraState: boolean;
  defaultSelectedTab?: string;
};

type CameraInfoProps = {
  cameraState: Partial<CameraState>;
  targetPose?: TargetPose;
} & CameraInfoPropsWithoutCameraState;

function CameraStateInfo({ cameraState, onAlignXYAxis }: CameraStateInfoProps) {
  return (
    <>
      {Object.keys(cameraState)
        .sort()
        .map((key) => {
          let val = cameraState[key];
          if (key === "perspective") {
            val = cameraState[key] ? "true" : "false";
          } else if (Array.isArray(cameraState[key])) {
            val = cameraState[key].map((x: any) => x.toFixed(1)).join(", ");
          } else if (typeof cameraState[key] === "number") {
            val = cameraState[key].toFixed(2);
          }
          return [key, val];
        })
        .map(([key, val]) => (
          <SRow key={key}>
            <SLabel width={LABEL_WIDTH}>{key}:</SLabel> <SValue>{val}</SValue>
            {key === "thetaOffset" && (
              <Button
                onClick={onAlignXYAxis}
                tooltip="Align XY axis by reseting thetaOffset to 0. Will no longer follow orientation."
              >
                RESET
              </Button>
            )}
          </SRow>
        ))}
    </>
  );
}

export default function CameraInfo({
  cameraState,
  targetPose,
  followOrientation,
  followTf,
  isPlaying,
  onAlignXYAxis,
  onCameraStateChange,
  showCrosshair,
  autoSyncCameraState,
  defaultSelectedTab,
}: CameraInfoProps) {
  const [selectedTab, setSelectedTab] = React.useState(defaultSelectedTab);
  const { updatePanelConfig, saveConfig } = React.useContext(PanelContext) || ({} as any);
  const [edit, setEdit] = React.useState<boolean>(false);
  const onEditToggle = React.useCallback(() => setEdit((currVal) => !currVal), []);

  const { target, targetOffset } = cameraState;
  const targetHeading = cameraStateSelectors.targetHeading(cameraState);
  const camPos2D = vec3.add(
    TEMP_VEC3 as any,
    target,
    vec3.rotateZ(TEMP_VEC3 as any, targetOffset, ZERO_VEC3 as any, -targetHeading),
  );
  const camPos2DTrimmed = camPos2D.map((num: any) => +num.toFixed(2));

  const syncCameraState = () => {
    updatePanelConfig("3D Panel", (config: ThreeDimensionalVizConfig) => {
      // Transform the camera state by whichever TF or orientation the other panels are following.
      const newCameraState = getNewCameraStateOnFollowChange({
        prevCameraState: cameraState,
        prevTargetPose: targetPose,
        prevFollowTf: followTf,
        prevFollowOrientation: followOrientation,
        newFollowTf: config.followTf,
        newFollowOrientation: config.followOrientation,
      });
      return { ...config, cameraState: newCameraState };
    });
  };

  return (
    <ExpandingToolbar
      tooltip="Camera"
      icon={
        <Icon style={{ color: autoSyncCameraState ? colors.accent : "white" }}>
          <CameraControlIcon />
        </Icon>
      }
      className={styles.buttons}
      selectedTab={selectedTab}
      onSelectTab={(newSelectedTab) => setSelectedTab(newSelectedTab as any)}
    >
      <ToolGroup name={CAMERA_TAB_TYPE}>
        <Flex col style={{ minWidth: DEFAULT_CAMERA_INFO_WIDTH }}>
          <Flex row reverse>
            <Button
              tooltip="Copy cameraState"
              small
              onClick={() => {
                clipboard.copy(JSON.stringify(cameraState, undefined, 2));
              }}
            >
              Copy
            </Button>
            <Button
              disabled={!!isPlaying}
              tooltip={
                isPlaying
                  ? "Pause player to edit raw camera state object"
                  : "Edit raw camera state object"
              }
              onClick={onEditToggle}
            >
              {edit ? "Done" : "Edit"}
            </Button>
            <Button tooltip="Sync camera state across all 3D panels" onClick={syncCameraState}>
              Sync
            </Button>
          </Flex>
          {edit && !isPlaying ? (
            <UncontrolledValidatedInput
              format="yaml"
              value={cameraState}
              onChange={(newCameraState) => saveConfig({ cameraState: newCameraState })}
              dataValidator={cameraStateValidator}
            />
          ) : (
            <Flex col>
              <CameraStateInfo cameraState={cameraState} onAlignXYAxis={onAlignXYAxis} />
              <Flex col>
                <SRow style={{ marginBottom: 8 }}>
                  <Tooltip
                    placement="top"
                    contents="Automatically sync camera across all 3D panels"
                  >
                    <SLabel>Auto sync:</SLabel>
                  </Tooltip>
                  <SValue>
                    <input
                      type="checkbox"
                      checked={autoSyncCameraState}
                      onChange={() =>
                        updatePanelConfig("3D Panel", (config: any) => ({
                          ...config,
                          cameraState,
                          autoSyncCameraState: !autoSyncCameraState,
                        }))
                      }
                    />
                  </SValue>
                </SRow>
                <SRow style={{ marginBottom: 8 }}>
                  <SLabel style={cameraState.perspective ? { color: colors.textMuted } : {}}>
                    Show crosshair:
                  </SLabel>
                  <SValue>
                    <input
                      type="checkbox"
                      disabled={cameraState.perspective}
                      checked={showCrosshair}
                      onChange={() => saveConfig({ showCrosshair: !showCrosshair })}
                    />
                  </SValue>
                </SRow>
                {showCrosshair && !cameraState.perspective && (
                  <SRow style={{ paddingLeft: LABEL_WIDTH, marginBottom: 8 }}>
                    <SValue>
                      <YamlInput
                        inputStyle={{ width: 140 }}
                        value={{ x: camPos2DTrimmed[0], y: camPos2DTrimmed[1] }}
                        onChange={(data) => {
                          const newPos = [data.x, data.y, 0];
                          // extract the targetOffset by subtracting from the target and un-rotating by heading
                          const newTargetOffset = vec3.rotateZ(
                            [0, 0, 0],
                            vec3.sub(TEMP_VEC3 as any, newPos as any, cameraState.target),
                            ZERO_VEC3 as any,
                            cameraStateSelectors.targetHeading(cameraState),
                          );
                          if (!isEqual(cameraState.targetOffset, newTargetOffset)) {
                            onCameraStateChange({ ...cameraState, targetOffset: newTargetOffset });
                          }
                        }}
                        dataValidator={point2DValidator}
                      />
                    </SValue>
                  </SRow>
                )}
              </Flex>
              {followTf ? (
                <SRow>
                  <SLabel>Following frame:</SLabel>
                  <SValue>
                    <code>{followTf}</code>
                    {followOrientation && " with orientation"}
                  </SValue>
                </SRow>
              ) : (
                <p>
                  Locked to map (
                  {(getGlobalHooks() as any).perPanelHooks().ThreeDimensionalViz.rootTransformFrame}
                  )
                </p>
              )}
            </Flex>
          )}
        </Flex>
      </ToolGroup>
    </ExpandingToolbar>
  );
}
