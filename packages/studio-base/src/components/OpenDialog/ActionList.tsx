// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ActionButton, Text, IButtonStyles, IButtonProps, useTheme } from "@fluentui/react";
import { Stack } from "@mui/material";
import { ReactNode, useMemo } from "react";

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
    <Stack spacing={1}>
      {title != undefined && (
        <Text variant="large" styles={{ root: { color: theme.semanticColors.bodySubtext } }}>
          {title}
        </Text>
      )}
      <Stack>
        {items.map(({ id, ...item }) => (
          <ActionButton key={id} id={id} styles={actionButtonStyles} {...item} />
        ))}
      </Stack>
    </Stack>
  );
}
