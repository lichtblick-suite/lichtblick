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
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Theme,
} from "@mui/material";
import { makeStyles } from "@mui/styles";

export default {
  title: "MUI Components",
};

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(2),
    height: "100%",
    width: "100%",
    backgroundColor: theme.palette.background.paper,
    gap: theme.spacing(2),
  },
}));

function FormElements(): JSX.Element {
  const classes = useStyles();
  return (
    <div className={classes.root}>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
            <InputLabel id="demo-simple-select-label">Select</InputLabel>
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
    </div>
  );
}

export const FormElementsDark = (): JSX.Element => FormElements();
FormElementsDark.parameters = { colorScheme: "dark" };

export const FormElementsLight = (): JSX.Element => FormElements();
FormElementsLight.parameters = { colorScheme: "light" };
