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
import { useTheme } from "@fluentui/react";
import { useRef, useState } from "react";

import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";

const keyValMap: Record<string, number> = { ArrowDown: -1, ArrowUp: 1 };

export function JSONInput(props: {
  value: string;
  dataTest?: string;
  onChange: (arg0: unknown) => void;
}): React.ReactElement {
  const theme = useTheme();
  const [internalValue, setInternalValue] = useState<string>(props.value);
  const lastPropsValue = useRef<string>(props.value);
  if (lastPropsValue.current !== props.value) {
    lastPropsValue.current = props.value;
    setInternalValue(props.value);
  }
  const parsedValue = parseJson(internalValue);
  const isValid = parsedValue != undefined;
  return (
    <LegacyInput
      style={{ color: isValid ? theme.semanticColors.inputText : theme.palette.red }}
      data-test={props.dataTest ?? "json-input"}
      type="text"
      value={internalValue}
      onChange={(e) => {
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
