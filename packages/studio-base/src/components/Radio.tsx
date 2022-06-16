// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import RadioButtonUncheckedIcon from "@mdi/svg/svg/radiobox-blank.svg";
import RadioButtonCheckedIcon from "@mdi/svg/svg/radiobox-marked.svg";
import { alpha, styled as muiStyled } from "@mui/material";
import { ReactElement } from "react";

import Icon from "./Icon";

export type RadioOption<Key extends string> = {
  id: Key;
  label: React.ReactNode;
};

export type RadioProps<Key extends string> = {
  options: RadioOption<Key>[];
  selectedId?: Key;
  onChange: (selectedId: Key) => void;
};

const SOption = muiStyled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  outline: 0,

  "&:not(:last-child)": {
    marginBottom: theme.spacing(1),
  },
  "> .icon svg": {
    flex: "none",
    transition: "all 80ms ease-in-out",
    borderRadius: "50%",
  },
  "&:hover > .icon svg": {
    opacity: 0.8,
  },
  "&:focus-within, &:focus, &:active": {
    "> .icon svg": {
      boxShadow: `0 0 0 2px ${alpha(theme.palette.common.white, 0.2)}`,
    },
  },
}));

const SLabel = muiStyled("div")(({ theme }) => ({
  marginLeft: theme.spacing(1),
  overflow: "hidden",
}));

export default function Radio<Key extends string>(props: RadioProps<Key>): ReactElement {
  const { options, selectedId, onChange, ...restProps } = props;
  return (
    <>
      {options.map(({ id, label }: RadioOption<Key>) => (
        <SOption tabIndex={0} key={id} data-test={id} onClick={() => onChange(id)} {...restProps}>
          <Icon size="small">
            {id === selectedId ? <RadioButtonCheckedIcon /> : <RadioButtonUncheckedIcon />}
          </Icon>
          <SLabel>{label}</SLabel>
        </SOption>
      ))}
    </>
  );
}
