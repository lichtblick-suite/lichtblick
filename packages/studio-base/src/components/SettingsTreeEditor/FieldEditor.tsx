// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CancelIcon from "@mui/icons-material/Cancel";
import ErrorIcon from "@mui/icons-material/Error";
import {
  Autocomplete,
  MenuItem,
  MenuList,
  MenuListProps,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { v4 as uuid } from "uuid";

import { Immutable, SettingsTreeAction, SettingsTreeField } from "@foxglove/studio";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";

import { ColorGradientInput, ColorPickerInput, NumberInput, Vec2Input, Vec3Input } from "./inputs";

/** Used to allow both undefined and empty string in select inputs. */
const UNDEFINED_SENTINEL_VALUE = uuid();
/** Used to avoid MUI errors when an invalid option is selected */
const INVALID_SENTINEL_VALUE = uuid();

const useStyles = makeStyles<void, "error">()((theme, _params, classes) => ({
  autocomplete: {
    ".MuiInputBase-root.MuiInputBase-sizeSmall": {
      paddingInline: 0,
      paddingBlock: theme.spacing(0.3125),
    },
  },
  clearIndicator: {
    marginRight: theme.spacing(-0.25),
    opacity: theme.palette.action.disabledOpacity,

    ":hover": {
      background: "transparent",
      opacity: 1,
    },
  },
  error: {},
  fieldLabel: {
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fieldWrapper: {
    minWidth: theme.spacing(14),
    marginRight: theme.spacing(0.5),
    [`&.${classes.error} .MuiInputBase-root, .MuiInputBase-root.${classes.error}`]: {
      outline: `1px ${theme.palette.error.main} solid`,
      outlineOffset: -1,
    },
  },
  multiLabelWrapper: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    columnGap: theme.spacing(0.5),
    height: "100%",
    width: "100%",
    alignItems: "center",
    textAlign: "end",
  },
  styledToggleButtonGroup: {
    backgroundColor: theme.palette.action.hover,
    gap: theme.spacing(0.25),
    overflowX: "auto",

    "& .MuiToggleButtonGroup-grouped": {
      margin: theme.spacing(0.55),
      borderRadius: theme.shape.borderRadius,
      paddingTop: 0,
      paddingBottom: 0,
      borderColor: "transparent !important",
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
  },
}));

function FieldInput({
  actionHandler,
  field,
  path,
}: {
  actionHandler: (action: SettingsTreeAction) => void;
  field: Immutable<SettingsTreeField>;
  path: readonly string[];
}): JSX.Element {
  const { classes, cx } = useStyles();

  switch (field.input) {
    case "autocomplete":
      return (
        <Autocomplete
          className={classes.autocomplete}
          size="small"
          freeSolo={true}
          value={field.value}
          disabled={field.disabled}
          readOnly={field.readonly}
          ListboxComponent={MenuList}
          ListboxProps={{ dense: true } as Partial<MenuListProps>}
          renderOption={(props, option, { selected }) => (
            <MenuItem selected={selected} {...props}>
              {option}
            </MenuItem>
          )}
          componentsProps={{
            clearIndicator: {
              size: "small",
              className: classes.clearIndicator,
            },
          }}
          clearIcon={<CancelIcon fontSize="small" />}
          renderInput={(params) => (
            <TextField {...params} variant="filled" size="small" placeholder={field.placeholder} />
          )}
          onInputChange={(_event, value, reason) => {
            if (reason === "input") {
              actionHandler({ action: "update", payload: { path, input: "autocomplete", value } });
            }
          }}
          onChange={(_event, value) => {
            actionHandler({
              action: "update",
              payload: { path, input: "autocomplete", value: value ?? undefined },
            });
          }}
          options={field.items}
        />
      );
    case "number":
      return (
        <NumberInput
          size="small"
          variant="filled"
          value={field.value}
          disabled={field.disabled}
          readOnly={field.readonly}
          placeholder={field.placeholder}
          fullWidth
          max={field.max}
          min={field.min}
          precision={field.precision}
          step={field.step}
          onChange={(value) => {
            actionHandler({ action: "update", payload: { path, input: "number", value } });
          }}
        />
      );
    case "toggle":
      return (
        <ToggleButtonGroup
          className={classes.styledToggleButtonGroup}
          fullWidth
          value={field.value ?? UNDEFINED_SENTINEL_VALUE}
          exclusive
          disabled={field.disabled}
          size="small"
          onChange={(_event, value) => {
            if (value != undefined && field.readonly !== true) {
              actionHandler({
                action: "update",
                payload: {
                  path,
                  input: "toggle",
                  value: value === UNDEFINED_SENTINEL_VALUE ? undefined : value,
                },
              });
            }
          }}
        >
          {field.options.map((opt) => (
            <ToggleButton
              key={(typeof opt === "object" ? opt.value : opt) ?? UNDEFINED_SENTINEL_VALUE}
              value={(typeof opt === "object" ? opt.value : opt) ?? UNDEFINED_SENTINEL_VALUE}
            >
              {typeof opt === "object" ? opt.label : opt}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      );
    case "string":
      return (
        <TextField
          variant="filled"
          size="small"
          fullWidth
          disabled={field.disabled}
          value={field.value ?? ""}
          placeholder={field.placeholder}
          InputProps={{
            readOnly: field.readonly,
          }}
          onChange={(event) => {
            actionHandler({
              action: "update",
              payload: { path, input: "string", value: event.target.value },
            });
          }}
        />
      );
    case "boolean":
      return (
        <ToggleButtonGroup
          className={classes.styledToggleButtonGroup}
          fullWidth
          value={field.value ?? false}
          exclusive
          disabled={field.disabled}
          size="small"
          onChange={(_event, value) => {
            if (value != undefined && field.readonly !== true) {
              actionHandler({
                action: "update",
                payload: { path, input: "boolean", value },
              });
            }
          }}
        >
          <ToggleButton value={false}>Off</ToggleButton>
          <ToggleButton value={true}>On</ToggleButton>
        </ToggleButtonGroup>
      );
    case "rgb":
      return (
        <ColorPickerInput
          alphaType="none"
          disabled={field.disabled}
          readOnly={field.readonly}
          placeholder={field.placeholder}
          value={field.value?.toString()}
          onChange={(value) => {
            actionHandler({
              action: "update",
              payload: { path, input: "rgb", value },
            });
          }}
          hideClearButton={field.hideClearButton}
        />
      );
    case "rgba":
      return (
        <ColorPickerInput
          alphaType="alpha"
          disabled={field.disabled}
          readOnly={field.readonly}
          placeholder={field.placeholder}
          value={field.value?.toString()}
          onChange={(value) => {
            actionHandler({
              action: "update",
              payload: { path, input: "rgba", value },
            });
          }}
        />
      );
    case "messagepath":
      return (
        <MessagePathInput
          variant="filled"
          path={field.value ?? ""}
          disabled={field.disabled}
          readOnly={field.readonly}
          supportsMathModifiers={field.supportsMathModifiers}
          onChange={(value) => {
            actionHandler({
              action: "update",
              payload: { path, input: "messagepath", value },
            });
          }}
          validTypes={field.validTypes}
        />
      );
    case "select": {
      const selectedOptionIndex = // use findIndex instead of find to avoid confusing TypeScript with union of arrays
        field.options.findIndex((option) => option.value === field.value);
      const selectedOption = field.options[selectedOptionIndex];

      const isEmpty = field.options.length === 0;
      let selectValue = field.value;
      if (!selectedOption) {
        selectValue = INVALID_SENTINEL_VALUE;
      } else if (selectValue == undefined) {
        // We can't pass value={undefined} or we get a React error "A component is changing an
        // uncontrolled input to be controlled" when changing the value to be non-undefined.
        selectValue = UNDEFINED_SENTINEL_VALUE;
      }

      const hasError = !selectedOption && (!isEmpty || field.value != undefined);
      return (
        <Select
          className={cx({ [classes.error]: hasError })}
          size="small"
          displayEmpty
          fullWidth
          disabled={field.disabled}
          readOnly={field.readonly}
          variant="filled"
          value={selectValue}
          renderValue={(_value) => {
            // Use field.value rather than the passed-in value so we can render the value even when
            // it was not present in the list of options.
            const value = field.value;
            for (const option of field.options) {
              if (option.value === value) {
                return option.label.trim();
              }
            }
            return value;
          }}
          onChange={(event) => {
            actionHandler({
              action: "update",
              payload: {
                path,
                input: "select",
                value:
                  event.target.value === UNDEFINED_SENTINEL_VALUE
                    ? undefined
                    : (event.target.value as undefined | string | string[]),
              },
            });
          }}
          MenuProps={{ MenuListProps: { dense: true } }}
        >
          {field.options.map(({ label, value = UNDEFINED_SENTINEL_VALUE, disabled }) => (
            <MenuItem key={value} value={value} disabled={disabled}>
              {label}
            </MenuItem>
          ))}
          {isEmpty && <MenuItem disabled>No options</MenuItem>}
          {!selectedOption && (
            <MenuItem style={{ display: "none" }} value={INVALID_SENTINEL_VALUE} />
          )}
        </Select>
      );
    }
    case "gradient":
      return (
        <ColorGradientInput
          colors={field.value}
          disabled={field.disabled}
          readOnly={field.readonly}
          onChange={(value) => {
            actionHandler({ action: "update", payload: { path, input: "gradient", value } });
          }}
        />
      );
    case "vec3":
      return (
        <Vec3Input
          step={field.step}
          placeholder={field.placeholder}
          value={field.value}
          precision={field.precision}
          disabled={field.disabled}
          readOnly={field.readonly}
          min={field.min}
          max={field.max}
          onChange={(value) => {
            actionHandler({ action: "update", payload: { path, input: "vec3", value } });
          }}
        />
      );
    case "vec2":
      return (
        <Vec2Input
          step={field.step}
          value={field.value}
          placeholder={field.placeholder}
          precision={field.precision}
          disabled={field.disabled}
          readOnly={field.readonly}
          min={field.min}
          max={field.max}
          onChange={(value) => {
            actionHandler({ action: "update", payload: { path, input: "vec2", value } });
          }}
        />
      );
  }
}

function FieldLabel({ field }: { field: Immutable<SettingsTreeField> }): JSX.Element {
  const { classes } = useStyles();

  if (field.input === "vec2") {
    const labels = field.labels ?? ["X", "Y"];
    return (
      <>
        <div className={classes.multiLabelWrapper}>
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
  } else if (field.input === "vec3") {
    const labels = field.labels ?? ["X", "Y", "Z"];
    return (
      <>
        <div className={classes.multiLabelWrapper}>
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
          className={classes.fieldLabel}
          title={field.help ?? field.label}
          variant="subtitle2"
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
  field: Immutable<SettingsTreeField>;
  path: readonly string[];
}): JSX.Element {
  const indent = Math.min(path.length, 4);
  const paddingLeft = 0.75 + 2 * (indent - 1);
  const { classes, cx } = useStyles();

  const { renderSettingsStatusButton } = useAppContext();

  const statusButton = renderSettingsStatusButton ? renderSettingsStatusButton(field) : undefined;

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        gap={0.5}
        paddingLeft={paddingLeft}
        fullHeight
      >
        {statusButton}
        {field.error && (
          <Tooltip
            arrow
            placement="top"
            title={<Typography variant="subtitle2">{field.error}</Typography>}
          >
            <ErrorIcon color="error" fontSize="small" />
          </Tooltip>
        )}
        <FieldLabel field={field} />
      </Stack>
      <div className={cx(classes.fieldWrapper, { [classes.error]: field.error != undefined })}>
        <FieldInput actionHandler={actionHandler} field={field} path={path} />
      </div>
      <Stack paddingBottom={0.25} style={{ gridColumn: "span 2" }} />
    </>
  );
}

export const FieldEditor = React.memo(FieldEditorComponent);
