// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AutoAwesomeMosaicIcon from "@mui/icons-material/AutoAwesomeMosaic";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  FilledInput,
  FormControl,
  Grid,
  Input,
  FormLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  useTheme,
} from "@mui/material";
import { StoryObj } from "@storybook/react";

import Stack from "@foxglove/studio-base/components/Stack";

export default {
  title: "MUI Components",
};

function FormElements(): JSX.Element {
  const theme = useTheme();
  return (
    <Stack
      fullHeight
      fullWidth
      padding={2}
      gap={2}
      style={{ backgroundColor: theme.palette.background.paper }}
    >
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <TextField autoFocus label="Text Field (outlined)" variant="outlined" />
        </Grid>
        <Grid item>
          <TextField label="Text Field (filled)" variant="filled" />
        </Grid>
        <Grid item>
          <TextField label="Text Field (standard)" variant="standard" />
        </Grid>
      </Grid>
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <OutlinedInput placeholder="Outlined Input" />
        </Grid>
        <Grid item>
          <FilledInput placeholder="Filled Input" />
        </Grid>
        <Grid item>
          <Input placeholder="Standard Input" />
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <OutlinedInput startAdornment={<VisibilityIcon />} placeholder="Outlined Input" />
        </Grid>
        <Grid item>
          <FilledInput startAdornment={<VisibilityIcon />} placeholder="Filled Input" />
        </Grid>
        <Grid item>
          <Input startAdornment={<VisibilityIcon />} placeholder="Standard Input" />
        </Grid>
      </Grid>
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <OutlinedInput endAdornment={<AutoAwesomeMosaicIcon />} placeholder="Outlined Input" />
        </Grid>
        <Grid item>
          <FilledInput endAdornment={<AutoAwesomeMosaicIcon />} placeholder="Filled Input" />
        </Grid>
        <Grid item>
          <Input endAdornment={<AutoAwesomeMosaicIcon />} placeholder="Standard Input" />
        </Grid>
      </Grid>

      {/* Small variants */}
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <TextField size="small" label="Text Field (outlined small)" variant="outlined" />
        </Grid>
        <Grid item>
          <TextField size="small" label="Text Field (filled small)" variant="filled" />
        </Grid>
        <Grid item>
          <TextField size="small" label="Text Field (filled small)" variant="standard" />
        </Grid>
      </Grid>
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <OutlinedInput size="small" placeholder="Outlined Input" />
        </Grid>
        <Grid item>
          <FilledInput size="small" placeholder="Filled Input" />
        </Grid>
        <Grid item>
          <Input size="small" placeholder="Standard Input" />
        </Grid>
      </Grid>
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <OutlinedInput
            size="small"
            startAdornment={<VisibilityIcon />}
            placeholder="Outlined Input"
          />
        </Grid>
        <Grid item>
          <FilledInput
            size="small"
            startAdornment={<VisibilityIcon />}
            placeholder="Filled Input"
          />
        </Grid>
        <Grid item>
          <Input size="small" startAdornment={<VisibilityIcon />} placeholder="Standard Input" />
        </Grid>
      </Grid>
      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <OutlinedInput
            size="small"
            endAdornment={<AutoAwesomeMosaicIcon />}
            placeholder="Outlined Input"
          />
        </Grid>
        <Grid item>
          <FilledInput
            size="small"
            endAdornment={<AutoAwesomeMosaicIcon />}
            placeholder="Filled Input"
          />
        </Grid>
        <Grid item>
          <Input
            size="small"
            endAdornment={<AutoAwesomeMosaicIcon />}
            placeholder="Standard Input"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <FormControl>
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select labelId="demo-simple-select-label" id="demo-simple-select" value={30}>
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl>
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              variant="filled"
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl>
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              variant="standard"
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <FormControl>
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              startAdornment={<VisibilityIcon />}
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl>
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              startAdornment={<VisibilityIcon />}
              variant="filled"
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl>
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              startAdornment={<VisibilityIcon />}
              variant="standard"
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <FormControl size="small">
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select labelId="demo-simple-select-label" id="demo-simple-select" value={30}>
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl size="small">
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              variant="filled"
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl size="small">
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              variant="standard"
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="flex-end">
        <Grid item>
          <FormControl size="small">
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              startAdornment={<VisibilityIcon />}
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl size="small">
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              variant="filled"
              startAdornment={<VisibilityIcon />}
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl size="small">
            <FormLabel id="demo-simple-select-label">Select</FormLabel>
            <Select
              startAdornment={<VisibilityIcon />}
              variant="standard"
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={30}
            >
              <MenuItem value={10}>ROS1</MenuItem>
              <MenuItem value={20}>ROS2</MenuItem>
              <MenuItem value={30}>Rosbridge</MenuItem>
              <MenuItem value={40}>MCAP</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Stack>
  );
}

export const FormElementsDark: StoryObj = {
  render: FormElements,
  parameters: { colorScheme: "dark" },
};

export const FormElementsLight: StoryObj = {
  render: FormElements,
  parameters: { colorScheme: "light" },
};
