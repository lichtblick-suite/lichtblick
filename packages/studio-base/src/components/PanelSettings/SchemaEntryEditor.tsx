// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dropdown, Label, SpinButton, TextField, Toggle } from "@fluentui/react";
import { Box, Stack } from "@mui/material";
// We need lodash.get for dynamic key path support
// eslint-disable-next-line no-restricted-imports
import { get, set, cloneDeep } from "lodash";
import { useCallback } from "react";

import Logger from "@foxglove/log";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import { PanelConfigSchemaEntry, SaveConfig } from "@foxglove/studio-base/types/panels";
import { hexToColorObj, colorObjToIColor } from "@foxglove/studio-base/util/colorUtils";

const log = Logger.getLogger(__filename);

export default function SchemaEntryEditor({
  entry,
  config,
  saveConfig,
}: {
  entry: PanelConfigSchemaEntry<string>;
  config: Record<string, unknown>;
  saveConfig: SaveConfig<Record<string, unknown>>;
}): JSX.Element {
  const { key, title } = entry;
  const setValue = useCallback(
    (value: unknown) => {
      saveConfig(set(cloneDeep(config), key, value));
    },
    [config, key, saveConfig],
  );
  const currentValue = get(config, key);

  switch (entry.type) {
    case "text": {
      let value;
      if (typeof currentValue === "string") {
        value = currentValue;
      } else {
        value = "";
        log.warn(`Unexpected type for ${key}:`, currentValue);
      }
      return (
        <div>
          <TextField
            label={title}
            placeholder={entry.placeholder}
            value={value}
            onChange={(_event, newValue) => setValue(newValue)}
          />
        </div>
      );
    }
    case "number": {
      const { allowEmpty = false, placeholder, validate } = entry;
      let value;
      if ((typeof currentValue === "undefined" || currentValue === "") && allowEmpty) {
        value = "";
      } else if (typeof currentValue === "number") {
        value = currentValue.toString();
      } else if (typeof currentValue === "string" && !isNaN(+currentValue)) {
        value = currentValue;
      } else {
        value = "0";
        log.warn(`Unexpected type for ${key}:`, currentValue);
      }
      return (
        <Stack direction="row" flexWrap="wrap" alignItems="center" spacing={1}>
          <Box textAlign="center">
            <Label>{title}</Label>
          </Box>
          <Box flexGrow={1} flexBasis={0} minWidth={86}>
            <SpinButton
              inputProps={{ placeholder }}
              value={value}
              styles={{ root: { rowGap: "10px" } }}
              onValidate={(inputValue) => {
                if (inputValue.trim().length > 0) {
                  if (!isNaN(+inputValue)) {
                    if (validate != undefined) {
                      return validate(+inputValue)?.toString();
                    }
                    return inputValue;
                  }
                } else if (allowEmpty) {
                  return "";
                }
                return undefined; // onChange will not be called
              }}
              onChange={(_event, inputValue) => {
                const sanitizedInput = inputValue?.trim();
                if ((sanitizedInput && !isNaN(+sanitizedInput)) || allowEmpty) {
                  setValue(sanitizedInput ? +sanitizedInput : undefined);
                }
              }}
            />
          </Box>
        </Stack>
      );
    }

    case "toggle": {
      if (currentValue != undefined && typeof currentValue !== "boolean") {
        log.warn(`Unexpected type for ${key}:`, currentValue);
      }
      return (
        <div>
          <Toggle
            label={title}
            checked={Boolean(currentValue)}
            onChange={(_event, checked) => setValue(checked)}
          />
        </div>
      );
    }

    case "dropdown": {
      let selectedKey;
      if (typeof currentValue === "string" || typeof currentValue === "number") {
        selectedKey = currentValue;
      } else {
        log.warn(`Unexpected type for ${key}:`, currentValue);
        selectedKey = undefined;
      }
      return (
        <div>
          <Dropdown
            label={title}
            selectedKey={selectedKey}
            onChange={(_event, _value, index) => {
              if (index != undefined) {
                setValue(entry.options[index]?.value);
              }
            }}
            options={entry.options.map(({ value, text }) => ({ key: value, text }))}
          />
        </div>
      );
    }

    case "color": {
      let value: string;
      if (typeof currentValue === "string") {
        value = currentValue;
      } else {
        log.warn(`Unexpected type for ${key}:`, currentValue);
        value = "";
      }
      return (
        <div>
          <Label>{title}</Label>
          <ColorPicker
            color={hexToColorObj(value)}
            onChange={(newColor) => setValue(`#${colorObjToIColor(newColor).hex}`)}
          />
        </div>
      );
    }
  }
  throw new Error(
    `Unsupported type ${(entry as PanelConfigSchemaEntry<unknown>).type} in panel config schema`,
  );
}
