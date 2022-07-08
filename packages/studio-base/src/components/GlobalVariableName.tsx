// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { styled as muiStyled } from "@mui/material";

const StyledText = muiStyled("span")<{ paddingLeft: boolean }>(({ theme, paddingLeft }) => ({
  color: theme.palette.warning.main,
  maxWidth: 100,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  paddingLeft: paddingLeft ? "1ch" : undefined,
}));

export default function GlobalVariableName({
  name,
  paddingLeft = false,
}: {
  name: string;
  paddingLeft?: boolean;
}): JSX.Element {
  return <StyledText paddingLeft={paddingLeft} title={name}>{`$${name}`}</StyledText>;
}
