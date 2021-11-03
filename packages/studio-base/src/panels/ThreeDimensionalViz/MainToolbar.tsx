// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IButtonStyles, Stack, useTheme } from "@fluentui/react";

import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import MeasuringTool, {
  MeasureInfo,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/DrawingTools/MeasuringTool";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

type Props = {
  measuringTool?: MeasuringTool;
  measureInfo: MeasureInfo;
  perspective: boolean;
  debug: boolean;
  onToggleCameraMode: () => void;
  onToggleDebug: () => void;
};

function MainToolbar({
  measuringTool,
  measureInfo: { measureState },
  debug,
  onToggleCameraMode,
  onToggleDebug,
  perspective = false,
}: Props) {
  const theme = useTheme();
  const measureActive = measureState === "place-start" || measureState === "place-finish";

  const toggleCameraButton = useTooltip({
    contents: perspective ? "Switch to 2D camera" : "Switch to 3D camera",
  });
  const measuringToolButton = useTooltip({
    contents: perspective
      ? "Switch to 2D camera to measure distance"
      : measureActive
      ? "Cancel Measuring"
      : "Measure Distance",
  });
  const debugButton = useTooltip({
    contents: debug ? "Disable Debug" : "Enable Debug",
  });

  const iconButtonStyles: Partial<IButtonStyles> = {
    rootHovered: { backgroundColor: "transparent" },
    rootPressed: { backgroundColor: "transparent" },
    rootDisabled: { backgroundColor: "transparent" },

    rootChecked: { backgroundColor: "transparent" },
    rootCheckedHovered: { backgroundColor: "transparent" },
    rootCheckedPressed: { backgroundColor: "transparent" },

    iconChecked: { color: colors.HIGHLIGHT },
    icon: {
      color: theme.semanticColors.bodyText,

      svg: {
        fill: "currentColor",
        height: "1em",
        width: "1em",
      },
    },
  };

  return (
    <Stack
      grow={0}
      styles={{
        root: {
          backgroundColor: theme.semanticColors.buttonBackgroundHovered,
          borderRadius: theme.effects.roundedCorner2,
          flexShrink: 0,
          pointerEvents: "auto",
        },
      }}
    >
      {toggleCameraButton.tooltip}
      <IconButton
        checked={perspective}
        onClick={onToggleCameraMode}
        elementRef={toggleCameraButton.ref}
        data-text="MainToolbar-toggleCameraMode"
        iconProps={{ iconName: "Video3d" }}
        styles={iconButtonStyles}
      />
      {measuringToolButton.tooltip}
      <IconButton
        checked={measureActive}
        disabled={perspective}
        onClick={measuringTool ? measuringTool.toggleMeasureState : undefined}
        elementRef={measuringToolButton.ref}
        iconProps={{ iconName: "Ruler" }}
        styles={iconButtonStyles}
      />
      {process.env.NODE_ENV === "development" && (
        <>
          {debugButton.tooltip}
          <IconButton
            checked={debug}
            onClick={onToggleDebug}
            elementRef={debugButton.ref}
            iconProps={{ iconName: "Bug" }}
            styles={iconButtonStyles}
          />
        </>
      )}
    </Stack>
  );
}

export default React.memo<Props>(MainToolbar);
