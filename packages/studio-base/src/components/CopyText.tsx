// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, Text, ITextProps, Stack, makeStyles, useTheme } from "@fluentui/react";

import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import clipboard from "@foxglove/studio-base/util/clipboard";

const useStyles = makeStyles({
  root: {
    "& > :last-child": {
      visibility: "hidden",
    },
    ":hover > :last-child": {
      visibility: "visible",
    },
  },
});

type Props = {
  copyText: string;
  textProps?: ITextProps;
  tooltip: string;
  children: React.ReactNode;
};

export default function CopyText({
  copyText,
  textProps,
  tooltip,
  children,
}: Props): JSX.Element | ReactNull {
  const classes = useStyles();
  const theme = useTheme();
  const button = useTooltip({ contents: tooltip });

  if (copyText.length === 0 || children == undefined) {
    return ReactNull;
  }

  return (
    <Stack
      className={classes.root}
      horizontal
      verticalAlign="center"
      onClick={() => void clipboard.copy(copyText)}
      styles={{
        root: {
          userSelect: "none",
          cursor: "pointer",

          ":active": {
            color: theme.semanticColors.buttonTextPressed,
          },
        },
      }}
    >
      <Stack.Item
        grow
        styles={{
          root: {
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            overflow: "hidden",
          },
        }}
      >
        <Text {...textProps}>{children != undefined ? children : copyText}</Text>
      </Stack.Item>
      {button.tooltip}
      <IconButton
        elementRef={button.ref}
        iconProps={{ iconName: "Clipboard" }}
        onClick={() => {}}
        styles={{
          root: { backgroundColor: "transparent", width: 18, height: 18 },
          rootHovered: { backgroundColor: "transparent" },
          rootPressed: { backgroundColor: "transparent" },

          icon: {
            fontSize: 12,
            height: 12,
            width: 12,
            svg: { fill: "currentColor", height: "1em", width: "1em" },
          },
        }}
      />
    </Stack>
  );
}
