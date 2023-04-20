// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import Table from "@foxglove/studio-base/panels/Table";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

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

const fixture: Fixture = {
  datatypes: new Map(
    Object.entries({
      my_arr: {
        definitions: [{ type: "json", name: "array", isConstant: false, isArray: true }],
      },
    }),
  ),
  topics: [{ name: "/my_arr", schemaName: "my_arr" }],
  frame: {
    "/my_arr": [
      {
        topic: "/my_arr",
        receiveTime: { sec: 1, nsec: 0 },
        message: { array: makeArrayData() },
        schemaName: "my_arr",
        sizeInBytes: 0,
      },
    ],
  },
};

export default {
  title: "panels/Table",
};

export const NoTopicPath: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={{ frame: {}, topics: [] }}>
        <Table overrideConfig={{ topicPath: "" }} />
      </PanelSetup>
    );
  },

  name: "no topic path",
};

export const NoData: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={{ frame: {}, topics: [] }}>
        <Table overrideConfig={{ topicPath: "/unknown" }} />
      </PanelSetup>
    );
  },

  name: "no data",
};

export const Arrays: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  },

  name: "arrays",
};

export const ExpandRows: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={fixture}
        onMount={() => {
          setImmediate(() => {
            (
              document.querySelectorAll("[data-testid=expand-row-0]")[0] as HTMLTableCellElement
            ).click();
          });
        }}
      >
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  },

  name: "expand rows",
  parameters: { colorScheme: "dark" },
};

export const ExpandCellsWithNestedObjects: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={fixture}
        onMount={() => {
          setImmediate(() => {
            (
              document.querySelectorAll(
                "[data-testid=expand-cell-obj-0]",
              )[0] as HTMLTableCellElement
            ).click();
          });
        }}
      >
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  },

  name: "expand cells with nested objects",
  parameters: { colorScheme: "dark" },
};

export const ExpandCellsWithNestedArrays: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={fixture}
        onMount={() => {
          setImmediate(() => {
            (
              document.querySelectorAll(
                "[data-testid=expand-cell-arr-0]",
              )[0] as HTMLTableCellElement
            ).click();
          });
        }}
      >
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  },

  name: "expand cells with nested arrays",
  parameters: { colorScheme: "dark" },
};

export const ExpandNestedCells: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={fixture}
        onMount={() => {
          setImmediate(() => {
            (
              document.querySelectorAll("[data-testid=expand-row-0]")[0] as HTMLTableCellElement
            ).click();
            (
              document.querySelectorAll(
                "[data-testid=expand-cell-arr-obj-0]",
              )[0] as HTMLTableCellElement
            ).click();
          });
        }}
      >
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  },

  name: "expand nested cells",
  parameters: { colorScheme: "dark" },
};

export const ExpandMultipleRows: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={fixture}
        onMount={() => {
          setImmediate(() => {
            (
              document.querySelectorAll("[data-testid=expand-row-0]")[0] as HTMLTableCellElement
            ).click();
            (
              document.querySelectorAll("[data-testid=expand-row-1]")[0] as HTMLTableCellElement
            ).click();
          });
        }}
      >
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  },

  name: "expand multiple rows",
  parameters: { colorScheme: "dark" },
};

export const Filtering: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array[:]{val==3}" }} />
      </PanelSetup>
    );
  },

  name: "filtering",
};

export const Sorting: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        fixture={fixture}
        onMount={() => {
          setImmediate(() => {
            (
              document.querySelectorAll(
                "[data-testid=column-header-val]",
              )[0] as HTMLTableCellElement
            ).click();
            (
              document.querySelectorAll(
                "[data-testid=column-header-val]",
              )[0] as HTMLTableCellElement
            ).click();
          });
        }}
      >
        <Table overrideConfig={{ topicPath: "/my_arr.array" }} />
      </PanelSetup>
    );
  },

  name: "sorting",
  parameters: { colorScheme: "dark" },
};

export const HandlesPrimitives: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array[:].val" }} />
      </PanelSetup>
    );
  },

  name: "handles primitives",
};

export const HandlesArraysOfPrimitives: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <Table overrideConfig={{ topicPath: "/my_arr.array[:].primitiveArray" }} />
      </PanelSetup>
    );
  },

  name: "handles arrays of primitives",
};

export const ConstrainedWidth: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={fixture}>
        <div style={{ width: "100px" }}>
          <Table overrideConfig={{ topicPath: "/my_arr.array[:]{val==3}" }} />
        </div>
      </PanelSetup>
    );
  },

  name: "constrained width",
};
