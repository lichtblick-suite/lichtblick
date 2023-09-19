/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { renderHook } from "@testing-library/react";
import * as _ from "lodash-es";

import { messagePathStructures } from "@foxglove/studio-base/components/MessagePathSyntax/messagePathsForDatatype";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { enumValuesByDatatypeAndField } from "@foxglove/studio-base/util/enums";

import {
  fillInGlobalVariablesInPath,
  getMessagePathDataItems,
  useCachedGetMessagePathDataItems,
  useDecodeMessagePathsForMessagesByTopic,
} from "./useCachedGetMessagePathDataItems";

function addValuesWithPathsToItems(
  messages: MessageEvent[],
  messagePath: string,
  providerTopics: Topic[],
  datatypes: RosDatatypes,
) {
  return messages.map((message) => {
    const rosPath = parseRosPath(messagePath);
    if (!rosPath) {
      return undefined;
    }
    const topicsByName = _.keyBy(providerTopics, ({ name }) => name);
    const structures = messagePathStructures(datatypes);
    const enums = enumValuesByDatatypeAndField(datatypes);
    const items = getMessagePathDataItems(message, rosPath, topicsByName, structures, enums);
    return items?.map(({ value, path, constantName }) => ({
      value,
      path,
      constantName,
    }));
  });
}

describe("useCachedGetMessagePathDataItems", () => {
  it("supports types with reference cycles (i.e. reference themselves within their children)", () => {
    const topics: Topic[] = [{ name: "/topic", schemaName: "datatype" }];
    const datatypes: RosDatatypes = new Map(
      Object.entries({
        datatype: {
          definitions: [
            { name: "field", type: "uint32", isComplex: false },
            { name: "self", type: "datatype", isComplex: true },
          ],
        },
      }),
    );

    const { result } = renderHook(
      () => useCachedGetMessagePathDataItems(["/topic", "/topic.self"]),
      {
        wrapper: function Wrapper({ children }) {
          return (
            <MockCurrentLayoutProvider>
              <MockMessagePipelineProvider topics={topics} datatypes={datatypes}>
                {children}
              </MockMessagePipelineProvider>
            </MockCurrentLayoutProvider>
          );
        },
      },
    );

    const message: MessageEvent = {
      topic: "/topic",
      receiveTime: { sec: 0, nsec: 0 },
      message: { field: 0, self: { field: 1 } },
      schemaName: "datatype",
      sizeInBytes: 0,
    };

    expect(result.current("/topic", message)).toEqual([
      { constantName: undefined, path: "/topic", value: { field: 0, self: { field: 1 } } },
    ]);

    expect(result.current("/topic.self", message)).toEqual([
      { constantName: undefined, path: "/topic.self", value: { field: 1 } },
    ]);
  });

  describe("getMessagePathDataItems", () => {
    it("traverses down the path for every item", () => {
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: { some_array: [{ some_id: 10, some_message: { x: 10, y: 20 } }] },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            some_array: [
              { some_id: 10, some_message: { x: 10, y: 20 } },
              { some_id: 50, some_message: { x: 50, y: 60 } },
            ],
          },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      const topics: Topic[] = [{ name: "/some/topic", schemaName: "some_datatype" }];
      const datatypes: RosDatatypes = new Map(
        Object.entries({
          some_datatype: {
            definitions: [{ name: "some_array", type: "some_other_datatype", isArray: true }],
          },
          some_other_datatype: {
            definitions: [
              { name: "some_id", type: "uint32" },
              { name: "some_message", type: "yet_another_datatype" },
            ],
          },
          yet_another_datatype: {
            definitions: [
              { name: "x", type: "uint32" },
              { name: "y", type: "uint32" },
            ],
          },
        }),
      );

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic.some_array[:].some_message",
          topics,
          datatypes,
        ),
      ).toEqual([
        [
          {
            value: { x: 10, y: 20 },
            path: "/some/topic.some_array[0].some_message",
            constantName: undefined,
          },
        ],
        [
          {
            value: { x: 10, y: 20 },
            path: "/some/topic.some_array[0].some_message",
            constantName: undefined,
          },
          {
            value: { x: 50, y: 60 },
            path: "/some/topic.some_array[1].some_message",
            constantName: undefined,
          },
        ],
      ]);
    });

    it("works with negative slices", () => {
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: { some_array: [1, 2, 3, 4, 5] },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      const topics: Topic[] = [{ name: "/some/topic", schemaName: "some_datatype" }];
      const datatypes: RosDatatypes = new Map(
        Object.entries({
          some_datatype: { definitions: [{ name: "some_array", type: "int32", isArray: true }] },
        }),
      );

      expect(
        addValuesWithPathsToItems(messages, "/some/topic.some_array[-2:-1]", topics, datatypes),
      ).toEqual([
        [
          { constantName: undefined, path: "/some/topic.some_array[-2]", value: 4 },
          { constantName: undefined, path: "/some/topic.some_array[-1]", value: 5 },
        ],
      ]);
    });

    it("returns nothing for invalid topics", () => {
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: { value: 1 },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      // Topic not present
      expect(addValuesWithPathsToItems(messages, "/some/topic", [], new Map())).toEqual([
        undefined,
      ]);
    });

    it("handles fields inside times", () => {
      const topics: Topic[] = [{ name: "/some/topic", schemaName: "std_msgs/Header" }];
      const datatypes: RosDatatypes = new Map(
        Object.entries({
          "std_msgs/Header": { definitions: [{ name: "stamp", type: "time", isArray: false }] },
        }),
      );
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: { stamp: { sec: 1, nsec: 2 } },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      expect(
        addValuesWithPathsToItems(messages, "/some/topic.stamp.nsec", topics, datatypes),
      ).toEqual([[{ constantName: undefined, path: "/some/topic.stamp.nsec", value: 2 }]]);
    });

    it("filters properly, and uses the filter name in the path", () => {
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            some_array: [
              {
                some_filter_value: 0,
                some_id: 10,
              },
              {
                some_filter_value: 1,
                some_id: 50,
              },
            ],
          },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      const topics: Topic[] = [{ name: "/some/topic", schemaName: "some_datatype" }];
      const datatypes: RosDatatypes = new Map(
        Object.entries({
          some_datatype: {
            definitions: [
              {
                name: "some_array",
                type: "some_other_datatype",
                isArray: true,
              },
            ],
          },
          some_other_datatype: {
            definitions: [
              {
                name: "some_filter_value",
                type: "uint32",
              },
              {
                name: "some_id",
                type: "uint32",
              },
            ],
          },
        }),
      );

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic.some_array[:]{some_filter_value==0}.some_id",
          topics,
          datatypes,
        ),
      ).toEqual([
        [
          {
            constantName: undefined,
            value: 10,
            path: "/some/topic.some_array[:]{some_filter_value==0}.some_id",
          },
        ],
      ]);
    });

    it("filters entire messages", () => {
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            str_field: "A",
            num_field: 1,
          },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            str_field: "A",
            num_field: 2,
          },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            str_field: "B",
            num_field: 2,
          },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      const topics: Topic[] = [{ name: "/some/topic", schemaName: "some_datatype" }];
      const datatypes: RosDatatypes = new Map(
        Object.entries({
          some_datatype: {
            definitions: [
              {
                name: "str_field",
                type: "string",
              },
              {
                name: "num_field",
                type: "uint32",
              },
            ],
          },
        }),
      );

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic{str_field=='A'}.num_field",
          topics,
          datatypes,
        ),
      ).toEqual([
        [{ value: 1, path: "/some/topic{str_field=='A'}.num_field" }],
        [{ value: 2, path: "/some/topic{str_field=='A'}.num_field" }],
        [],
      ]);

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic{str_field=='B'}.num_field",
          topics,
          datatypes,
        ),
      ).toEqual([[], [], [{ value: 2, path: "/some/topic{str_field=='B'}.num_field" }]]);

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic{num_field==2}.num_field",
          topics,
          datatypes,
        ),
      ).toEqual([
        [],
        [{ value: 2, path: "/some/topic{num_field==2}.num_field" }],
        [{ value: 2, path: "/some/topic{num_field==2}.num_field" }],
      ]);

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic{str_field=='A'}{num_field==2}.num_field",
          topics,
          datatypes,
        ),
      ).toEqual([
        [],
        [{ value: 2, path: "/some/topic{str_field=='A'}{num_field==2}.num_field" }],
        [],
      ]);

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic{str_field=='C'}.num_field",
          topics,
          datatypes,
        ),
      ).toEqual([[], [], []]);
    });

    it("returns matching constants", () => {
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            state: 0,
          },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: {
            state: 1,
          },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      const topics: Topic[] = [{ name: "/some/topic", schemaName: "some_datatype" }];
      const datatypes: RosDatatypes = new Map(
        Object.entries({
          some_datatype: {
            definitions: [
              {
                name: "OFF",
                type: "uint32",
                isConstant: true,
                value: 0,
              },
              {
                name: "ON",
                type: "uint32",
                isConstant: true,
                value: 1,
              },
              {
                name: "state",
                type: "uint32",
              },
            ],
          },
        }),
      );

      expect(addValuesWithPathsToItems(messages, "/some/topic.state", topics, datatypes)).toEqual([
        [
          {
            value: 0,
            path: "/some/topic.state",
            constantName: "OFF",
          },
        ],
        [
          {
            value: 1,
            path: "/some/topic.state",
            constantName: "ON",
          },
        ],
      ]);
    });

    it("filters correctly with bigints", () => {
      const messages: MessageEvent[] = [
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: { str_field: "A", num_field: 18446744073709551616n },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
        {
          topic: "/some/topic",
          receiveTime: { sec: 0, nsec: 0 },
          message: { str_field: "B", num_field: 18446744073709552020n },
          schemaName: "datatype",
          sizeInBytes: 0,
        },
      ];
      const topics: Topic[] = [{ name: "/some/topic", schemaName: "some_datatype" }];
      const datatypes: RosDatatypes = new Map(
        Object.entries({
          some_datatype: {
            definitions: [{ name: "num_field", type: "uint64" }],
          },
        }),
      );

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic{num_field==18446744073709551616}.num_field",
          topics,
          datatypes,
        ),
      ).toEqual([
        [
          {
            value: 18446744073709551616n,
            path: "/some/topic{num_field==18446744073709551616}.num_field",
          },
        ],
        [],
      ]);

      expect(
        addValuesWithPathsToItems(
          messages,
          "/some/topic{num_field==18446744073709552020}.num_field",
          topics,
          datatypes,
        ),
      ).toEqual([
        [],
        [
          {
            value: 18446744073709552020n,
            path: "/some/topic{num_field==18446744073709552020}.num_field",
          },
        ],
      ]);
    });
  });
});

describe("fillInGlobalVariablesInPath", () => {
  it("fills in global variables in slices", () => {
    expect(
      fillInGlobalVariablesInPath(
        {
          topicName: "/foo",
          topicNameRepr: "/foo",
          messagePath: [
            { type: "name", name: "bar", repr: "bar" },
            {
              type: "slice",
              start: { variableName: "start", startLoc: 0 },
              end: { variableName: "end", startLoc: 0 },
            },
          ],
          modifier: undefined,
        },
        { start: 10, end: "123" },
      ),
    ).toEqual({
      topicName: "/foo",
      topicNameRepr: "/foo",
      messagePath: [
        { name: "bar", type: "name", repr: "bar" },
        { type: "slice", start: 10, end: 123 },
      ],
    });

    // Non-numbers
    expect(
      fillInGlobalVariablesInPath(
        {
          topicName: "/foo",
          topicNameRepr: "/foo",
          messagePath: [
            { type: "name", name: "bar", repr: "bar" },
            {
              type: "slice",
              start: { variableName: "start", startLoc: 0 },
              end: { variableName: "end", startLoc: 0 },
            },
          ],
          modifier: undefined,
        },
        { end: "blah" },
      ),
    ).toEqual({
      topicName: "/foo",
      topicNameRepr: "/foo",
      messagePath: [
        { type: "name", name: "bar", repr: "bar" },
        { type: "slice", start: 0, end: Infinity },
      ],
    });
  });

  it("fills in global variables in filters", () => {
    expect(
      fillInGlobalVariablesInPath(
        {
          topicName: "/foo",
          topicNameRepr: "/foo",
          messagePath: [
            {
              type: "filter",
              path: ["bar"],
              value: { variableName: "var", startLoc: 0 },
              nameLoc: 0,
              valueLoc: 0,
              repr: "",
            },
          ],
          modifier: undefined,
        },
        { var: 123 },
      ),
    ).toEqual({
      topicName: "/foo",
      topicNameRepr: "/foo",
      messagePath: [
        { type: "filter", path: ["bar"], value: 123, nameLoc: 0, valueLoc: 0, repr: "" },
      ],
    });
  });
});

describe("useDecodeMessagePathsForMessagesByTopic", () => {
  it("results in missing entries when no array is provided for a topic", () => {
    const topics: Topic[] = [
      { name: "/topic1", schemaName: "datatype" },
      { name: "/topic2", schemaName: "datatype" },
      { name: "/topic3", schemaName: "datatype" },
    ];
    const datatypes: RosDatatypes = new Map(
      Object.entries({
        datatype: {
          definitions: [{ name: "value", type: "uint32", isArray: false, isComplex: false }],
        },
      }),
    );
    const { result } = renderHook(({ paths }) => useDecodeMessagePathsForMessagesByTopic(paths), {
      initialProps: {
        paths: ["/topic1.value", "/topic2.value", "/topic3.value", "/topic3..value"],
      },
      wrapper({ children }) {
        return (
          <MockCurrentLayoutProvider>
            <MockMessagePipelineProvider topics={topics} datatypes={datatypes}>
              {children}
            </MockMessagePipelineProvider>
          </MockCurrentLayoutProvider>
        );
      },
    });

    const message: MessageEvent = {
      topic: "/topic1",
      receiveTime: { sec: 0, nsec: 0 },
      message: { value: 1 },
      schemaName: "datatype",
      sizeInBytes: 0,
    };
    const messagesByTopic = {
      "/topic1": [message],
      "/topic2": [],
    };
    expect(result.current(messagesByTopic)).toEqual({
      // Value for /topic1.value
      "/topic1.value": [
        { messageEvent: message, queriedData: [{ path: "/topic1.value", value: 1 }] },
      ],
      // Empty array for /topic2.value
      "/topic2.value": [],
      // No array for /topic3.value because the path is valid but the data is missing.
      // Empty array for /topic3..value because path is invalid.
      "/topic3..value": [],
    });
  });
});
