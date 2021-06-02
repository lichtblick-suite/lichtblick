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

import { flatten } from "lodash";

// This trims leading and trailing forward slashes off each topic component
// (so "/a/b/c/" becomes "a/b/c") then joins all topics together with "/"
export const joinTopics = (...topics: string[]): string => {
  return "/" + topics.map((t) => t.replace(/^\/+|\/+$/g, "")).join("/");
};

export const addTopicPrefix = (topics: string[], prefix: string): string[] => {
  return topics.map<string>((topic) => joinTopics(prefix, topic));
};

// Calculates the cartesian product of arrays of topics
export const makeTopicCombos = (...topicGroups: string[][]): string[] => {
  const topicArrays = cartesianProduct(topicGroups);
  return topicArrays.map((topics) => joinTopics(...topics));
};

// Calculates the cartesianProduct of arrays of elements
// Inspired by https://gist.github.com/tansongyang/9695563ad9f1fa5309b0af8aa6b3e7e3
// ["foo", "bar"], ["cool", "beans"]] => [["foo", "cool"],["foo", "beans"],["bar", "cool"],["bar", "beans"],]
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce(
    (a: any, b: any) => {
      return flatten<T[]>(
        a.map((x: any) => {
          return b.map((y: any) => {
            return x.concat([y]);
          });
        }),
      );
    },
    [[]],
  );
}
