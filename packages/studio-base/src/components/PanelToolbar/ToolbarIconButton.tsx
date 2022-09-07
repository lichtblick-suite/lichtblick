// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IconButtonProps, styled as muiStyled } from "@mui/material";
import { ForwardedRef, forwardRef } from "react";

const StyledIconButton = muiStyled(IconButton, {
  shouldForwardProp: (prop) => prop !== "subMenuActive",
})<{ subMenuActive: boolean }>(({ subMenuActive, theme }) => ({
  padding: theme.spacing(0.375),
  fontSize: "0.875rem",

  ...(subMenuActive && {
    visibility: "visible",
  }),
  ".MuiSvgIcon-root, svg:not(.MuiSvgIcon-root)": {
    height: "1em",
    width: "1em",
    fontSize: "inherit",
  },
}));

export default forwardRef(function ToolbarIconButton(
  props: {
    subMenuActive?: boolean;
    title?: string;
  } & Partial<IconButtonProps>,
  ref: ForwardedRef<HTMLButtonElement>,
): React.ReactElement {
  return (
    <StyledIconButton
      ref={ref}
      subMenuActive={props.subMenuActive === true}
      aria-label={props.title}
      {...props}
    />
  );
});
