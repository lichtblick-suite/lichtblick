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

import { storiesOf } from "@storybook/react";

import Table from "@foxglove/studio-base/panels/Table";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

const makeArrayData = ({
  length = 50,
  nestArray = true,
}: { length?: number; nestArray?: boolean } = {}): unknown => {
  return new Array(length).fill(0).map((_, i) => {
    return {
      val: i,
      bool: true,
      str: `${i}-abcd-edfg`,
      n: null, // eslint-disable-line no-restricted-syntax
      u: undefined,
      obj: {
        date: new Date(`2020-01-${i}`),
      },
      arr: nestArray ? makeArrayData({ length: 5, nestArray: false }) : [],
      primitiveArray: [1, 2, 3, 4, 5],
    };
  });
};

const fixture = {
  datatypes: new Map(
    Object.entries({
      my_arr: {
        definitions: [{ type: "json", name: "array", isConstant: false, isArray: true }],
      },
    }),
  ),
  topics: [{ name: "/my_arr", datatype: "my_arr" }],
  frame: {
    "/my_arr": [
      {
        topic: "/my_arr",
        receiveTime: { sec: 1, nsec: 0 },
        message: { array: makeArrayData() },
      },
    ],
  },
};

storiesOf("panels/Table", module)
  .add("no topic path", () => {
    return (
      <PanelSetup fixture={{ frame: {}, topics: [] }}>
        <Table overrideConfig={{ topicPath: "" }} />
      </PanelSetup>
    );
  })
  .add("no data", () => {
    return (
      <PanelSetup fixture={{ frame: {}, topics: [] }}>
        <Table overrideConfig={{ topicPath: "/unknown" }} />
      </PanelSetup>
    );
  })
  .add("arrays", () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  })
  .add(
    "expand rows",
    () => {
      return (
        <PanelSetup
          fixture={fixture}
          onMount={() => {
            setImmediate(() => {
              (
                document.querySelectorAll("[data-test=expand-row-0]")[0] as HTMLTableCellElement
              ).click();
            });
          }}
        >
          <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
        </PanelSetup>
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "expand cells with nested objects",
    () => {
      return (
        <PanelSetup
          fixture={fixture}
          onMount={() => {
            setImmediate(() => {
              (
                document.querySelectorAll(
                  "[data-test=expand-cell-obj-0]",
                )[0] as HTMLTableCellElement
              ).click();
            });
          }}
        >
          <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
        </PanelSetup>
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "expand cells with nested arrays",
    () => {
      return (
        <PanelSetup
          fixture={fixture}
          onMount={() => {
            setImmediate(() => {
              (
                document.querySelectorAll(
                  "[data-test=expand-cell-arr-0]",
                )[0] as HTMLTableCellElement
              ).click();
            });
          }}
        >
          <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
        </PanelSetup>
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "expand nested cells",
    () => {
      return (
        <PanelSetup
          fixture={fixture}
          onMount={() => {
            setImmediate(() => {
              (
                document.querySelectorAll("[data-test=expand-row-0]")[0] as HTMLTableCellElement
              ).click();
              (
                document.querySelectorAll(
                  "[data-test=expand-cell-arr-obj-0]",
                )[0] as HTMLTableCellElement
              ).click();
            });
          }}
        >
          <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
        </PanelSetup>
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "expand multiple rows",
    () => {
      return (
        <PanelSetup
          fixture={fixture}
          onMount={() => {
            setImmediate(() => {
              (
                document.querySelectorAll("[data-test=expand-row-0]")[0] as HTMLTableCellElement
              ).click();
              (
                document.querySelectorAll("[data-test=expand-row-1]")[0] as HTMLTableCellElement
              ).click();
            });
          }}
        >
          <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
        </PanelSetup>
      );
    },
    { colorScheme: "dark" },
  )
  .add("filtering", () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array[:]{val==3}" }} />
      </PanelSetup>
    );
  })
  .add(
    "sorting",
    () => {
      return (
        <PanelSetup
          fixture={fixture}
          onMount={() => {
            setImmediate(() => {
              (
                document.querySelectorAll(
                  "[data-test=column-header-val]",
                )[0] as HTMLTableCellElement
              ).click();
              (
                document.querySelectorAll(
                  "[data-test=column-header-val]",
                )[0] as HTMLTableCellElement
              ).click();
            });
          }}
        >
          <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
        </PanelSetup>
      );
    },
    { colorScheme: "dark" },
  )
  .add("handles primitives", () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array[:].val" }} />
      </PanelSetup>
    );
  })
  .add("handles arrays of primitives", () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array[:].primitiveArray" }} />
      </PanelSetup>
    );
  })
  .add("constrained width", () => {
    return (
      <PanelSetup fixture={fixture}>
        <div style={{ width: "100px" }}>
          <Table overrideConfig={{ topicPath: "/my_arr.array[:]{val==3}" }} />
        </div>
      </PanelSetup>
    );
  });
