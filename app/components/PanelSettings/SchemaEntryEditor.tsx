// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Callout,
  ColorPicker,
  DefaultButton,
  DirectionalHint,
  Dropdown,
  IColorPickerStyles,
  Label,
  SpinButton,
  Stack,
  TextField,
  Toggle,
} from "@fluentui/react";
// We need lodash.get for dynamic key path support
// eslint-disable-next-line no-restricted-imports
import { get, set, cloneDeep } from "lodash";
import { useCallback, useRef, useState } from "react";

import { PanelConfigSchemaEntry, SaveConfig } from "@foxglove-studio/app/types/panels";
import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

const COLOR_PICKER_STYLES: IColorPickerStyles = {
  root: { maxWidth: 250 },
  colorRectangle: { minWidth: 100, minHeight: 100 },
  table: {
    // We need to remove table styles from global.scss, but for now, changing them
    // to e.g. "#root td" messes with the styling in various places because the
    // selector becomes more specific. So for now, just disable them directly here.
    "tr, th, td, tr:hover th, tr:hover td": {
      border: "none",
      background: "none",
      cursor: "unset",
    },
  },
};

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
  const [colorPickerShown, setColorPickerShown] = useState(false);
  const colorButtonRef = useRef<HTMLElement>(ReactNull);

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
      let value;
      if (typeof currentValue === "number") {
        value = currentValue;
      } else {
        value = 0;
        log.warn(`Unexpected type for ${key}:`, currentValue);
      }
      const validate = entry.validate;
      return (
        <SpinButton
          label={title}
          value={value.toString()}
          onValidate={
            validate != undefined
              ? (newValue) => validate(parseFloat(newValue)).toString()
              : undefined
          }
          onChange={(_event, newValue) =>
            newValue != undefined &&
            setValue(validate != undefined ? validate(parseFloat(newValue)) : parseFloat(newValue))
          }
        />
      );
    }

    case "toggle": {
      if (currentValue != undefined && typeof currentValue !== "boolean") {
        log.warn(`Unexpected type for ${key}:`, currentValue);
      }
      return (
        <Toggle
          label={title}
          checked={!!currentValue}
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
          <DefaultButton
            elementRef={colorButtonRef}
            styles={{
              root: { backgroundColor: value },
              rootHovered: { backgroundColor: value, opacity: 0.8 },
              rootPressed: { backgroundColor: value, opacity: 0.6 },
            }}
            onClick={() => setColorPickerShown(!colorPickerShown)}
          />
          {colorPickerShown && (
            <Callout
              directionalHint={DirectionalHint.rightCenter}
              target={colorButtonRef.current}
              onDismiss={() => setColorPickerShown(false)}
            >
              <ColorPicker
                color={value}
                alphaType="none"
                onChange={(_event, newValue) => setValue(`#${newValue.hex}`)}
                styles={COLOR_PICKER_STYLES}
              />
            </Callout>
          )}
        </Stack.Item>
      );
    }
  }
  throw new Error(
    `Unsupported type ${(entry as PanelConfigSchemaEntry<unknown>).type} in panel config schema`,
  );
}
