// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Chip, TextField } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  input: {
    ".MuiInputBase-root.MuiInputBase-sizeSmall .MuiAutocomplete-input.MuiInputBase-inputSizeSmall":
      {
        paddingBottom: theme.spacing(0.425),
        paddingTop: theme.spacing(0.425),
      },
    ".MuiInputBase-root.MuiInputBase-sizeSmall": {
      padding: theme.spacing(0.125),
    },
    ".MuiAutocomplete-tag": {
      margin: 0,
    },
  },
  ".MuiAutocomplete-tag": {
    margin: theme.spacing(0),
  },
}));

export function FilterTagInput({
  items,
  suggestions,
  onChange,
}: {
  items: string[];
  suggestions: string[];
  onChange: (items: string[]) => void;
}): JSX.Element {
  const { classes } = useStyles();

  return (
    <Autocomplete
      value={items}
      multiple
      onChange={(_event, value) => onChange(value)}
      id="tags-filled"
      options={suggestions}
      freeSolo
      fullWidth
      renderTags={(value: readonly string[], getTagProps) =>
        value.map((option: string, index: number) => (
          // eslint-disable-next-line react/jsx-key
          <Chip variant="outlined" size="small" label={option} {...getTagProps({ index })} />
        ))
      }
      renderInput={(params) => (
        <TextField {...params} size="small" className={classes.input} placeholder="Search filter" />
      )}
    />
  );
}
