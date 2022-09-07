// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, ButtonBase, Popover, SvgIcon } from "@mui/material";
import { MouseEvent, useCallback, useMemo, useState } from "react";
import tinycolor, { ColorFormats } from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import { ColorPickerControl } from "@foxglove/studio-base/components/SettingsTreeEditor/inputs/ColorPickerControl";

type Props = {
  color?: ColorFormats.RGBA;
  onChange: (newColor: ColorFormats.RGBA) => void;
  buttonShape?: "circle" | "default";
  circleSize?: number;
  alphaType?: "alpha" | "none";
};

const useStyles = makeStyles()((theme) => ({
  circleButton: {
    borderRadius: "50%",
    border: `1px solid ${theme.palette.text.primary}`,
  },
}));

// Returns a button that pops out an ColorPicker in MUI Popover
export default function ColorPicker({
  color,
  circleSize = 25,
  onChange,
  buttonShape,
  alphaType = "none",
}: Props): JSX.Element {
  const { classes } = useStyles();
  const hexColor = tinycolor(color).toHexString();
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const handleClick = useCallback((event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(undefined);
  }, []);

  const button = useMemo(
    () =>
      buttonShape === "circle" ? (
        <ButtonBase
          className={classes.circleButton}
          data-testid="color-picker-button"
          aria-controls={open ? "color-picker-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={handleClick}
          style={{
            fontSize: circleSize - 2,
            height: circleSize,
            width: circleSize,
          }}
        >
          <SvgIcon fontSize="inherit">
            <circle fill={hexColor} cx={12} cy={12} r={12} />
          </SvgIcon>
        </ButtonBase>
      ) : (
        <Button
          variant="outlined"
          color="secondary"
          data-testid="color-picker-button"
          aria-controls={open ? "color-picker-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={handleClick}
          style={{ backgroundColor: hexColor }}
        >
          &nbsp;
        </Button>
      ),
    [buttonShape, circleSize, classes, handleClick, hexColor, open],
  );

  const onChangeCallback = useCallback(
    (newColor: string) => {
      const parsed = tinycolor(newColor).toRgb();
      onChange(parsed);
    },
    [onChange],
  );

  return (
    <div>
      {button}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        <ColorPickerControl alphaType={alphaType} value={hexColor} onChange={onChangeCallback} />
      </Popover>
    </div>
  );
}
