// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IconButtonProps, Tooltip } from "@mui/material";
import { forwardRef } from "react";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  tooltip: {
    marginTop: `${theme.spacing(0.5)} !important`,
  },
  iconButton: {
    borderRadius: 0,
    fontSize: 24,
    padding: theme.spacing(1.25),

    "svg:not(.MuiSvgIcon-root)": {
      fontSize: "1em",
    },
    "&:hover": {
      backgroundColor: tinycolor(theme.palette.common.white).setAlpha(0.08).toRgbString(),
    },
    "&.Mui-selected": {
      backgroundColor: theme.palette.appBar.primary,
    },
    "&.Mui-disabled": {
      color: "currentColor",
      opacity: theme.palette.action.disabledOpacity,
    },
  },
}));

type AppBarIconButtonProps = Omit<IconButtonProps, "title"> & { title?: React.ReactNode };

export const AppBarIconButton = forwardRef<HTMLButtonElement, AppBarIconButtonProps>(
  (props, ref) => {
    const { title, className, children, color = "inherit", ...rest } = props;
    const { classes, cx } = useStyles();

    return (
      <Tooltip
        disableInteractive
        classes={{ tooltip: classes.tooltip }}
        title={title}
        arrow={false}
        enterDelay={200}
      >
        {/* Extra div to avoid issues with wrapping Tooltip around disabled buttons */}
        <div>
          <IconButton
            color={color}
            ref={ref}
            className={cx(classes.iconButton, className)}
            {...rest}
          >
            {children}
          </IconButton>
        </div>
      </Tooltip>
    );
  },
);

AppBarIconButton.displayName = "AppBarIconButton";
