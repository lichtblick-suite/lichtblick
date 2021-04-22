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

import { intersection, keyBy } from "lodash";
import microMemoize from "micro-memoize";
import { createSelectorCreator, defaultMemoize, createSelector } from "reselect";
import shallowequal from "shallowequal";

import { Topic } from "@foxglove-studio/app/players/types";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { SECOND_SOURCE_PREFIX } from "@foxglove-studio/app/util/globalConstants";

// The ParametricSelector type declaration in reselect requires the props argument
// The props argument is not actually required so we need to fix the declaration.
// We do that by casing the return type of the createSelector call to this new declaration
type FixedParametricSelector<S, P, R> = (state: S, props?: P, ...args: any[]) => R;

export const getTopicNames = createSelector<any, any, any, any>(
  (topics: Topic[]) => topics,
  (topics: Topic[]): string[] => topics.map((topic) => topic.name),
) as FixedParametricSelector<any, any, any>;

export const getSanitizedTopics = microMemoize(
  (subscribedTopics: Set<string>, providerTopics: Topic[]): string[] => {
    return intersection(
      Array.from(subscribedTopics),
      providerTopics.map(({ name }) => name),
    );
  },
);

export function getTopicPrefixes(topics: string[]): string[] {
  // only support one prefix now, can add more such as `/webviz_bag_3` later
  return topics.some((topic) => topic.startsWith(SECOND_SOURCE_PREFIX))
    ? [SECOND_SOURCE_PREFIX]
    : [];
}

export const getTopicsByTopicName = createSelector(
  (topics: readonly Topic[]) => topics,
  (
    topics: readonly Topic[],
  ): {
    [key: string]: Topic;
  } => {
    return keyBy(topics, ({ name }) => name);
  },
);

// Only exported for tests
export const constantsByDatatype = createSelector<any, any, any, any>(
  (datatypes: RosDatatypes) => datatypes,
  (
    datatypes: RosDatatypes,
  ): {
    [key: string]: {
      [key: string]: string;
    };
  } => {
    type Result = Record<string | number, string>;
    const results: Record<string, Result> = {};
    for (const [datatype, value] of Object.entries(datatypes)) {
      const result: Result = (results[datatype] = {});
      for (const field of value.fields) {
        if (
          field.isConstant === true &&
          field.value !== undefined &&
          typeof field.value !== "boolean"
        ) {
          if (result[field.value] != undefined) {
            result[field.value] = "<multiple constants match>";
          } else {
            result[field.value] = field.name;
          }
        }
      }
    }
    return results;
  },
) as FixedParametricSelector<any, any, any>;

// webviz enum annotations are of the form: "Foo__webviz_enum" (notice double underscore)
// This method returns type name from "Foo" or undefined name doesn't match this format
export function extractTypeFromWebizEnumAnnotation(name: string): string | undefined {
  const match = /(.*)__webviz_enum$/.exec(name);
  if (match) {
    return match[1];
  }
  return undefined;
}

// returns a map of the form {datatype -> {field -> {value -> name}}}
export const enumValuesByDatatypeAndField = createSelector<any, any, any, any>(
  (datatypes: RosDatatypes) => datatypes,
  (
    datatypes: RosDatatypes,
  ): {
    [key: string]: {
      [key: string]: {
        [key: string]: string;
      };
    };
  } => {
    const results: Record<string, any> = {};
    for (const [datatype, value] of Object.entries(datatypes)) {
      const currentResult: Record<string, any> = {};
      // keep track of parsed constants
      let constants: {
        [key: string]: string;
      } = {};
      // constants' types
      let lastType: string | undefined;
      for (const field of value.fields) {
        if (lastType != undefined && field.type !== lastType) {
          // encountering new type resets the accumulated constants
          constants = {};
          lastType = undefined;
        }

        if (
          field.isConstant === true &&
          field.value !== undefined &&
          typeof field.value !== "boolean"
        ) {
          lastType = field.type;
          if (constants[field.value] != undefined) {
            constants[field.value] = "<multiple constants match>";
          } else {
            constants[field.value] = field.name;
          }
          continue;
        }
        // check if current field is annotation of the form: "Foo bar__webviz_enum"
        // This means that "bar" is enum of type "Foo"
        const fieldName = extractTypeFromWebizEnumAnnotation(field.name);
        if (fieldName != undefined) {
          // associate all constants of type field.type with the annotated field
          currentResult[fieldName] = constantsByDatatype(datatypes)[field.type];
          continue;
        }

        // this field was already covered by annotation, skip it
        if (currentResult[field.name]) {
          continue;
        }

        // otherwise assign accumulated constants for that field
        if (Object.keys(constants).length > 0) {
          currentResult[field.name] = constants;
        }
        // and start over - reset constants
        constants = {};
      }
      // only assign result if we found non-empty mapping into constants
      if (Object.keys(currentResult).length > 0) {
        results[datatype] = currentResult;
      }
    }
    return results;
  },
) as FixedParametricSelector<any, any, any>;

// @ts-expect-error createSelectorCreator does not vibe with shallowequal
export const shallowEqualSelector = createSelectorCreator(defaultMemoize, shallowequal);
