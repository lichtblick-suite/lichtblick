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

import { DEFAULT_CAMERA_STATE } from "@foxglove/regl-worldview";
import Flex from "@foxglove/studio-base/components/Flex";
import { triggerInputChange, triggerInputBlur } from "@foxglove/studio-base/stories/PanelSetup";
import { createValidator, isNumber, ValidationResult } from "@foxglove/studio-base/util/validators";

import ValidatedInput from "./ValidatedInput";

const INPUT_OBJ = { id: 1, name: "foo" };
const INPUT_OBJ1 = { id: 2, name: "bar" };

function myValidator(data: any = {}): ValidationResult | undefined {
  const rules = { id: [isNumber] };
  const validator = createValidator(rules);
  const result = validator(data);
  return Object.keys(result).length === 0 ? undefined : result;
}

function Box({ children }: any) {
  return <div style={{ width: 200, height: 100 }}>{children}</div>;
}

function Example({
  obj = INPUT_OBJ,
  changedObj = INPUT_OBJ1,
  onMount,
}: {
  obj?: any;
  changedObj?: any;
  onMount?: (arg0: HTMLTextAreaElement) => void;
}) {
  const [value, setValue] = React.useState(obj);

  React.useEffect(() => {
    setTimeout(() => {
      setValue(changedObj);
    }, 10);
  }, [changedObj]);

  return (
    <Box>
      <div
        ref={(el) => {
          if (el && onMount) {
            const input = document.querySelector<HTMLTextAreaElement>(
              "textarea[data-test='validated-input']",
            );
            if (input) {
              onMount(input);
            }
          }
        }}
      >
        <ValidatedInput value={value} />
      </div>
    </Box>
  );
}

storiesOf("components/ValidatedInput", module)
  .add("default", () => {
    return (
      <Flex>
        <Box>
          <ValidatedInput value={INPUT_OBJ} />
        </Box>
      </Flex>
    );
  })
  .add("with dataValidator (show validation error after mount)", () => {
    const invalidValue = { id: "not number", name: "foo" };
    return (
      <Flex>
        <Box>
          <ValidatedInput value={invalidValue} dataValidator={myValidator} />
        </Box>
      </Flex>
    );
  })
  .add("value change affects the input value", () => {
    return (
      <Flex>
        <Example />
      </Flex>
    );
  })
  .add("prop change does not override the input string if object values are deeply equal ", () => {
    // the input string does not change as `obj` and `changedObj` are deeply equal
    return (
      <Flex>
        <Example obj={INPUT_OBJ} changedObj={{ name: "foo", id: 1 }} />
      </Flex>
    );
  })
  .add("scroll to bottom when input size grows", () => {
    return (
      <Flex>
        <Example obj={INPUT_OBJ} changedObj={{ ...DEFAULT_CAMERA_STATE, distance: 100000000 }} />
      </Flex>
    );
  })
  .add(
    "in editing mode, prop value change does not affect the input string",
    () => {
      return (
        <Flex>
          <Example
            onMount={(input) => {
              // even though the prop object has changed, the input value is in sync with current editing value
              triggerInputChange(input, "invalid_val");
              setTimeout(() => {
                triggerInputChange(input, "another_invalid_val");
              }, 50);
            }}
          />
        </Flex>
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "in editing mode, prop change does not cause the textarea to scroll to bottom",
    () => {
      const changedObj = { ...DEFAULT_CAMERA_STATE, distance: 100000000 };
      return (
        <Flex>
          <Example
            obj={DEFAULT_CAMERA_STATE}
            onMount={(input) => {
              setImmediate(() => {
                // scroll to the top and start editing
                input.scrollTop = 0;
                triggerInputChange(input, JSON.stringify(changedObj, undefined, 2));
              });
            }}
          />
        </Flex>
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "upon blur, the validation error stays",
    () => {
      return (
        <Flex>
          <Example
            obj={DEFAULT_CAMERA_STATE}
            onMount={(input) => {
              setImmediate(() => {
                triggerInputChange(input, "invalid_val");
                setImmediate(() => {
                  triggerInputBlur(input);
                });
              });
            }}
          />
        </Flex>
      );
    },
    { colorScheme: "dark" },
  );
