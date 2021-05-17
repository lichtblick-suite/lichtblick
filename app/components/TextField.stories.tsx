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

import { storiesOf } from "@storybook/react";

import Flex from "@foxglove/studio-base/components/Flex";
import { triggerInputChange, triggerInputBlur } from "@foxglove/studio-base/stories/PanelSetup";
import { createPrimitiveValidator, hasLen } from "@foxglove/studio-base/util/validators";

import TextField from "./TextField";

const validator = createPrimitiveValidator([hasLen(4)]);

function Box({ children, title }: any) {
  return (
    <div style={{ width: 240, height: 100, margin: 8 }}>
      <p>{title}</p>
      {children}
    </div>
  );
}

function ErrorExample() {
  const [error, setError] = React.useState<string | undefined>();
  return (
    <>
      <TextField value="foo" validator={validator} onError={setError} hideInlineError />
      <strong>This is a custom error UI: {error}</strong>
    </>
  );
}

function ControlledExample() {
  const [value, setValue] = React.useState<string>("");
  return (
    <div
      ref={(el) => {
        if (el) {
          const input = el.querySelector("input") as any as HTMLInputElement;
          triggerInputChange(input, "another value");
        }
      }}
    >
      <TextField value={value} onChange={setValue} />
    </div>
  );
}

function UncontrolledExample() {
  const [value, setValue] = React.useState<string>("");
  React.useEffect(() => {
    setValue("another value but not set in TextField");
  }, []);

  return (
    <div>
      <TextField defaultValue={value} onChange={setValue} />
      {value}
    </div>
  );
}

function ValidateOnBlurExample() {
  return (
    <div
      ref={(el) => {
        if (el) {
          const input = el.querySelector("input") as any as HTMLInputElement;
          // only see the validation error after input blur
          triggerInputChange(input, "invalid_val");
          setTimeout(() => {
            triggerInputBlur(input);
          }, 500);
        }
      }}
    >
      <TextField value="foo" validator={validator} validateOnBlur />
    </div>
  );
}

storiesOf("components/TextField", module).add("default", () => {
  return (
    <Flex wrap>
      <Box title="default">
        <TextField />
      </Box>
      <Box title="placeholder, label and custom styles">
        <TextField
          label="Name"
          placeholder="type something..."
          style={{ border: "1px solid green", padding: 4 }}
          inputStyle={{ border: "2px solid blue" }}
        />
      </Box>
      <Box title="controlled">
        <ControlledExample />
      </Box>
      <Box title="uncontrolled">
        <UncontrolledExample />
      </Box>
      <Box title="selectOnMount">
        <TextField defaultValue="foo" selectOnMount />
      </Box>
      <Box title="use hideInlineError to show custom error UI">
        <ErrorExample />
      </Box>
      <Box title="by default, validate on mount">
        <TextField value="foo" validator={validator} />
      </Box>
      <Box title="use validateOnBlur to reduce updates">
        <ValidateOnBlurExample />
      </Box>
    </Flex>
  );
});
