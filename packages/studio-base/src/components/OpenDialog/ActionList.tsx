// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, IButtonStyles, IButtonProps, useTheme } from "@fluentui/react";
import { Typography } from "@mui/material";
import { ReactNode, useMemo } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

type IActionListProps = {
  title?: ReactNode;
  items: IButtonProps[];
};

export default function ActionList(props: IActionListProps): JSX.Element {
  const { items, title } = props;
  const theme = useTheme();

  const actionButtonStyles = useMemo(
    () =>
      ({
        root: {
          padding: 0,
          color: theme.palette.themePrimary,
          minWidth: 320,
          height: 24,
        },
        flexContainer: {
          overflow: "hidden",
        },
        textContainer: {
          overflow: "hidden",
        },
        label: {
          margin: 0,
          fontSize: theme.fonts.smallPlus.fontSize,
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          overflow: "hidden",
        },
        labelHovered: {
          color: theme.palette.themeDark,
        },
      } as Partial<IButtonStyles>),
    [theme],
  );

  return (
    <Stack gap={1}>
      {title != undefined && (
        <Typography variant="h5" color="text.secondary">
          {title}
        </Typography>
      )}
      <Stack>
        {items.map(({ id, ...item }) => (
          <ActionButton key={id} id={id} styles={actionButtonStyles} {...item} />
        ))}
      </Stack>
    </Stack>
  );
}
