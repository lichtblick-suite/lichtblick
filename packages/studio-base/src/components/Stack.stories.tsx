// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { StoryObj } from "@storybook/react";
import { PropsWithChildren } from "react";

import Stack, { StackProps } from "./Stack";

export default {
  component: Stack,
  title: "components/Stack",
};

const ITEMS = new Array(3).fill({});

function Box({ children }: PropsWithChildren<StackProps>): JSX.Element {
  const theme = useTheme();

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      padding={1}
      fullHeight
      style={{
        textAlign: "center",
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.action.hover,
      }}
    >
      {children}
    </Stack>
  );
}

export const Default: StoryObj = {
  render: () => {
    return (
      <Stack data-testid padding={2} gap={2} fullHeight>
        <Stack direction="row" gap={2}>
          {ITEMS.map((_, index) => (
            <Stack flex="auto" key={index}>
              <Box>{`Row item ${index + 1}`}</Box>
            </Stack>
          ))}
        </Stack>
        <Stack flexGrow={2} justifyContent="space-between" gap={2}>
          <Stack direction="row" gap={2} justifyContent="flex-start">
            {ITEMS.map((_, index) => (
              <Box key={index}>{`Row item ${index + 1}`}</Box>
            ))}
          </Stack>
          <Stack direction="row" justifyContent="center" gap={2} alignSelf="center">
            {ITEMS.map((_, index) => (
              <Box key={index}>{`Row item ${index + 1}`}</Box>
            ))}
          </Stack>
          <Stack direction="row" justifyContent="flex-end" gap={2} alignSelf="flex-end">
            {ITEMS.map((_, index) => (
              <Box key={index}>{`Row item ${index + 1}`}</Box>
            ))}
          </Stack>
        </Stack>
        <Stack gap={2} justifyContent="space-between">
          {ITEMS.map((_, index) => (
            <Stack flex="auto" key={index}>
              <Box>{`Col item ${index + 1}`}</Box>
            </Stack>
          ))}
        </Stack>
        <Stack flex="auto" gap={2} justifyContent="space-between">
          <Stack gap={2} alignSelf="flex-start">
            {ITEMS.map((_, index) => (
              <Box key={index}>{`Col item ${index + 1}`}</Box>
            ))}
          </Stack>
          <Stack gap={2} alignSelf="center">
            {ITEMS.map((_, index) => (
              <Box key={index}>{`Col item ${index + 1}`}</Box>
            ))}
          </Stack>
          <Stack gap={2} alignSelf="flex-end">
            {ITEMS.map((_, index) => (
              <Box key={index}>{`Col item ${index + 1}`}</Box>
            ))}
          </Stack>
        </Stack>
      </Stack>
    );
  },
};
