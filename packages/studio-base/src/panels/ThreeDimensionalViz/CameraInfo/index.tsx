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
import { Button, Tooltip, styled as muiStyled, useTheme } from "@mui/material";
import { vec3 } from "gl-matrix";
import { isEqual } from "lodash";

import { CameraState, cameraStateSelectors, Vec3 } from "@foxglove/regl-worldview";
import ExpandingToolbar, { ToolGroup } from "@foxglove/studio-base/components/ExpandingToolbar";
import JsonInput from "@foxglove/studio-base/components/JsonInput";
import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  SValue,
  SLabel,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/styling";
import { getNewCameraStateOnFollowChange } from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import {
  FollowMode,
  ThreeDimensionalVizConfig,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import clipboard from "@foxglove/studio-base/util/clipboard";

import { point2DValidator, cameraStateValidator } from "./validate";

export const CAMERA_TAB_TYPE = "Camera";

const LABEL_WIDTH = 112;
const TEMP_VEC3: vec3 = [0, 0, 0];
const ZERO_VEC3 = Object.freeze([0, 0, 0]) as Readonly<vec3>;
const DEFAULT_CAMERA_INFO_WIDTH = 260;

type CameraStateInfoProps = {
  cameraState: Partial<CameraState>;
  onAlignXYAxis: () => void;
};

const StyledButton = muiStyled(Button)({
  lineHeight: 1.25,
  minWidth: 40,
});

export type CameraInfoPropsWithoutCameraState = {
  followMode: FollowMode;
  followTf?: string;
  isPlaying?: boolean;
  onAlignXYAxis: () => void;
  onCameraStateChange: (arg0: CameraState) => void;
  showCrosshair?: boolean;
  autoSyncCameraState: boolean;
  defaultSelectedTab?: string;
};

export type CameraInfoProps = {
  cameraState: CameraState;
} & CameraInfoPropsWithoutCameraState;

function CameraStateInfo({ cameraState, onAlignXYAxis }: CameraStateInfoProps) {
  return (
    <>
      {(Object.keys(cameraState) as (keyof CameraState)[])
        .sort()
        .map((key) => {
          let val: unknown = cameraState[key];
          if (key === "perspective") {
            val = cameraState[key] ?? false ? "true" : "false";
          } else if (Array.isArray(val)) {
            val = val.map((x) => x.toFixed(1)).join(", ");
          } else if (typeof val === "number") {
            val = val.toFixed(2);
          }
          return [key, val as string];
        })
        .map(([key, val]) => (
          <Stack key={key} direction="row" alignItems="center" gap={1}>
            <SLabel width={LABEL_WIDTH}>{key}:</SLabel> <SValue>{val}</SValue>
            {key === "thetaOffset" && (
              <StyledButton
                color="inherit"
                variant="text"
                size="small"
                onClick={onAlignXYAxis}
                title="Align XY axis by reseting thetaOffset to 0. Will no longer follow orientation."
              >
                Reset
              </StyledButton>
            )}
          </Stack>
        ))}
    </>
  );
}

export default function CameraInfo({
  cameraState,
  followMode,
  followTf,
  isPlaying = false,
  onAlignXYAxis,
  onCameraStateChange,
  showCrosshair = false,
  autoSyncCameraState,
  defaultSelectedTab,
}: CameraInfoProps): JSX.Element {
  const theme = useTheme();
  const [selectedTab, setSelectedTab] = React.useState(defaultSelectedTab);
  const { updatePanelConfigs, saveConfig } = usePanelContext();
  const [edit, setEdit] = React.useState<boolean>(false);
  const onEditToggle = React.useCallback(() => setEdit((currVal) => !currVal), []);

  const { target, targetOffset } = cameraState;
  const targetHeading = cameraStateSelectors.targetHeading(cameraState);
  const camPos2D = vec3.add(
    TEMP_VEC3,
    target,
    vec3.rotateZ(TEMP_VEC3, targetOffset, ZERO_VEC3, -targetHeading),
  );
  const camPos2DTrimmed = camPos2D.map((num) => +num.toFixed(2));

  const syncCameraState = () => {
    updatePanelConfigs("3D Panel", (config) => {
      // Transform the camera state by whichever TF or orientation the other panels are following.
      const newCameraState = getNewCameraStateOnFollowChange({
        prevCameraState: cameraState,
        prevFollowTf: followTf,
        prevFollowMode: followMode,
        newFollowTf: (config as ThreeDimensionalVizConfig).followTf,
        newFollowMode: (config as ThreeDimensionalVizConfig).followMode,
      });
      return { ...config, cameraState: newCameraState };
    });
  };

  return (
    <ExpandingToolbar
      tooltip="Camera"
      icon={<CameraControlIcon />}
      checked={autoSyncCameraState}
      selectedTab={selectedTab}
      onSelectTab={(newSelectedTab) => setSelectedTab(newSelectedTab)}
    >
      <ToolGroup name={CAMERA_TAB_TYPE}>
        <>
          <Stack direction="row-reverse" gap={0.5} padding={0.5}>
            <StyledButton
              title="Copy cameraState"
              color="inherit"
              variant="text"
              size="small"
              onClick={() => {
                void clipboard.copy(JSON.stringify(cameraState, undefined, 2) ?? "");
              }}
            >
              Copy
            </StyledButton>
            <StyledButton
              disabled={isPlaying}
              color="inherit"
              variant="text"
              size="small"
              title={
                isPlaying
                  ? "Pause player to edit raw camera state object"
                  : "Edit raw camera state object"
              }
              onClick={onEditToggle}
            >
              {edit ? "Done" : "Edit"}
            </StyledButton>
            <StyledButton
              color="inherit"
              variant="text"
              size="small"
              title="Sync camera state across all 3D panels"
              onClick={syncCameraState}
            >
              Sync
            </StyledButton>
          </Stack>
          <Stack flex="auto" padding={1} style={{ minWidth: DEFAULT_CAMERA_INFO_WIDTH }}>
            {edit && !isPlaying ? (
              <JsonInput
                value={cameraState}
                onChange={(newCameraState) => saveConfig({ cameraState: newCameraState })}
                dataValidator={cameraStateValidator}
                maxHeight={220}
              />
            ) : (
              <Stack flex="auto">
                <CameraStateInfo cameraState={cameraState} onAlignXYAxis={onAlignXYAxis} />
                <Stack flex="auto" gap={1}>
                  <Stack direction="row" alignItems="center">
                    <Tooltip placement="top" title="Automatically sync camera across all 3D panels">
                      <SLabel>Auto sync:</SLabel>
                    </Tooltip>
                    <SValue>
                      <LegacyInput
                        type="checkbox"
                        checked={autoSyncCameraState}
                        onChange={() =>
                          updatePanelConfigs("3D Panel", (config) => ({
                            ...config,
                            cameraState,
                            autoSyncCameraState: !autoSyncCameraState,
                          }))
                        }
                      />
                    </SValue>
                  </Stack>
                  <Stack direction="row" alignItems="center">
                    <SLabel
                      style={cameraState.perspective ? { color: theme.palette.text.disabled } : {}}
                    >
                      Show crosshair:
                    </SLabel>
                    <SValue>
                      <LegacyInput
                        type="checkbox"
                        disabled={cameraState.perspective}
                        checked={showCrosshair}
                        onChange={() => saveConfig({ showCrosshair: !showCrosshair })}
                      />
                    </SValue>
                  </Stack>
                  {showCrosshair && !cameraState.perspective && (
                    <Stack paddingLeft={LABEL_WIDTH / 8}>
                      <div
                        style={{
                          background: theme.palette.action.hover,
                          borderRadius: theme.shape.borderRadius,
                          border: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <JsonInput
                          value={{ x: camPos2DTrimmed[0], y: camPos2DTrimmed[1] }}
                          onChange={(data) => {
                            const point = data as { x: number; y: number };
                            const newPos: vec3 = [point.x, point.y, 0];
                            // extract the targetOffset by subtracting from the target and un-rotating by heading
                            const newTargetOffset = vec3.rotateZ(
                              [0, 0, 0],
                              vec3.sub(TEMP_VEC3, newPos, cameraState.target),
                              ZERO_VEC3,
                              cameraStateSelectors.targetHeading(cameraState) as number,
                            ) as Vec3;
                            if (!isEqual(cameraState.targetOffset, newTargetOffset)) {
                              onCameraStateChange({
                                ...cameraState,
                                targetOffset: newTargetOffset,
                              });
                            }
                          }}
                          dataValidator={point2DValidator}
                        />
                      </div>
                    </Stack>
                  )}
                </Stack>
                {followMode === "no-follow" && <p>Not following</p>}
                {followMode !== "no-follow" && (
                  <Stack direction="row" alignItems="center">
                    <SLabel>Following frame:</SLabel>
                    <SValue>
                      <code>{followTf}</code>
                      {followMode === "follow-orientation" && " with orientation"}
                    </SValue>
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </>
      </ToolGroup>
    </ExpandingToolbar>
  );
}
