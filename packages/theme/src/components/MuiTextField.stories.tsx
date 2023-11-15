// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import {
  Autocomplete,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField as MuiTextField,
  TextFieldProps,
  Typography,
  TextField,
} from "@mui/material";
import { Meta, StoryObj } from "@storybook/react";
import { Fragment } from "react";

const options = [{ label: "Small" }, { label: "Medium" }];
const sizes: TextFieldProps["size"][] = ["small", "medium"];
const variants: TextFieldProps["variant"][] = ["outlined", "filled", "standard"];

type Story = StoryObj<TextFieldProps>;

export default {
  title: "Theme/Inputs/TextField",
  args: {
    color: "primary",
  },
  argTypes: {
    color: {
      options: ["error", "primary", "secondary", "info", "success", "warning"],
      control: { type: "radio" },
    },
  },
  parameters: { colorScheme: "light" },
  decorators: [
    (_StoryFn, { args: { color } }): JSX.Element => {
      const sharedProps = (variant: TextFieldProps["variant"], size: TextFieldProps["size"]) => ({
        defaultValue: size,
        error: color === "error",
        size: size as TextFieldProps["size"],
        variant: variant as TextFieldProps["variant"],
      });

      return (
        <div
          style={{
            overflow: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(7, 150px)",
            alignItems: "flex-end",
            padding: 16,
            columnGap: 16,
            rowGap: 12,
          }}
        >
          {variants.map((variant) => {
            return (
              <Fragment key={variant}>
                <Typography variant="overline" style={{ gridColumn: "span 7" }}>
                  {variant}
                </Typography>
                {sizes.map((size) => (
                  <Fragment key={size}>
                    <MuiTextField {...sharedProps(variant, size)} color={color} label="Default" />

                    <MuiTextField
                      {...sharedProps(variant, size)}
                      color={color}
                      label="Placeholder"
                      placeholder={size}
                    />

                    <MuiTextField
                      {...sharedProps(variant, size)}
                      focused
                      color={color}
                      label="Focused"
                    />

                    <MuiTextField
                      {...sharedProps(variant, size)}
                      color={color}
                      label="Disabled"
                      disabled
                    />

                    <MuiTextField
                      {...sharedProps(variant, size)}
                      color={color}
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

                    <Autocomplete
                      value={{ label: size as string }}
                      getOptionLabel={(option: { label: string }) => option.label}
                      options={options}
                      renderInput={(params) => (
                        <MuiTextField
                          {...params}
                          {...sharedProps(variant, size)}
                          color={color}
                          label="Autocomplete"
                          id={`autocomplete-${variant}-${size}`}
                        />
                      )}
                    />

                    <FormControl color={color} variant={variant as TextFieldProps["variant"]}>
                      <InputLabel id={`${variant}-${size}-select-label`}>Select</InputLabel>
                      <Select
                        labelId={`${variant}-${size}-select-label`}
                        id={`${variant}-${size}-select`}
                        {...sharedProps(variant, size)}
                      >
                        <MenuItem value={size}>{size}</MenuItem>
                      </Select>
                    </FormControl>
                  </Fragment>
                ))}
              </Fragment>
            );
          })}
        </div>
      );
    },
  ],
} as Meta<typeof TextField>;

export const DefaultLight: Story = {};

export const DefaultDark: Story = {
  parameters: { colorScheme: "dark" },
};

export const ErrorLight: Story = {
  args: { color: "error" },
};

export const ErrorDark: Story = {
  args: { color: "error" },
  parameters: { colorScheme: "dark" },
};
