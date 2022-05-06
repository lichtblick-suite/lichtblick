// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { styled as muiStyled, alpha } from "@mui/material";
import cx from "classnames";

export const PANEL_ROOT_CLASSNAME = "FoxglovePanel-root";
export const PANEL_ROOT_SELECTOR = `.${PANEL_ROOT_CLASSNAME}`;

const PanelBase = muiStyled("div", {
  name: "FoxglovePanel",
  slot: "Root",
  shouldForwardProp: (prop) => prop !== "fullscreen" && prop !== "selected",
})<{ fullscreen: boolean; selected: boolean }>(({ theme, fullscreen, selected }) => ({
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  overflow: "hidden",
  backgroundColor: theme.palette.background.default,
  position: "relative",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,

  ...(fullscreen && {
    position: "fixed",
    border: `4px solid ${alpha(
      theme.palette.primary.main,
      theme.palette.mode === "dark" ? 0.67 : 0.34,
    )}`,
    bottom: 50,
    zIndex: 100000,
  }),
  "&:after": {
    content: "''",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: selected ? 1 : 0,
    border: `1px solid ${theme.palette.info.main}`,
    position: "absolute",
    pointerEvents: "none",
    transition: selected ? "opacity 0.125s ease-out" : "opacity 0.05s ease-out",
    zIndex: 100000,
  },
}));

export const PanelRoot = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof PanelBase>>(
  function PanelRoot({ className, ...props }, ref): JSX.Element {
    return <PanelBase ref={ref} className={cx(className, PANEL_ROOT_CLASSNAME)} {...props} />;
  },
);
