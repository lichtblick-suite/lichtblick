// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useDataSourceInfo } from "@foxglove-studio/app/PanelAPI";
import { setPlaybackConfig } from "@foxglove-studio/app/actions/panels";
import Dropdown from "@foxglove-studio/app/components/Dropdown";
import DropdownItem from "@foxglove-studio/app/components/Dropdown/DropdownItem";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import { PlayerCapabilities } from "@foxglove-studio/app/players/types";

const SPEEDS = ["0.01", "0.02", "0.05", "0.1", "0.2", "0.5", "0.8", "1", "2", "3", "5"];

export default function PlaybackSpeedControls(): JSX.Element {
  const configSpeed = useSelector((state: any) => state.persistedState.panels.playbackConfig.speed);
  const speed = useMessagePipeline(
    useCallback(({ playerState }) => playerState.activeData?.speed, []),
  );
  const { capabilities } = useDataSourceInfo();
  const canSetSpeed = capabilities.includes(PlayerCapabilities.setSpeed);

  // TODO(JP): Might be nice to move all this logic a bit deeper down. It's a bit weird to be doing
  // all this in what's otherwise just a view component.
  const dispatch = useDispatch();
  const setPlaybackSpeed = useMessagePipeline(
    useCallback(({ setPlaybackSpeed: pipelineSetPlaybackSpeed }) => pipelineSetPlaybackSpeed, []),
  );
  const setSpeed = useCallback(
    (newSpeed) => {
      dispatch(setPlaybackConfig({ speed: newSpeed }));
      if (canSetSpeed) {
        setPlaybackSpeed(newSpeed);
      }
    },
    [canSetSpeed, dispatch, setPlaybackSpeed],
  );

  // Set the speed to the speed that we got from the config whenever we get a new Player.
  useEffect(() => setSpeed(configSpeed), [configSpeed, setSpeed]);

  const displayedSpeed = speed ?? configSpeed;
  let speedText = `–`;

  if (displayedSpeed) {
    speedText = displayedSpeed < 0.1 ? `${displayedSpeed.toFixed(2)}x` : `${displayedSpeed}x`;
  }

  return (
    <Dropdown
      position="above"
      value={displayedSpeed}
      text={speedText}
      onChange={setSpeed}
      menuStyle={{ width: "75px" }}
      btnStyle={{ marginRight: "16px", height: "28px" }}
      dataTest="PlaybackSpeedControls-Dropdown"
    >
      {SPEEDS.map((eachSpeed: string) => (
        <DropdownItem key={eachSpeed} value={parseFloat(eachSpeed)}>
          <span>{eachSpeed}x</span>
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
