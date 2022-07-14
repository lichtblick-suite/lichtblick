// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getColorFromString } from "@fluentui/react";
import CloseIcon from "@mui/icons-material/Close";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormLabel,
  IconButton,
  MenuItem,
  Select,
  styled as muiStyled,
} from "@mui/material";
import { useCallback } from "react";

import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import Stack from "@foxglove/studio-base/components/Stack";
import { colorObjToIColor, getColorFromIRGB } from "@foxglove/studio-base/util/colorUtils";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

import { isReferenceLinePlotPathType, PlotPath } from "./internalTypes";
import { PlotXAxisVal } from "./types";

type PathSettingsModalProps = {
  xAxisVal: PlotXAxisVal;
  path: PlotPath;
  paths: PlotPath[];
  index: number;
  savePaths: (paths: PlotPath[]) => void;
  onDismiss: () => void;
};

const StyledDialogTitle = muiStyled(DialogTitle)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

export default function PathSettingsModal({
  xAxisVal,
  path,
  paths,
  index,
  savePaths,
  onDismiss,
}: PathSettingsModalProps): JSX.Element {
  const savePathConfig = useCallback(
    (newConfig: Partial<PlotPath>) => {
      const newPaths = paths.slice();
      const newPath = newPaths[index];
      if (newPath) {
        newPaths[index] = { ...newPath, ...newConfig };
      }
      savePaths(newPaths);
    },
    [paths, index, savePaths],
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
    <Dialog open onClose={onDismiss} maxWidth="xs" fullWidth>
      <StyledDialogTitle>
        {path.value}
        <IconButton onClick={onDismiss} edge="end">
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>
      <DialogContent>
        <Stack alignItems="flex-start" gap={1}>
          <FormControl>
            <FormLabel>Color</FormLabel>
            <ColorPicker
              color={currentColor}
              onChange={(newColor) => savePathConfig({ color: colorObjToIColor(newColor).str })}
            />
          </FormControl>

          <FormControl>
            <FormLabel>Timestamp method</FormLabel>
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
          </FormControl>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button size="large" variant="outlined" color="inherit" onClick={resetToDefaults}>
          Reset to defaults
        </Button>
        <Button size="large" variant="contained" onClick={onDismiss}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
