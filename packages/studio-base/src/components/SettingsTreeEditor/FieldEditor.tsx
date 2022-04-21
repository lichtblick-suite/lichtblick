// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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
  IconButton,
  ListProps,
  useTheme,
} from "@mui/material";
import { DeepReadonly } from "ts-essentials";

import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import messagePathHelp from "@foxglove/studio-base/components/MessagePathSyntax/index.help.md";
import Stack from "@foxglove/studio-base/components/Stack";
import { useHelpInfo } from "@foxglove/studio-base/context/HelpInfoContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";

import { ColorPickerInput, ColorScalePicker, NumberInput } from "./inputs";
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

const StyledIconButton = muiStyled(IconButton)(({ theme, edge }) => ({
  marginTop: theme.spacing(-0.5),
  marginBottom: theme.spacing(-0.5),

  ...(edge === "end" && {
    marginRight: theme.spacing(-0.75),
  }),
}));

function FieldInput({
  actionHandler,
  field,
  path,
}: {
  actionHandler: (action: SettingsTreeAction) => void;
  field: DeepReadonly<SettingsTreeField>;
  path: readonly string[];
}): JSX.Element {
  const { openHelp } = useWorkspace();
  const { setHelpInfo } = useHelpInfo();

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
    case "string": {
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
    }
    case "boolean": {
      return (
        <StyledToggleButtonGroup
          fullWidth
          value={field.value}
          exclusive
          size="small"
          onChange={(_event, value) =>
            actionHandler({
              action: "update",
              payload: { path, input: "boolean", value },
            })
          }
        >
          <ToggleButton value={true}>On</ToggleButton>
          <ToggleButton value={false}>Off</ToggleButton>
        </StyledToggleButtonGroup>
      );
    }
    case "color": {
      return (
        <ColorPickerInput
          value={field.value?.toString()}
          size="small"
          variant="filled"
          fullWidth
          onChange={(value) =>
            actionHandler({
              action: "update",
              payload: { path, input: "color", value },
            })
          }
        />
      );
    }
    case "messagepath": {
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
          <StyledIconButton
            size="small"
            color="secondary"
            title="Message path syntax documentation"
            onClick={() => {
              setHelpInfo({ title: "MessagePathSyntax", content: messagePathHelp });
              openHelp();
            }}
            edge="end"
          >
            <InfoOutlinedIcon fontSize="inherit" />
          </StyledIconButton>
        </PsuedoInputWrapper>
      );
    }
    case "select": {
      return (
        <Select
          size="small"
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
    }
    case "gradient": {
      return <ColorScalePicker color="inherit" size="small" />;
    }
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
      <Stack direction="row" alignItems="center" style={{ paddingLeft }}>
        <Typography
          title={field.label}
          variant="subtitle2"
          color="text.secondary"
          noWrap
          flex="auto"
        >
          {field.label}
        </Typography>
        {field.help && (
          <IconButton size="small" color="secondary" title={field.help}>
            <HelpOutlineIcon fontSize="inherit" />
          </IconButton>
        )}
      </Stack>
      <div style={{ paddingRight: theme.spacing(2) }}>
        <FieldInput actionHandler={actionHandler} field={field} path={path} />
      </div>
    </>
  );
}

export const FieldEditor = React.memo(FieldEditorComponent);
