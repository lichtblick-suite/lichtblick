// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box, Typography, useTheme } from "@mui/material";
import { StoryObj } from "@storybook/react";
import { ReactNode } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

export default {
  title: "Theme",
};

export const Palette: StoryObj = {
  render: function Story() {
    const theme = useTheme();
    return (
      <Stack
        fullHeight
        fullWidth
        flexWrap="wrap"
        padding={2}
        gap={6}
        style={{ backgroundColor: theme.palette.background.paper }}
      >
        <Stack direction="row" gap={6}>
          <Stack gap={1}>
            <Typography variant="overline">Palette</Typography>
            <Stack direction="row" alignItems="center" gap={1}>
              {["dark", "main", "light"].map((variant) => (
                <Box
                  display="flex"
                  key={variant}
                  width={32}
                  alignItems="center"
                  justifyContent="center"
                >
                  {variant}
                </Box>
              ))}
            </Stack>
            {["primary", "secondary", "error", "warning", "info", "success"].map((color) => (
              <Stack key={color} direction="row" alignItems="center" gap={1}>
                {["dark", "main", "light"].map((variant) => (
                  <Box
                    display="flex"
                    key={`${color}.${variant}`}
                    width={32}
                    height={32}
                    bgcolor={`${color}.${variant}`}
                    color={`${color}.contrastText`}
                    alignItems="center"
                    justifyContent="center"
                  >
                    Aa
                  </Box>
                ))}
                {color}
              </Stack>
            ))}
          </Stack>

          <Stack gap={1}>
            <Typography variant="overline">Action</Typography>
            {["hover", "focus", "selected", "disabled", "active"].map((color) => (
              <Stack direction="row" key={color} alignItems="center" gap={1}>
                <Box
                  display="flex"
                  width={32}
                  height={32}
                  bgcolor={`action.${color}`}
                  alignItems="center"
                  justifyContent="center"
                >
                  Aa
                </Box>
                {color}
              </Stack>
            ))}
          </Stack>

          <Stack gap={1}>
            <Typography variant="overline">Background</Typography>
            {Object.keys(theme.palette.background).map((bgcolor) => (
              <Stack key={bgcolor} direction="row" alignItems="center" gap={1}>
                <Box
                  display="flex"
                  width={32}
                  height={32}
                  bgcolor={`background.${bgcolor}`}
                  alignItems="center"
                  justifyContent="center"
                  border="1px solid"
                  borderColor="divider"
                >
                  Aa
                </Box>
                <Box
                  display="flex"
                  width={32}
                  height={32}
                  bgcolor={`background.${bgcolor}`}
                  alignItems="center"
                  justifyContent="center"
                  boxShadow={8}
                >
                  Aa
                </Box>
                {bgcolor}
              </Stack>
            ))}
          </Stack>
        </Stack>

        <Stack gap={1}>
          <Typography variant="overline">Grey (with Divider border)</Typography>
          <Stack gap={1} direction="row" alignItems="center">
            {Object.keys(theme.palette.grey).map((key) => (
              <Stack key={key} alignItems="center" gap={1}>
                <Box
                  display="flex"
                  width={32}
                  height={32}
                  bgcolor={`grey.${key}`}
                  alignItems="center"
                  justifyContent="center"
                  border="1px solid"
                  borderColor="divider"
                >
                  Aa
                </Box>
                {key}
              </Stack>
            ))}
          </Stack>
        </Stack>
      </Stack>
    );
  },
};

function Wrapper({ children }: { children: ReactNode }): JSX.Element {
  return <Box sx={{ border: "1px dotted", borderColor: "info.main" }}>{children}</Box>;
}

export const TypographyCatalog: StoryObj = {
  render: function Story() {
    return (
      <Stack gap={1} padding={1}>
        <Wrapper>
          <Typography variant="h1" gutterBottom>
            h1. Heading
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="h2" gutterBottom>
            h2. Heading
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="h3" gutterBottom>
            h3. Heading
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="h4" gutterBottom>
            h4. Heading
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="h5" gutterBottom>
            h5. Heading
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="h6" gutterBottom>
            h6. Heading
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="subtitle1" gutterBottom>
            subtitle1. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quos blanditiis
            tenetur
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="subtitle2" gutterBottom>
            subtitle2. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quos blanditiis
            tenetur
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="body1" gutterBottom>
            body1. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quos blanditiis tenetur
            unde suscipit, quam beatae rerum inventore consectetur, neque doloribus, cupiditate
            numquam dignissimos laborum fugiat deleniti? Eum quasi quidem quibusdam.
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="body2" gutterBottom>
            body2. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quos blanditiis tenetur
            unde suscipit, quam beatae rerum inventore consectetur, neque doloribus, cupiditate
            numquam dignissimos laborum fugiat deleniti? Eum quasi quidem quibusdam.
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="button" display="block" gutterBottom>
            button text
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="caption" display="block" gutterBottom>
            caption text
          </Typography>
        </Wrapper>
        <Wrapper>
          <Typography variant="overline" display="block" gutterBottom>
            overline text
          </Typography>
        </Wrapper>
      </Stack>
    );
  },

  parameters: { colorScheme: "light" },
};
