// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { isEqual } from "lodash";
import styled from "styled-components";

import Flex from "@foxglove/studio-base/components/Flex";
import { LegacyTextarea } from "@foxglove/studio-base/components/LegacyStyledComponents";
import { validationErrorToString, ValidationResult } from "@foxglove/studio-base/util/validators";

const { useState, useCallback, useRef, useLayoutEffect, useEffect } = React;

const SEditBox = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 200px;
  max-height: 800px;
`;
const StyledTextarea = styled(LegacyTextarea)`
  flex: 1 1 auto;
  resize: none;
`;
const SError = styled.div`
  color: ${({ theme }) => theme.semanticColors.errorText};
  padding: 8px 4px;
`;

type Value = unknown;
type OnChange = (obj: unknown) => void;
type ParseAndStringifyFn = {
  stringify: (obj: unknown) => string;
  parse: (val: string) => unknown;
};
export type BaseProps = {
  dataValidator?: (data: unknown) => ValidationResult | undefined;
  inputStyle?: {
    [attr: string]: string | number;
  };
  onChange?: OnChange;
  onError?: (err: string) => void;
  value: Value;
};
type Props = BaseProps & {
  children?: React.ReactNode;
};

/**
 * The base component for ValidatedInput which handles the value change, data validation
 * and data stringifying/parsing. Any external value change will cause the input string to change
 * and trigger new validations. Only valid internal value change will call onChange. Any data processing
 * and validation error will trigger onError.
 */
export function ValidatedInputBase({
  dataValidator = () => undefined,
  inputStyle = {},
  onChange,
  onError,
  parse,
  stringify,
  value,
}: BaseProps & ParseAndStringifyFn): JSX.Element {
  const [error, setError] = useState<string>("");
  const [inputStr, setInputStr] = useState<string>("");
  const prevIncomingVal = useRef<unknown>("");
  const inputRef = useRef<HTMLTextAreaElement>(ReactNull);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // validate the input string, and setError or call onChange if needed
  const memorizedInputValidation = useCallback(
    (newInputVal: string, onChangeFcn?: OnChange) => {
      let newVal;
      let newError;
      // parse the empty string directly as empty array or object for validation and onChange callback
      if (newInputVal.trim() === "") {
        newVal = Array.isArray(value) ? [] : {};
      } else {
        try {
          newVal = parse(newInputVal);
        } catch (e) {
          newError = e.message;
        }
      }

      if (newError != undefined) {
        setError(newError);
        return;
      }
      setError(""); // clear the previous error
      const validationResult = dataValidator(newVal);
      if (validationResult != undefined) {
        setError(validationErrorToString(validationResult));
        return;
      }
      if (onChangeFcn) {
        onChangeFcn(newVal);
      }
    },
    [dataValidator, parse, value],
  );

  // when not in editing mode, whenever the incoming value changes, we'll compare the new value with prevIncomingVal, and reset local state values if they are different
  useLayoutEffect(() => {
    if (!isEditing && value !== prevIncomingVal.current) {
      if (isEqual(value, prevIncomingVal.current)) {
        return;
      }
      let newVal = "";
      let newError: string | undefined;
      try {
        newVal = stringify(value);
      } catch (e) {
        newError = `Error stringifying the new value, using "" as default. ${e.message}`;
      }
      setInputStr(newVal);
      prevIncomingVal.current = value;
      if (newError != undefined) {
        setError(newError);
        return;
      }
      // try to validate if successfully stringified the new value
      memorizedInputValidation(newVal);
    }
  }, [value, stringify, memorizedInputValidation, isEditing]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.currentTarget?.value;
      if (!isEditing) {
        setIsEditing(true);
      }
      setInputStr(val);
      memorizedInputValidation(val, onChange);
    },
    [isEditing, memorizedInputValidation, onChange],
  );

  useEffect(() => {
    if (onError && error.length > 0) {
      onError(error);
    }
  }, [error, onError]);

  // scroll to the bottom when the text gets too long
  useLayoutEffect(
    () => {
      if (!isEditing) {
        const inputElem = inputRef.current;
        if (inputElem) {
          inputElem.scrollTop = inputElem.scrollHeight;
        }
      }
    },
    [isEditing, inputStr], // update whenever inputStr changes
  );

  return (
    <>
      <StyledTextarea
        data-test="validated-input"
        style={inputStyle}
        ref={inputRef}
        value={inputStr}
        onChange={handleChange}
      />
      {error.length > 0 && <SError>{error}</SError>}
    </>
  );
}

export function JsonInput(props: BaseProps): JSX.Element {
  function stringify(val: unknown) {
    return JSON.stringify(val, undefined, 2);
  }
  return (
    <SEditBox>
      <ValidatedInputBase parse={JSON.parse} stringify={stringify} {...props} />
    </SEditBox>
  );
}

// An enhanced input component that allows editing values in json format with custom validations
export default function ValidatedInput({ children, ...rest }: Props): JSX.Element {
  const InputComponent = JsonInput;
  return (
    <Flex col>
      <Flex row reverse>
        {children}
      </Flex>
      <SEditBox>
        <InputComponent {...rest} />
      </SEditBox>
    </Flex>
  );
}
