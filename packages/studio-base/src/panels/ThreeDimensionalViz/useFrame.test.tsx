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
import { PropsWithChildren } from "react";

import { MessageEvent } from "@foxglove/studio";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import useFrame from "./useFrame";

const datatypes: RosDatatypes = new Map(
  Object.entries({
    "some/datatype": { definitions: [{ name: "index", type: "int32" }] },
  }),
);

const messageEventFixtures = [
  {
    topic: "/some/topic",
    receiveTime: { sec: 100, nsec: 0 },
    message: { index: 0 },
  },
  {
    topic: "/some/topic",
    receiveTime: { sec: 101, nsec: 0 },
    message: { index: 1 },
  },
  {
    topic: "/some/topic",
    receiveTime: { sec: 102, nsec: 0 },
    message: { index: 2 },
  },
] as const;

type WrapperProps = PropsWithChildren<{ messages: MessageEvent<unknown>[] }>;

describe("useFrame", () => {
  it("should pass in a frame of messages", () => {
    const topics = [
      { name: "/some/topic", datatype: "some/topic" },
      { name: "/foo", datatype: "foo_msgs/Foo" },
    ];

    const { result, rerender } = renderHook(
      () => {
        return useFrame(["/some/topic"]);
      },
      {
        initialProps: {
          messages: [messageEventFixtures[0]],
        },
        wrapper({ children, messages }: WrapperProps) {
          return (
            <MockMessagePipelineProvider messages={messages} datatypes={datatypes} topics={topics}>
              {children}
            </MockMessagePipelineProvider>
          );
        },
      },
    );

    expect(result.current.reset).toEqual(true);
    expect(result.current.frame["/some/topic"]).toEqual([
      {
        topic: "/some/topic",
        receiveTime: { sec: 100, nsec: 0 },
        message: { index: 0 },
      },
    ]);

    // re-render keeps reset value since no new messages have been fed in
    rerender();
    expect(result.current.reset).toEqual(true);
    expect(result.current.frame["/some/topic"]).toEqual([
      {
        topic: "/some/topic",
        receiveTime: { sec: 100, nsec: 0 },
        message: { index: 0 },
      },
    ]);
  });

  it("should pass in another frame of messages", () => {
    const topics = [
      { name: "/some/topic", datatype: "some/topic" },
      { name: "/foo", datatype: "foo_msgs/Foo" },
    ];

    const { result, rerender } = renderHook(
      () => {
        return useFrame(["/some/topic"]);
      },
      {
        initialProps: {
          messages: [messageEventFixtures[0]],
        },
        wrapper({ children, messages }: WrapperProps) {
          return (
            <MockMessagePipelineProvider messages={messages} datatypes={datatypes} topics={topics}>
              {children}
            </MockMessagePipelineProvider>
          );
        },
      },
    );

    expect(result.current.reset).toEqual(true);
    expect(result.current.frame["/some/topic"]).toEqual([
      {
        topic: "/some/topic",
        receiveTime: { sec: 100, nsec: 0 },
        message: { index: 0 },
      },
    ]);

    rerender({ messages: [messageEventFixtures[1]] });

    // next render indicates reset is false since the stream remains the same
    expect(result.current.reset).toEqual(false);
    expect(result.current.frame["/some/topic"]).toEqual([
      {
        topic: "/some/topic",
        receiveTime: { sec: 101, nsec: 0 },
        message: { index: 1 },
      },
    ]);
  });
});
