// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TextField } from "@fluentui/react";
import { useState } from "react";

import { Field } from "@foxglove/studio-base/context/PlayerSelectionContext";

type Props = {
  disabled: boolean;
  field: Field;
  onChange: (newValue: string | undefined) => void;
  onError: (message: string) => void;
};

export function FormField(props: Props): JSX.Element {
  const [error, setError] = useState<string | undefined>();
  const field = props.field;

  const onChange = (_: unknown, newValue: string | undefined) => {
    setError(undefined);

    if (newValue != undefined) {
      const maybeError = field.validate?.(newValue);
      if (maybeError instanceof Error) {
        setError(maybeError.message);
        props.onError(maybeError.message);
        return;
      }
    }

    props.onChange(newValue ?? field.defaultValue);
  };

  return (
    <TextField
      disabled={props.disabled}
      key={field.label}
      label={field.label}
      errorMessage={error}
      description={field.description}
      placeholder={field.placeholder}
      defaultValue={field.defaultValue}
      onChange={onChange}
    />
  );
}
