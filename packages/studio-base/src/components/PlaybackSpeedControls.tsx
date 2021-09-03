// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DefaultButton,
  DirectionalHint,
  IContextualMenuItem,
  IMenuItemStyles,
  useTheme,
} from "@fluentui/react";
import { useCallback, useEffect } from "react";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";

const SPEED_OPTIONS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 0.8, 1, 2, 3, 5];

function formatSpeed(val: number) {
  return `${val < 0.1 ? val?.toFixed(2) : val}×`;
}

export default function PlaybackSpeedControls(): JSX.Element {
  const theme = useTheme();
  const configSpeed = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data?.playbackConfig.speed,
  );
  const speed = useMessagePipeline(
    useCallback(({ playerState }) => playerState.activeData?.speed, []),
  );
  const { capabilities } = useDataSourceInfo();
  const canSetSpeed = capabilities.includes(PlayerCapabilities.setSpeed);
  const setPlaybackSpeed = useMessagePipeline(
    useCallback(({ setPlaybackSpeed: pipelineSetPlaybackSpeed }) => pipelineSetPlaybackSpeed, []),
  );
  const { setPlaybackConfig } = useCurrentLayoutActions();
  const setSpeed = useCallback(
    (newSpeed: number) => {
      setPlaybackConfig({ speed: newSpeed });
      if (canSetSpeed) {
        setPlaybackSpeed(newSpeed);
      }
    },
    [canSetSpeed, setPlaybackConfig, setPlaybackSpeed],
  );

  // Set the speed to the speed that we got from the config whenever we get a new Player.
  useEffect(() => {
    if (configSpeed != undefined) {
      setPlaybackSpeed(configSpeed);
    }
  }, [configSpeed, setPlaybackSpeed]);

  const displayedSpeed = speed ?? configSpeed;

  return (
    <DefaultButton
      data-test="PlaybackSpeedControls-Dropdown"
      menuProps={{
        calloutProps: {
          calloutMaxWidth: 80,
        },
        directionalHint: DirectionalHint.topLeftEdge,
        directionalHintFixed: true,
        gapSpace: 3,
        items: SPEED_OPTIONS.map(
          (option: number): IContextualMenuItem => ({
            canCheck: true,
            key: `${option}`,
            text: formatSpeed(option),
            isChecked: displayedSpeed === option,
            onClick: () => setSpeed(option),
          }),
        ),
        styles: {
          subComponentStyles: {
            menuItem: {
              label: { fontSize: theme.fonts.small.fontSize },
              // Reach into the component styles to remove the effects of global.scss
              root: { margin: 0, borderRadius: 0 },
              checkmarkIcon: { "& svg": { marginTop: "-2px" } },
            } as Partial<IMenuItemStyles>,
          },
        },
      }}
      styles={{
        root: {
          background: theme.semanticColors.buttonBackgroundHovered,
          border: "none",
          padding: theme.spacing.s1,
          margin: 0, // Remove this once global.scss has gone away
          minWidth: "60px",
        },
        rootHovered: {
          background: theme.semanticColors.buttonBackgroundPressed,
        },
        label: theme.fonts.small,
        menuIcon: {
          fontSize: theme.fonts.tiny.fontSize,
        },
      }}
    >
      {displayedSpeed == undefined ? "–" : formatSpeed(displayedSpeed)}
    </DefaultButton>
  );
}
