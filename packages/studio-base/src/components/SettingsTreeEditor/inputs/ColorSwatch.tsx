// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Theme, useTheme } from "@mui/material";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

function calculateBorderColor(theme: Theme, color: string): string {
  const parsedColor = tinycolor(color);
  return parsedColor.isValid()
    ? theme.palette.getContrastText(parsedColor.toHexString())
    : theme.palette.text.primary;
}

type ColorSwatchProps = {
  color: string;
  size?: "small" | "medium" | "large";
} & React.HTMLAttributes<HTMLDivElement>;

const useStyles = makeStyles()((theme) => ({
  root: {
    // Color on top of white/black diagonal gradient. Color must be specified as a gradient because a
    // background color can't be stacked on top of a background image.
    backgroundImage: `linear-gradient(to bottom right, white 50%, black 50%)`,
    borderRadius: theme.shape.borderRadius,
    display: "inline-flex",
    aspectRatio: "1/1",
    flexShrink: 0,
  },
  swatch: {
    aspectRatio: "1/1",
  },
  sizeSmall: {
    height: theme.spacing(2),
    width: theme.spacing(2),
  },
  sizeMedium: {
    height: theme.spacing(2),
    width: theme.spacing(2),
  },
  sizeLarge: {
    height: theme.spacing(3),
    width: theme.spacing(3),
  },
}));

export function ColorSwatch(props: ColorSwatchProps): JSX.Element {
  const { color, size = "medium", className, ...rest } = props;
  const { classes, cx } = useStyles();
  const theme = useTheme();
  return (
    <div
      className={cx(
        classes.root,
        {
          [classes.sizeSmall]: size === "small",
          [classes.sizeMedium]: size === "medium",
          [classes.sizeLarge]: size === "large",
        },
        className,
      )}
      {...rest}
    >
      <div
        title={color}
        className={classes.swatch}
        style={{
          backgroundColor: color,
          border: `1px solid ${calculateBorderColor(theme, color)}`,
        }}
      />
    </div>
  );
}
