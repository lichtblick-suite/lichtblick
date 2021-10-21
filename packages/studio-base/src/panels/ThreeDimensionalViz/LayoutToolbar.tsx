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

import { Stack, Text, useTheme } from "@fluentui/react";

import { PolygonBuilder, MouseEventObject, Polygon } from "@foxglove/regl-worldview";
import CameraInfo from "@foxglove/studio-base/panels/ThreeDimensionalViz/CameraInfo";
import Crosshair from "@foxglove/studio-base/panels/ThreeDimensionalViz/Crosshair";
import DrawingTools, {
  DrawingTabType,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/DrawingTools";
import MeasuringTool, {
  MeasureInfo,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/DrawingTools/MeasuringTool";
import FollowTFControl from "@foxglove/studio-base/panels/ThreeDimensionalViz/FollowTFControl";
import Interactions from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions";
import { TabType } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/Interactions";
import MainToolbar from "@foxglove/studio-base/panels/ThreeDimensionalViz/MainToolbar";
import MeasureMarker from "@foxglove/studio-base/panels/ThreeDimensionalViz/MeasureMarker";
import SearchText, {
  SearchTextProps,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/SearchText";
import { LayoutToolbarSharedProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/Layout";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

type Props = LayoutToolbarSharedProps &
  SearchTextProps & {
    autoSyncCameraState: boolean;
    debug: boolean;
    interactionsTabType?: TabType;
    measureInfo: MeasureInfo;
    measuringElRef: { current: MeasuringTool | ReactNull };
    onSetDrawingTabType: (arg0?: DrawingTabType) => void;
    onSetPolygons: (polygons: Polygon[]) => void;
    onToggleCameraMode: () => void;
    onToggleDebug: () => void;
    polygonBuilder: PolygonBuilder;
    rootTf?: string;
    selectedObject?: MouseEventObject;
    setInteractionsTabType: (arg0?: TabType) => void;
    setMeasureInfo: (arg0: MeasureInfo) => void;
    showCrosshair?: boolean;
  };

function LayoutToolbar({
  autoSyncCameraState,
  cameraState,
  debug,
  followOrientation,
  followTf,
  interactionsTabType,
  isPlaying,
  measureInfo,
  measuringElRef,
  onAlignXYAxis,
  onCameraStateChange,
  onFollowChange,
  onSetDrawingTabType,
  onSetPolygons,
  onToggleCameraMode,
  onToggleDebug,
  polygonBuilder,
  rootTf,
  searchInputRef,
  searchText,
  searchTextMatches,
  searchTextOpen,
  selectedMatchIndex,
  selectedObject,
  setInteractionsTabType,
  setMeasureInfo,
  setSearchText,
  setSearchTextMatches,
  setSelectedMatchIndex,
  showCrosshair = false,
  targetPose,
  toggleSearchTextOpen,
  transforms,
}: Props) {
  const theme = useTheme();
  return (
    <>
      <MeasuringTool
        ref={measuringElRef}
        measureState={measureInfo.measureState}
        measurePoints={measureInfo.measurePoints}
        onMeasureInfoChange={setMeasureInfo}
      />
      <Stack
        styles={{
          root: {
            position: "absolute",
            top: `calc(${theme.spacing.l2} + ${theme.spacing.s1})`,
            right: theme.spacing.m,
            zIndex: 101,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            // allow mouse events to pass through the empty space in this container element
            pointerEvents: "none",
          },
        }}
        tokens={{ childrenGap: theme.spacing.s1 }}
      >
        <SearchText
          searchTextOpen={searchTextOpen}
          toggleSearchTextOpen={toggleSearchTextOpen}
          searchText={searchText}
          setSearchText={setSearchText}
          setSearchTextMatches={setSearchTextMatches}
          searchTextMatches={searchTextMatches}
          searchInputRef={searchInputRef}
          setSelectedMatchIndex={setSelectedMatchIndex}
          selectedMatchIndex={selectedMatchIndex}
          onCameraStateChange={onCameraStateChange}
          cameraState={cameraState}
          transforms={transforms}
          rootTf={rootTf}
        />
        <FollowTFControl
          transforms={transforms}
          tfToFollow={typeof followTf === "string" && followTf.length > 0 ? followTf : undefined}
          followOrientation={followOrientation}
          onFollowChange={onFollowChange}
        />
        <Stack
          horizontal
          verticalAlign="center"
          styles={{ root: { position: "relative" } }}
          tokens={{ childrenGap: theme.spacing.s1 }}
        >
          {measuringElRef.current && (
            <Text variant="small" styles={{ root: { fontFamily: fonts.MONOSPACE } }}>
              {measuringElRef.current?.measureDistance}
            </Text>
          )}
          <MainToolbar
            measureInfo={measureInfo}
            measuringTool={measuringElRef.current ?? undefined}
            perspective={cameraState.perspective}
            debug={debug}
            onToggleCameraMode={onToggleCameraMode}
            onToggleDebug={onToggleDebug}
          />
        </Stack>
        <Interactions
          selectedObject={selectedObject}
          interactionsTabType={interactionsTabType}
          setInteractionsTabType={setInteractionsTabType}
        />
        <DrawingTools
          onSetPolygons={onSetPolygons}
          polygonBuilder={polygonBuilder}
          onSetDrawingTabType={onSetDrawingTabType}
        />
        <CameraInfo
          cameraState={cameraState}
          targetPose={targetPose}
          followOrientation={followOrientation}
          followTf={followTf}
          isPlaying={isPlaying}
          onAlignXYAxis={onAlignXYAxis}
          onCameraStateChange={onCameraStateChange}
          showCrosshair={showCrosshair}
          autoSyncCameraState={autoSyncCameraState}
        />
      </Stack>
      {!cameraState.perspective && showCrosshair && <Crosshair cameraState={cameraState} />}
      <MeasureMarker measurePoints={measureInfo.measurePoints} />
    </>
  );
}

export default React.memo<Props>(LayoutToolbar);
