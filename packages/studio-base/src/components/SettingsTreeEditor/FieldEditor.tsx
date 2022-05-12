// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import {
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  styled as muiStyled,
  List,
  MenuItem,
  Select,
  TextField,
  ListProps,
  useTheme,
} from "@mui/material";
import { DeepReadonly } from "ts-essentials";

import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import Stack from "@foxglove/studio-base/components/Stack";

import { ColorPickerInput, ColorGradientInput, NumberInput, Vec3Input } from "./inputs";
import { SettingsTreeAction, SettingsTreeField } from "./types";

const StyledToggleButtonGroup = muiStyled(ToggleButtonGroup)(({ theme }) => ({
  backgroundColor: theme.palette.action.hover,
  gap: theme.spacing(0.25),

  "& .MuiToggleButtonGroup-grouped": {
    margin: theme.spacing(0.55),
    borderRadius: theme.shape.borderRadius,
    paddingTop: 0,
    paddingBottom: 0,
    borderColor: "transparent",
    lineHeight: 1.75,

    "&.Mui-selected": {
      background: theme.palette.background.paper,
      borderColor: "transparent",

      "&:hover": {
        borderColor: theme.palette.action.active,
      },
    },
    "&:not(:first-of-type)": {
      borderRadius: theme.shape.borderRadius,
    },
    "&:first-of-type": {
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

const PsuedoInputWrapper = muiStyled(Stack)(({ theme }) => {
  const prefersDarkMode = theme.palette.mode === "dark";
  const backgroundColor = prefersDarkMode ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.06)";

  return {
    padding: theme.spacing(0.75, 1),
    borderRadius: theme.shape.borderRadius,
    fontSize: "0.75em",
    backgroundColor,

    input: {
      height: "1.4375em",
    },
    "&:hover": {
      backgroundColor: prefersDarkMode ? "rgba(255, 255, 255, 0.13)" : "rgba(0, 0, 0, 0.09)",
      // Reset on touch devices, it doesn't add specificity
      "@media (hover: none)": {
        backgroundColor,
      },
    },
    "&:focus-within": {
      backgroundColor,
    },
  };
});

function FieldInput({
  actionHandler,
  field,
  path,
}: {
  actionHandler: (action: SettingsTreeAction) => void;
  field: DeepReadonly<SettingsTreeField>;
  path: readonly string[];
}): JSX.Element {
  switch (field.input) {
    case "autocomplete":
      return (
        <Autocomplete
          size="small"
          freeSolo={true}
          value={field.value}
          ListboxComponent={List}
          ListboxProps={{ dense: true } as Partial<ListProps>}
          renderOption={(props, option, { selected }) => (
            <MenuItem selected={selected} {...props}>
              {option}
            </MenuItem>
          )}
          componentsProps={{ clearIndicator: { size: "small" } }}
          clearIcon={<ClearIcon fontSize="small" />}
          renderInput={(params) => <TextField {...params} variant="filled" size="small" />}
          onInputChange={(_event, value) =>
            actionHandler({ action: "update", payload: { path, input: "autocomplete", value } })
          }
          onChange={(_event, value) =>
            actionHandler({
              action: "update",
              payload: { path, input: "autocomplete", value: value ?? undefined },
            })
          }
          options={field.items}
        />
      );
    case "number":
      return (
        <NumberInput
          size="small"
          variant="filled"
          value={field.value}
          placeholder={field.placeholder}
          fullWidth
          max={field.max}
          min={field.min}
          step={field.step}
          onChange={(value) =>
            actionHandler({ action: "update", payload: { path, input: "number", value } })
          }
        />
      );
    case "toggle":
      return (
        <StyledToggleButtonGroup
          fullWidth
          value={field.value}
          exclusive
          size="small"
          onChange={(_event, value) =>
            actionHandler({ action: "update", payload: { path, input: "toggle", value } })
          }
        >
          {field.options.map((opt) => (
            <ToggleButton key={opt} value={opt}>
              {opt}
            </ToggleButton>
          ))}
        </StyledToggleButtonGroup>
      );
    case "string":
      return (
        <TextField
          variant="filled"
          size="small"
          fullWidth
          value={field.value}
          placeholder={field.placeholder}
          onChange={(event) =>
            actionHandler({
              action: "update",
              payload: { path, input: "string", value: event.target.value },
            })
          }
        />
      );
    case "boolean":
      return (
        <StyledToggleButtonGroup
          fullWidth
          value={field.value}
          exclusive
          size="small"
          onChange={(_event, value) => {
            if (value != undefined) {
              actionHandler({
                action: "update",
                payload: { path, input: "boolean", value },
              });
            }
          }}
        >
          <ToggleButton value={true}>On</ToggleButton>
          <ToggleButton value={false}>Off</ToggleButton>
        </StyledToggleButtonGroup>
      );
    case "rgb":
      return (
        <ColorPickerInput
          alphaType="none"
          placeholder={field.placeholder}
          value={field.value?.toString()}
          onChange={(value) =>
            actionHandler({
              action: "update",
              payload: { path, input: "rgb", value },
            })
          }
        />
      );
    case "rgba":
      return (
        <ColorPickerInput
          alphaType="alpha"
          placeholder={field.placeholder}
          value={field.value?.toString()}
          onChange={(value) =>
            actionHandler({
              action: "update",
              payload: { path, input: "rgba", value },
            })
          }
        />
      );
    case "messagepath":
      return (
        <PsuedoInputWrapper direction="row">
          <MessagePathInput
            path={field.value ?? ""}
            onChange={(value) =>
              actionHandler({
                action: "update",
                payload: { path, input: "messagepath", value },
              })
            }
            validTypes={field.validTypes}
          />
        </PsuedoInputWrapper>
      );
    case "select":
      return (
        <Select
          size="small"
          displayEmpty
          fullWidth
          variant="filled"
          value={field.value}
          onChange={(event) =>
            actionHandler({
              action: "update",
              payload: { path, input: "select", value: event.target.value },
            })
          }
          MenuProps={{ MenuListProps: { dense: true } }}
        >
          {field.options.map(({ label, value }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </Select>
      );
    case "gradient":
      return (
        <ColorGradientInput
          colors={field.value}
          onChange={(value) =>
            actionHandler({ action: "update", payload: { path, input: "gradient", value } })
          }
        />
      );
    case "vec3":
      return (
        <Vec3Input
          step={field.step}
          value={field.value}
          onChange={(value) =>
            actionHandler({ action: "update", payload: { path, input: "vec3", value } })
          }
        />
      );
  }
}

function FieldLabel({ field }: { field: DeepReadonly<SettingsTreeField> }): JSX.Element {
  const theme = useTheme();

  if (field.input === "vec3") {
    const labels = field.labels ?? ["X", "Y", "Z"];
    return (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            columnGap: theme.spacing(0.5),
            height: "100%",
            width: "100%",
            alignItems: "center",
          }}
        >
          <Typography
            title={field.label}
            variant="subtitle2"
            color="text.secondary"
            noWrap
            flex="auto"
          >
            {field.label}
          </Typography>
          {labels.map((label, index) => (
            <Typography
              key={label}
              title={field.label}
              variant="subtitle2"
              color="text.secondary"
              noWrap
              style={{ gridColumn: index === 0 ? "span 1" : "2 / span 1" }}
              flex="auto"
            >
              {label}
            </Typography>
          ))}
        </div>
      </>
    );
  } else {
    return (
      <>
        <Typography
          title={field.help ?? field.label}
          variant="subtitle2"
          color="text.secondary"
          noWrap
          flex="auto"
        >
          {field.label}
        </Typography>
      </>
    );
  }
}

function FieldEditorComponent({
  actionHandler,
  field,
  path,
}: {
  actionHandler: (action: SettingsTreeAction) => void;
  field: DeepReadonly<SettingsTreeField>;
  path: readonly string[];
}): JSX.Element {
  const theme = useTheme();
  const indent = Math.min(path.length, 4);
  const paddingLeft = theme.spacing(2 + 2 * Math.max(0, indent - 1));

  return (
    <>
      <Stack direction="row" alignItems="center" style={{ paddingLeft }} fullHeight>
        <FieldLabel field={field} />
      </Stack>
      <div style={{ paddingRight: theme.spacing(2) }}>
        <FieldInput actionHandler={actionHandler} field={field} path={path} />
      </div>
    </>
  );
}

export const FieldEditor = React.memo(FieldEditorComponent);
