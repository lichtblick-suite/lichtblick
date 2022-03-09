// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton, Dialog, DialogFooter, getColorFromString, Text } from "@fluentui/react";
import { Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { useCallback } from "react";

import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import { useDialogHostId } from "@foxglove/studio-base/context/DialogHostIdContext";
import { colorObjToIColor, getColorFromIRGB } from "@foxglove/studio-base/util/colorUtils";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";

import { PlotPath } from "./internalTypes";
import { PlotConfig } from "./types";

type PathSettingsModalProps = {
  path: PlotPath;
  paths: PlotPath[];
  index: number;
  saveConfig: (arg0: Partial<PlotConfig>) => void;
  onDismiss: () => void;
};

const useStyles = makeStyles((theme: Theme) => ({
  label: {
    display: "block",
    fontWeight: "bold",
    margin: `${theme.spacing(0.5)} 0`,
  },
}));

export default function PathSettingsModal({
  path,
  paths,
  index,
  saveConfig,
  onDismiss,
}: PathSettingsModalProps): JSX.Element {
  const classes = useStyles();
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

  return (
    <Dialog
      hidden={false}
      onDismiss={onDismiss}
      dialogContentProps={{ title: path.value, showCloseButton: true }}
      modalProps={{ layerProps: { hostId } }}
      maxWidth={480}
      minWidth={480}
    >
      <Text variant="medium" className={classes.label}>
        Color
      </Text>
      <ColorPicker
        color={currentColor}
        onChange={(newColor) => savePathConfig({ color: colorObjToIColor(newColor).str })}
      />

      <DialogFooter>
        <DefaultButton onClick={resetToDefaults}>Reset to defaults</DefaultButton>
        <DefaultButton primary onClick={onDismiss}>
          Done
        </DefaultButton>
      </DialogFooter>
    </Dialog>
  );
}
