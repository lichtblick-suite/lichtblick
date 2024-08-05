// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppBar as MuiAppBar } from "@mui/material";
import { CSSProperties, PropsWithChildren, useCallback, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { APP_BAR_HEIGHT } from "./constants";

type Props = PropsWithChildren<{
  leftInset?: number;
  onDoubleClick?: () => void;
}>;

const useStyles = makeStyles()((theme) => {
  return {
    root: {
      gridArea: "appbar",
      boxShadow: "none",
      backgroundColor: theme.palette.appBar.main,
      borderBottom: "none",
      color: theme.palette.common.white,
      height: APP_BAR_HEIGHT,

      paddingRight: "calc(100% - env(titlebar-area-x) - env(titlebar-area-width))",
      WebkitAppRegion: "drag", // make custom window title bar draggable for desktop app
    },
  };
});

export function AppBarContainer(props: Props): JSX.Element {
  const { children, leftInset, onDoubleClick } = props;
  const { classes } = useStyles();

  // Leave space for system window controls on the right on Windows.
  // Use hard-coded padding for Mac because it looks better than env(titlebar-area-x).
  const extraStyle = useMemo<CSSProperties>(() => ({ paddingLeft: leftInset }), [leftInset]);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      onDoubleClick?.();
    },
    [onDoubleClick],
  );

  return (
    <MuiAppBar
      className={classes.root}
      style={extraStyle}
      position="relative"
      color="inherit"
      elevation={0}
      onDoubleClick={handleDoubleClick}
      data-tourid="app-bar"
    >
      {children}
    </MuiAppBar>
  );
}
