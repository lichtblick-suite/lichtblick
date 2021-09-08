// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dropdown, Label, SpinButton, Stack, TextField, Toggle } from "@fluentui/react";
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
        <TextField
          label={title}
          placeholder={entry.placeholder}
          value={value}
          onChange={(_event, newValue) => setValue(newValue)}
        />
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
        <Stack horizontal wrap tokens={(_props, theme) => ({ childrenGap: theme.spacing.s1 })}>
          <Stack.Item align="center">
            <Label>{title}</Label>
          </Stack.Item>
          <Stack.Item grow style={{ flexBasis: 0, minWidth: 86 }}>
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
          </Stack.Item>
        </Stack>
      );
    }

    case "toggle": {
      if (currentValue != undefined && typeof currentValue !== "boolean") {
        log.warn(`Unexpected type for ${key}:`, currentValue);
      }
      return (
        <Toggle
          label={title}
          checked={Boolean(currentValue)}
          onChange={(_event, checked) => setValue(checked)}
        />
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
        <Stack.Item>
          <Label>{title}</Label>
          <ColorPicker
            color={hexToColorObj(value)}
            onChange={(newColor) => setValue(`#${colorObjToIColor(newColor).hex}`)}
          />
        </Stack.Item>
      );
    }
  }
  throw new Error(
    `Unsupported type ${(entry as PanelConfigSchemaEntry<unknown>).type} in panel config schema`,
  );
}
