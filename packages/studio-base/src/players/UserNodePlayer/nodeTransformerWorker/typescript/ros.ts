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
export const ros_lib_filename = "ros/index.d.ts";
export const ros_lib_dts = `
  export declare interface Duration {
    sec: number;
    nsec: number;
  }

  export declare interface Time {
    sec: number;
    nsec: number;
  }

  // Once a data source Messages will be populated with interfaces matching the data source messages.
  export declare namespace Messages {}

  // Once a data source TopicsToMessageDefinition will be populated with topic names to message interfaces.
  export declare interface TopicsToMessageDefinition {}

  /**
   * To correctly type your inputs, you use this type to refer to specific
   * input topics, e.g. 'Input<"/your_input_topic">'. If you have
   * multiple input topics, use a union type, e.g.
   * 'Input<"/your_input_topic_1"> |
   * Input<"/your_input_topic_2">'.
   *
   * These types are dynamically generated from the bag(s) currently in your
   * Foxglove Studio session, so if a datatype changes, your User Script
   * may not compile on the newly formatted bag.
   */
  export declare interface Input<T extends keyof TopicsToMessageDefinition> {
    topic: T;
    receiveTime: Time;
    message: TopicsToMessageDefinition[T];
  }

`;
