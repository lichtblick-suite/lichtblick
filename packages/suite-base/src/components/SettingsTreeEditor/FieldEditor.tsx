// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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
  Slider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback } from "react";
import { v4 as uuid } from "uuid";

import { Immutable, SettingsTreeAction, SettingsTreeField } from "@lichtblick/suite";
import MessagePathInput from "@lichtblick/suite-base/components/MessagePathSyntax/MessagePathInput";
import { useStyles } from "@lichtblick/suite-base/components/SettingsTreeEditor/FieldEditor.style";
import { LegendControls } from "@lichtblick/suite-base/components/SettingsTreeEditor/inputs/LegendControls";
import { FieldEditorProps } from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAppContext } from "@lichtblick/suite-base/context/AppContext";

import { ColorGradientInput, ColorPickerInput, NumberInput, Vec2Input, Vec3Input } from "./inputs";

/** Used to allow both undefined and empty string in select inputs. */
const UNDEFINED_SENTINEL_VALUE = uuid();
/** Used to avoid MUI errors when an invalid option is selected */
const INVALID_SENTINEL_VALUE = uuid();

function FieldInput({
  actionHandler,
  field,
  path,
}: {
  actionHandler: (action: SettingsTreeAction) => void;
  field: Immutable<SettingsTreeField>;
  path: readonly string[];
}): React.JSX.Element {
  const { classes, cx } = useStyles();

  const handleMessagePathChange = useCallback(
    (value: string) => {
      actionHandler({
        action: "update",
        payload: { path, input: "messagepath", value },
      });
    },
    [actionHandler, path],
  );

  switch (field.input) {
    case "autocomplete":
      return (
        <Autocomplete
          data-testid="FieldEditor-Autocomplete"
          className={classes.autocomplete}
          size="small"
          freeSolo={true}
          value={field.value}
          disabled={field.disabled}
          readOnly={field.readonly}
          renderOption={(props, option, { selected }) => (
            <MenuItem selected={selected} {...props}>
              {option}
            </MenuItem>
          )}
          slotProps={{
            clearIndicator: {
              size: "small",
              className: classes.clearIndicator,
            },
            listbox: { dense: true, component: MenuList } as Partial<MenuListProps>,
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
          data-testid="FieldEditor-NumberInput"
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
          data-testid="FieldEditor-ToggleButtonGroup-toggle"
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
          data-testid="FieldEditor-TextField"
          variant="filled"
          size="small"
          fullWidth
          disabled={field.disabled}
          value={field.value ?? ""}
          placeholder={field.placeholder}
          slotProps={{
            input: {
              readOnly: field.readonly,
            },
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
          data-testid="FieldEditor-ToggleButtonGroup-boolean"
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
          onChange={handleMessagePathChange}
          validTypes={field.validTypes}
        />
      );
    case "select": {
      const selectedOptionIndex = // use findIndex instead of find to avoid confusing TypeScript with union of arrays
        field.options.findIndex((option) => option.value === field.value);
      const selectedOption = field.options[selectedOptionIndex];

      const isEmpty = field.options.length === 0;
      let selectValue = field.value;
      if (selectedOption) {
        // We can't pass value={undefined} or we get a React error "A component is changing an
        // uncontrolled input to be controlled" when changing the value to be non-undefined.
        selectValue ??= UNDEFINED_SENTINEL_VALUE;
      } else {
        selectValue = INVALID_SENTINEL_VALUE;
      }

      const hasError = !selectedOption && (!isEmpty || field.value != undefined);
      return (
        <Select
          className={cx({ [classes.error]: hasError })}
          size="small"
          displayEmpty
          fullWidth
          disabled={field.disabled}
          data-testid="FieldEditor-Select"
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
    case "legendcontrols":
      return <LegendControls />;
    case "slider":
      return (
        <Slider
          className={classes.slider}
          value={field.value}
          min={field.min}
          max={field.max}
          step={field.step}
          size="small"
          valueLabelDisplay="auto"
          onChange={(_, value) => {
            actionHandler({
              action: "update",
              payload: { path, input: "slider", value },
            });
          }}
        />
      );
  }
}

function FieldLabel({
  field,
}: Readonly<{ field: Immutable<SettingsTreeField> }>): React.JSX.Element {
  const { classes } = useStyles();

  if (field.input === "vec2") {
    const labels = field.labels ?? ["X", "Y"];
    return (
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
    );
  } else if (field.input === "vec3") {
    const labels = field.labels ?? ["X", "Y", "Z"];
    return (
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
    );
  } else {
    return (
      <Typography
        className={classes.fieldLabel}
        title={field.help ?? field.label}
        variant="subtitle2"
      >
        {field.label}
      </Typography>
    );
  }
}

function FieldEditorComponent(props: Readonly<FieldEditorProps>): React.JSX.Element {
  const indent = Math.min(props.path.length, 4);
  const paddingLeft = 0.75 + 2 * (indent - 1);
  const { classes, cx } = useStyles();

  const { renderSettingsStatusButton } = useAppContext();

  const statusButton = renderSettingsStatusButton
    ? renderSettingsStatusButton(props.field)
    : undefined;

  return (
    <>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="flex-end"
        gap={0.5}
        paddingLeft={paddingLeft}
        fullHeight
        data-testid="FieldEditor"
      >
        {statusButton}
        {props.field.error && (
          <Tooltip
            arrow
            placement="top"
            title={<Typography variant="subtitle2">{props.field.error}</Typography>}
          >
            <ErrorIcon color="error" fontSize="small" />
          </Tooltip>
        )}
        <FieldLabel field={props.field} />
      </Stack>
      <Tooltip
        arrow
        placement="right"
        title={
          props.field.tooltip ? (
            <Typography variant="subtitle2">{props.field.tooltip}</Typography>
          ) : undefined
        }
      >
        <div
          className={cx(classes.fieldWrapper, { [classes.error]: props.field.error != undefined })}
        >
          <FieldInput actionHandler={props.actionHandler} field={props.field} path={props.path} />
        </div>
      </Tooltip>
      <Stack paddingBottom={0.25} style={{ gridColumn: "span 2" }} />
    </>
  );
}

export const FieldEditor = React.memo(FieldEditorComponent);
