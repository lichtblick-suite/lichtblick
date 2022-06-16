// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { styled as muiStyled } from "@mui/material";

const Outer = muiStyled("div")(({ theme }) => ({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  background: theme.palette.action.hover,
  zIndex: theme.zIndex.tooltip,
  pointerEvents: "none",
  padding: theme.spacing(5),
}));

const Inner = muiStyled("div")(({ theme }) => ({
  borderRadius: 16,
  height: "100%",
  border: `2px dashed ${theme.palette.text.primary}`,
  display: "flex",
  flexDirection: "column",
  textAlign: "center",
  alignItems: "center",
  justifyContent: "center",
  color: theme.palette.text.primary,
  fontWeight: 800,
  padding: theme.spacing(5),
  lineHeight: "normal",
}));

function DropOverlay({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Outer>
      <Inner>{children}</Inner>
    </Outer>
  );
}

export default DropOverlay;
