// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import {
  Autocomplete,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField as MuiTextField,
  TextFieldProps,
  Typography,
  Stack,
  TextField,
} from "@mui/material";
import { Meta } from "@storybook/react";
import { Fragment } from "react";

const options = [{ label: "Small" }, { label: "Medium" }];

export default {
  title: "Theme/Inputs/TextField",
  args: {},
} as Meta;

export const Default = {
  render: (): JSX.Element => (
    <Stack direction="row" justifyContent="center" alignItems="center" padding={2} gap={2}>
      <TextField id="outlined-basic" label="Outlined" variant="outlined" />
      <TextField id="filled-basic" label="Filled" variant="filled" />
      <TextField id="standard-basic" label="Standard" variant="standard" />
    </Stack>
  ),
};

export const VariantsLight = {
  render: (): JSX.Element => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, max-content)",
        alignItems: "flex-end",
        padding: 16,
        columnGap: 16,
        rowGap: 12,
      }}
    >
      {["primary", "secondary", "error"].map((color) => (
        <Fragment key={color}>
          {["outlined", "filled", "standard"].map((variant) => {
            return (
              <Fragment key={variant}>
                <Typography variant="overline" style={{ gridColumn: "span 5" }}>
                  {variant}
                </Typography>
                {["small", "medium"].map((size) => (
                  <Fragment key={size}>
                    <Autocomplete
                      value={{ label: size }}
                      getOptionLabel={(option: { label: string }) => option.label}
                      options={options}
                      renderInput={(params) => (
                        <MuiTextField
                          {...params}
                          size={size as TextFieldProps["size"]}
                          variant={variant as TextFieldProps["variant"]}
                          error={color === "error"}
                          color={color !== "error" ? (color as TextFieldProps["color"]) : undefined}
                          label="Autocomplete"
                          id="auto-complete-variant-size-small"
                        />
                      )}
                    />

                    <MuiTextField
                      variant={variant as TextFieldProps["variant"]}
                      error={color === "error"}
                      color={color !== "error" ? (color as TextFieldProps["color"]) : undefined}
                      label="TextField"
                      defaultValue={size}
                      size={size as TextFieldProps["size"]}
                    />

                    <MuiTextField
                      variant={variant as TextFieldProps["variant"]}
                      error={color === "error"}
                      color={color !== "error" ? (color as TextFieldProps["color"]) : undefined}
                      label="Disabled"
                      disabled
                      value={size}
                      size={size as TextFieldProps["size"]}
                    />

                    <MuiTextField
                      error={color === "error"}
                      color={color !== "error" ? (color as TextFieldProps["color"]) : undefined}
                      variant={variant as TextFieldProps["variant"]}
                      size={size as TextFieldProps["size"]}
                      placeholder={size}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <FilterListIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <FormControl variant={variant as TextFieldProps["variant"]}>
                      <InputLabel id={`variant-size-${size}-select-label`}>Select</InputLabel>
                      <Select
                        labelId={`variant-size-${size}-select-label`}
                        id={`variant-size-${size}-select`}
                        size={size as TextFieldProps["size"]}
                        error={color === "error"}
                        color={color !== "error" ? (color as TextFieldProps["color"]) : undefined}
                        defaultValue="small"
                      >
                        <MenuItem value="small">{size}</MenuItem>
                      </Select>
                    </FormControl>
                  </Fragment>
                ))}
              </Fragment>
            );
          })}
          <Divider sx={{ gridColumn: "span 5" }} />
        </Fragment>
      ))}
    </div>
  ),
  parameters: { colorScheme: "light" },
};

export const VariantsDark = {
  ...VariantsLight,
  parameters: { colorScheme: "dark" },
};
