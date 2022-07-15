// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { FormHelperText, TextField } from "@mui/material";
import { ChangeEvent, useState } from "react";

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

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(undefined);

    const maybeError = field.validate?.(event.target.value);

    if (maybeError instanceof Error) {
      setError(maybeError.message);
      props.onError(maybeError.message);
      return;
    }

    props.onChange(event.target.value);
  };

  return (
    <div>
      <TextField
        fullWidth
        disabled={props.disabled}
        key={field.label}
        label={field.label}
        error={error != undefined}
        helperText={error}
        FormHelperTextProps={{
          variant: "standard",
        }}
        placeholder={field.placeholder}
        defaultValue={field.defaultValue}
        onChange={onChange}
      />
      <FormHelperText>{field.description}</FormHelperText>
    </div>
  );
}
