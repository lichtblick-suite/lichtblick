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
import { useRef, useState } from "react";
import ReactInputAutosize from "react-input-autosize";

export function ValidatedResizingInput(props: {
  value: string;
  onChange: (arg0: string) => void;
  invalidInputs: string[];
  dataTest?: string;
}): JSX.Element {
  const [internalValue, setInternalValue] = useState<string>(props.value);
  const lastPropsValue = useRef<string>(props.value);
  if (lastPropsValue.current !== props.value) {
    lastPropsValue.current = props.value;
    setInternalValue(props.value);
  }
  return (
    <ReactInputAutosize
      value={`$${internalValue}`}
      data-test={props.dataTest}
      onChange={(event) => {
        const value = event.target.value.slice(1);
        setInternalValue(value);
        if (!props.invalidInputs.includes(value)) {
          props.onChange(value);
        }
      }}
    />
  );
}
