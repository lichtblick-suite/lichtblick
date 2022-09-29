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

import { makeStyles } from "tss-react/mui";

import { MouseEventObject } from "@foxglove/regl-worldview";
import { Time } from "@foxglove/rostime";
import CameraInfo from "@foxglove/studio-base/panels/ThreeDimensionalViz/CameraInfo";
import Crosshair from "@foxglove/studio-base/panels/ThreeDimensionalViz/Crosshair";
import FollowTFControl from "@foxglove/studio-base/panels/ThreeDimensionalViz/FollowTFControl";
import {
  InteractionState,
  InteractionStateDispatch,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/InteractionState";
import Interactions from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions";
import { TabType } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/Interactions";
import { LayoutToolbarSharedProps } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Layout";
import MainToolbar from "@foxglove/studio-base/panels/ThreeDimensionalViz/MainToolbar";
import MeasureMarker from "@foxglove/studio-base/panels/ThreeDimensionalViz/MeasureMarker";
import { MeasuringTool } from "@foxglove/studio-base/panels/ThreeDimensionalViz/MeasuringTool";
import { PublishClickTool } from "@foxglove/studio-base/panels/ThreeDimensionalViz/PublishClickTool";
import { PublishMarker } from "@foxglove/studio-base/panels/ThreeDimensionalViz/PublishMarker";
import SearchText, {
  SearchTextParams,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/SearchText";
import {
  MouseEventHandlerProps,
  ThreeDimensionalVizConfig,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";

type Props = LayoutToolbarSharedProps &
  MouseEventHandlerProps &
  SearchTextParams & {
    autoSyncCameraState: boolean;
    config: ThreeDimensionalVizConfig;
    currentTime: Time;
    debug: boolean;
    fixedFrameId?: string;
    interactionState: InteractionState;
    interactionStateDispatch: InteractionStateDispatch;
    interactionsTabType?: TabType;
    onToggleCameraMode: () => void;
    onToggleDebug: () => void;
    renderFrameId?: string;
    selectedObject?: MouseEventObject;
    setInteractionsTabType: (arg0?: TabType) => void;
    showCrosshair?: boolean;
  };

const useStyles = makeStyles()((theme) => ({
  controls: {
    position: "absolute",
    top: theme.spacing(1.5),
    right: theme.spacing(1),
    zIndex: 101,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: theme.spacing(1),
    pointerEvents: "none", // <- allow mouse events to pass through the empty space in this container element
  },
}));

function LayoutToolbar({
  addMouseEventHandler,
  autoSyncCameraState,
  cameraState,
  config,
  currentTime,
  debug,
  fixedFrameId,
  followMode,
  followTf,
  interactionsTabType,
  interactionState,
  interactionStateDispatch,
  isPlaying,
  onAlignXYAxis,
  onCameraStateChange,
  onFollowChange,
  onToggleCameraMode,
  onToggleDebug,
  removeMouseEventHandler,
  renderFrameId,
  searchInputRef,
  searchText,
  searchTextMatches,
  searchTextOpen,
  selectedMatchIndex,
  selectedObject,
  setInteractionsTabType,
  setSearchText,
  setSearchTextMatches,
  setSelectedMatchIndex,
  showCrosshair = false,
  toggleSearchTextOpen,
  transforms,
}: Props) {
  const { classes } = useStyles();
  return (
    <>
      <div className={classes.controls}>
        <FollowTFControl
          transforms={transforms}
          followTf={followTf}
          followMode={followMode}
          onFollowChange={onFollowChange}
        />
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
          renderFrameId={renderFrameId}
          fixedFrameId={fixedFrameId}
          currentTime={currentTime}
        />
        <MainToolbar
          debug={debug}
          interactionState={interactionState}
          interactionStateDispatch={interactionStateDispatch}
          onToggleCameraMode={onToggleCameraMode}
          onToggleDebug={onToggleDebug}
          perspective={cameraState.perspective}
        />
        <Interactions
          selectedObject={selectedObject}
          interactionsTabType={interactionsTabType}
          setInteractionsTabType={setInteractionsTabType}
        />
        <CameraInfo
          cameraState={cameraState}
          followMode={followMode}
          followTf={followTf}
          isPlaying={isPlaying}
          onAlignXYAxis={onAlignXYAxis}
          onCameraStateChange={onCameraStateChange}
          showCrosshair={showCrosshair}
          autoSyncCameraState={autoSyncCameraState}
        />
      </div>
      {!cameraState.perspective && showCrosshair && <Crosshair cameraState={cameraState} />}
      {interactionState.tool === "measure" && (
        <MeasuringTool
          addMouseEventHandler={addMouseEventHandler}
          interactionStateDispatch={interactionStateDispatch}
          measure={interactionState.measure}
          removeMouseEventHandler={removeMouseEventHandler}
        />
      )}
      {interactionState.tool === "publish-click" && fixedFrameId && (
        <PublishClickTool
          addMouseEventHandler={addMouseEventHandler}
          config={config}
          interactionStateDispatch={interactionStateDispatch}
          frameId={fixedFrameId}
          publish={interactionState.publish}
          removeMouseEventHandler={removeMouseEventHandler}
        />
      )}
      {interactionState.measure != undefined && (
        <MeasureMarker measure={interactionState.measure} />
      )}
      {interactionState.publish != undefined && (
        <PublishMarker publish={interactionState.publish} />
      )}
    </>
  );
}

export default React.memo<Props>(LayoutToolbar);
