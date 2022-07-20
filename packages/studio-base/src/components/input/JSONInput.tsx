// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { InputBase } from "@mui/material";
import { useEffect, useRef, useState } from "react";

const keyValMap: Record<string, number> = { ArrowDown: -1, ArrowUp: 1 };

/**
 * JSONInput displays a json value and allows the user to edit the value.
 */
export function JSONInput(props: {
  value: string;
  dataTest?: string;
  onChange: (newValue: unknown) => void;
}): React.ReactElement {
  // The JSONInput is semi-controlled.
  // We need to avoid updating the input text when the user is actively editing the input.
  // The _internalValue_ is the latest value to display. When editing, the editingRef prevents
  // updates to the internal value from new props. When not editing, new props can update the value.
  const [internalValue, setInternalValue] = useState<string>(props.value);
  const editingRef = useRef(false);

  // keep track of the last prop value we've seen so if we leave edit mode with no changes
  // we can update the input field to the value
  const lastPropValueRef = useRef<string | undefined>(props.value);
  lastPropValueRef.current = props.value;

  useEffect(() => {
    if (editingRef.current) {
      return;
    }

    setInternalValue(props.value);
  }, [props.value]);

  const parsedValue = parseJson(internalValue);
  const isValid = parsedValue != undefined;
  return (
    <InputBase
      data-test={props.dataTest ?? "json-input"}
      type="text"
      value={internalValue}
      error={!isValid}
      onFocus={() => {
        editingRef.current = true;
      }}
      onBlur={() => {
        editingRef.current = false;
        // when we are done editing we might have an updated value to set
        if (lastPropValueRef.current != undefined) {
          setInternalValue(lastPropValueRef.current);
        }
      }}
      onChange={(e) => {
        // we've updated our own value and don't want to use any intermediate value
        lastPropValueRef.current = undefined;
        setInternalValue(e.target.value);
        const newParsedValue = parseJson(e.target.value);
        if (newParsedValue != undefined) {
          props.onChange(newParsedValue);
        }
      }}
      onKeyDown={(e) => {
        const val = keyValMap[e.key];
        if (typeof parsedValue === "number" && val != undefined) {
          const newParsedValue = parsedValue + val;

          lastPropValueRef.current = undefined;
          setInternalValue(`${newParsedValue}`);
          props.onChange(newParsedValue);
        }
      }}
    />
  );
}

function parseJson(val: string): unknown | undefined {
  try {
    return JSON.parse(val);
  } catch (e) {
    return undefined;
  }
}
