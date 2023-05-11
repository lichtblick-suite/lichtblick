// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IconButtonProps } from "@mui/material";
import { ForwardedRef, forwardRef } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(0.375),
    fontSize: "0.875rem",

    ".MuiSvgIcon-root, svg:not(.MuiSvgIcon-root)": {
      height: "1em",
      width: "1em",
      fontSize: "inherit",
    },
  },
}));

export default forwardRef(function ToolbarIconButton(
  props: IconButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
): React.ReactElement {
  const { className, ...rest } = props;
  const { classes, cx } = useStyles();

  return <IconButton ref={ref} className={cx(classes.root, className)} {...rest} />;
});
