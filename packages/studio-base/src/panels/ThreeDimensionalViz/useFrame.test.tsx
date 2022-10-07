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

import { renderHook } from "@testing-library/react-hooks";

import { MessageEvent } from "@foxglove/studio";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import useFrame from "./useFrame";

const datatypes: RosDatatypes = new Map(
  Object.entries({
    "some/datatype": { definitions: [{ name: "index", type: "int32" }] },
  }),
);

const messageEventFixtures: MessageEvent<unknown>[] = [
  {
    topic: "/some/topic",
    receiveTime: { sec: 100, nsec: 0 },
    message: { index: 0 },
    schemaName: "some/topic",
    sizeInBytes: 0,
  },
  {
    topic: "/some/topic",
    receiveTime: { sec: 101, nsec: 0 },
    message: { index: 1 },
    schemaName: "some/topic",
    sizeInBytes: 0,
  },
  {
    topic: "/some/topic",
    receiveTime: { sec: 102, nsec: 0 },
    message: { index: 2 },
    schemaName: "some/topic",
    sizeInBytes: 0,
  },
];

describe("useFrame", () => {
  it("should pass in a frame of messages", () => {
    const topics: Topic[] = [
      { name: "/some/topic", schemaName: "some/topic" },
      { name: "/foo", schemaName: "foo_msgs/Foo" },
    ];

    const all: ReturnType<typeof useFrame>[] = [];

    const messages = [messageEventFixtures[0]!];
    const { rerender } = renderHook(
      () => {
        const value = useFrame(["/some/topic"]);
        all.push(value);
        return value;
      },
      {
        wrapper({ children }) {
          return (
            <MockMessagePipelineProvider messages={messages} datatypes={datatypes} topics={topics}>
              {children}
            </MockMessagePipelineProvider>
          );
        },
      },
    );

    expect(all).toEqual<typeof all>([
      { reset: true, frame: {} },
      {
        reset: false,
        frame: {
          "/some/topic": [
            {
              topic: "/some/topic",
              receiveTime: { sec: 100, nsec: 0 },
              message: { index: 0 },
              schemaName: "some/topic",
              sizeInBytes: 0,
            },
          ],
        },
      },
    ]);
    // re-render keeps reset value since no new messages have been fed in
    rerender();
    expect(all).toEqual<typeof all>([
      { reset: true, frame: {} },
      {
        reset: false,
        frame: {
          "/some/topic": [
            {
              topic: "/some/topic",
              receiveTime: { sec: 100, nsec: 0 },
              message: { index: 0 },
              schemaName: "some/topic",
              sizeInBytes: 0,
            },
          ],
        },
      },
      {
        reset: false,
        frame: {
          "/some/topic": [
            {
              topic: "/some/topic",
              receiveTime: { sec: 100, nsec: 0 },
              message: { index: 0 },
              schemaName: "some/topic",
              sizeInBytes: 0,
            },
          ],
        },
      },
    ]);
    expect(all[1]!.frame).toBe(all[2]!.frame);
  });

  it("should pass in another frame of messages", () => {
    const topics: Topic[] = [
      { name: "/some/topic", schemaName: "some/topic" },
      { name: "/foo", schemaName: "foo_msgs/Foo" },
    ];

    const all: ReturnType<typeof useFrame>[] = [];
    let messages: MessageEvent<unknown>[] = [messageEventFixtures[0]!];
    const { rerender } = renderHook(
      () => {
        const value = useFrame(["/some/topic"]);
        all.push(value);
        return value;
      },
      {
        wrapper({ children }) {
          return (
            <MockMessagePipelineProvider messages={messages} datatypes={datatypes} topics={topics}>
              {children}
            </MockMessagePipelineProvider>
          );
        },
      },
    );
    expect(all).toEqual<typeof all>([
      { reset: true, frame: {} },
      {
        reset: false,
        frame: {
          "/some/topic": [
            {
              topic: "/some/topic",
              receiveTime: { sec: 100, nsec: 0 },
              message: { index: 0 },
              schemaName: "some/topic",
              sizeInBytes: 0,
            },
          ],
        },
      },
    ]);

    messages = [messageEventFixtures[1]!];
    rerender();

    expect(all).toEqual<typeof all>([
      { reset: true, frame: {} },
      {
        reset: false,
        frame: {
          "/some/topic": [
            {
              topic: "/some/topic",
              receiveTime: { sec: 100, nsec: 0 },
              message: { index: 0 },
              schemaName: "some/topic",
              sizeInBytes: 0,
            },
          ],
        },
      },
      {
        reset: false,
        frame: {
          "/some/topic": [
            {
              topic: "/some/topic",
              receiveTime: { sec: 100, nsec: 0 },
              message: { index: 0 },
              schemaName: "some/topic",
              sizeInBytes: 0,
            },
          ],
        },
      },
      {
        // next render indicates reset is false since the stream remains the same
        reset: false,
        frame: {
          "/some/topic": [
            {
              topic: "/some/topic",
              receiveTime: { sec: 101, nsec: 0 },
              message: { index: 1 },
              schemaName: "some/topic",
              sizeInBytes: 0,
            },
          ],
        },
      },
    ]);
  });
});
