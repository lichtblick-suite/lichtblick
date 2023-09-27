// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// eslint-disable-next-line no-restricted-imports
import { Stack, Box, Typography, useTheme } from "@mui/material";
import { StoryObj } from "@storybook/react";

export default {
  title: "Theme/Palette",
};

export const Palette: StoryObj = {
  render: function Story() {
    const theme = useTheme();
    return (
      <Stack
        height="100%"
        width="100%"
        flexWrap="wrap"
        padding={2}
        gap={6}
        bgcolor="background.paper"
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
