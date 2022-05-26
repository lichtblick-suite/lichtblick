// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton, Dialog, DialogFooter, getColorFromString } from "@fluentui/react";
import { MenuItem, Select, styled as muiStyled, Typography } from "@mui/material";
import { useCallback } from "react";

import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import Stack from "@foxglove/studio-base/components/Stack";
import { useDialogHostId } from "@foxglove/studio-base/context/DialogHostIdContext";
import { colorObjToIColor, getColorFromIRGB } from "@foxglove/studio-base/util/colorUtils";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

import { isReferenceLinePlotPathType, PlotPath } from "./internalTypes";
import { PlotConfig, PlotXAxisVal } from "./types";

type PathSettingsModalProps = {
  xAxisVal: PlotXAxisVal;
  path: PlotPath;
  paths: PlotPath[];
  index: number;
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  onDismiss: () => void;
};

const TextLabel = muiStyled(Typography)(({ theme }) => ({
  fontWeigh: "bold",
  margin: theme.spacing(0.5, 0),
}));

export default function PathSettingsModal({
  xAxisVal,
  path,
  paths,
  index,
  saveConfig,
  onDismiss,
}: PathSettingsModalProps): JSX.Element {
  const hostId = useDialogHostId();

  const savePathConfig = useCallback(
    (newConfig: Partial<PlotPath>) => {
      const newPaths = paths.slice();
      const newPath = newPaths[index];
      if (newPath) {
        newPaths[index] = { ...newPath, ...newConfig };
      }
      saveConfig({ paths: newPaths });
    },
    [paths, index, saveConfig],
  );

  const resetToDefaults = useCallback(() => {
    savePathConfig({ color: undefined });
  }, [savePathConfig]);

  const currentColor = getColorFromIRGB(
    getColorFromString(getLineColor(path.color, index)) ?? { r: 255, g: 255, b: 255, a: 100 },
  );

  const isTimestampBased = xAxisVal === "timestamp";
  const isReferenceLine = isReferenceLinePlotPathType(path);
  const supportsTimestampMethod = isTimestampBased && !isReferenceLine;

  return (
    <Dialog
      hidden={false}
      onDismiss={onDismiss}
      dialogContentProps={{ title: path.value, showCloseButton: true }}
      modalProps={{ layerProps: { hostId } }}
      maxWidth={480}
      minWidth={480}
    >
      <Stack alignItems="flex-start" gap={1}>
        <div>
          <TextLabel>Color</TextLabel>
          <ColorPicker
            color={currentColor}
            onChange={(newColor) => savePathConfig({ color: colorObjToIColor(newColor).str })}
          />
        </div>

        <div>
          <TextLabel>Timestamp method</TextLabel>
          <Select
            value={!supportsTimestampMethod ? "unsupported" : path.timestampMethod}
            disabled={!supportsTimestampMethod}
            onChange={(event) =>
              savePathConfig({ timestampMethod: event.target.value as TimestampMethod })
            }
            MenuProps={{ disablePortal: true }}
          >
            {!supportsTimestampMethod && (
              <MenuItem disabled value="unsupported">
                {!isTimestampBased
                  ? "Only supported when x-axis is timestamp-based"
                  : "Not supported for reference lines"}
              </MenuItem>
            )}
            <MenuItem value="receiveTime">Receive time</MenuItem>
            <MenuItem value="headerStamp">header.stamp</MenuItem>
          </Select>
        </div>
      </Stack>

      <DialogFooter>
        <DefaultButton onClick={resetToDefaults}>Reset to defaults</DefaultButton>
        <DefaultButton primary onClick={onDismiss}>
          Done
        </DefaultButton>
      </DialogFooter>
    </Dialog>
  );
}
