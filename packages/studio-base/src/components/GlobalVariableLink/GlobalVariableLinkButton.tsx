// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddLinkIcon from "@mui/icons-material/AddLink";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { styled as muiStyled } from "@mui/material";

import HoverableIconButton, {
  HoverableIconButtonProps,
} from "@foxglove/studio-base/components/HoverableIconButton";

const StyledHoverableIconButton = muiStyled(HoverableIconButton)<{ linked: boolean }>(
  ({ theme, linked }) => ({
    padding: 0,
    opacity: linked ? 1 : theme.palette.action.disabledOpacity,

    "&:hover": {
      backgroundColor: "transparent",
      opacity: 1,
    },
  }),
);

export default function GlobalVariableLinkButton(
  props: {
    linked?: boolean;
    icon?: HoverableIconButtonProps["icon"];
  } & Omit<HoverableIconButtonProps, "icon">,
): JSX.Element {
  const { linked = false, ...rest } = props;

  return (
    <StyledHoverableIconButton
      {...rest}
      linked={linked}
      icon={linked ? <LinkIcon fontSize="small" /> : <AddLinkIcon fontSize="small" />}
      activeIcon={linked ? <LinkOffIcon fontSize="small" /> : undefined}
    />
  );
}
