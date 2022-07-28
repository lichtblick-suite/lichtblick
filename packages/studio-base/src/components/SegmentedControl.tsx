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
import { ReactElement } from "react";

const SSegmentedControl = muiStyled("div")(({ theme }) => ({
  whiteSpace: "nowrap",
  display: "inline-flex",
  padding: theme.spacing(0.5),
  borderRadius: 6,
  backgroundColor: theme.palette.action.hover,
  outline: 0,

  "&:focus-within, &:focus, &:active": {
    outline: `solid 2px ${theme.palette.action.selected}`,
    outlineOffset: -2,
  },
}));

const SOption = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "isSelected",
})<{
  isSelected: boolean;
}>(({ theme, isSelected }) => ({
  flex: "none",
  cursor: "pointer",
  transition: "all 80ms ease-in-out",
  borderRadius: 4,
  backgroundColor: isSelected ? theme.palette.primary.main : "transparent",
  color: isSelected ? theme.palette.primary.contrastText : theme.palette.text.secondary,
  padding: theme.spacing(1, 2),

  "&:hover": {
    color: theme.palette.text.primary,
  },
}));

export type Option = {
  id: string;
  label: string;
};

type Props = {
  options: Option[];
  selectedId: string;
  onChange: (id: string) => void;
};

export default function SegmentedControl({ options, selectedId, onChange }: Props): ReactElement {
  if (options.length === 0) {
    throw new Error("<SegmentedControl> requires at least one option");
  }

  return (
    <SSegmentedControl tabIndex={0}>
      {options.map(({ id, label }) => (
        <SOption
          key={id}
          data-testid={id}
          onClick={() => onChange(id)}
          isSelected={selectedId === id}
        >
          {label}
        </SOption>
      ))}
    </SSegmentedControl>
  );
}
