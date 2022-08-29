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

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const SKeyboardShortcut = muiStyled("div")(({ theme }) => ({
  padding: theme.spacing(0.5, 0),
  maxWidth: 400,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}));

const SDescription = muiStyled("div")(({ theme }) => ({
  marginRight: theme.spacing(2),
}));

const SKeyWrapper = muiStyled("div")(({ theme }) => ({
  display: "inline-flex",
  flex: "none",
  color: theme.palette.text.secondary,
  border: `1px solid ${theme.palette.text.secondary}`,
  borderRadius: theme.shape.borderRadius,
  fontSize: theme.typography.body2.fontSize,
  fontWeight: 500,
  minWidth: 20,
  alignItems: "center",
  justifyContent: "center",
}));

const SKey = muiStyled("kbd")(({ theme }) => ({
  padding: theme.spacing(0, 0.5),
  lineHeight: 1.5,
  fontFamily: fonts.SANS_SERIF,

  "&:not(:last-child)": {
    borderRight: `1px solid ${theme.palette.text.secondary}`,
  },
}));

type Props = {
  keys: string[];
  description?: string;
  descriptionMaxWidth?: number;
};

export default function KeyboardShortcut({
  keys,
  description,
  descriptionMaxWidth,
}: Props): JSX.Element {
  return (
    <SKeyboardShortcut>
      {description != undefined && description.length > 0 && (
        <SDescription
          style={descriptionMaxWidth != undefined ? { width: descriptionMaxWidth } : {}}
        >
          {description}
        </SDescription>
      )}
      <span>
        {keys.map((key, idx) => (
          <SKeyWrapper key={idx} style={idx < keys.length - 1 ? { marginRight: 4 } : {}}>
            <SKey>{key}</SKey>
          </SKeyWrapper>
        ))}
      </span>
    </SKeyboardShortcut>
  );
}
