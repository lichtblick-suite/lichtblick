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
import { isEqual } from "lodash";

type Rule = (value: unknown) => string | undefined;
type Rules = {
  [name: string]: Rule[];
};

function isEmpty(value: unknown) {
  return value == undefined;
}

export const isEmail = (value?: unknown): boolean => {
  const regex =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return !isEmpty(value) && regex.test(String(value));
};

export const isRequired = (value: unknown): string | undefined =>
  value == undefined ? "is required" : undefined;

export const isNumber = (value: unknown): string | undefined =>
  !isEmpty(value) && typeof value !== "number" ? "must be a number" : undefined;

export const isBoolean = (value: unknown): string | undefined =>
  !isEmpty(value) && typeof value !== "boolean" ? `must be "true" or "false"` : undefined;

export const isNumberArray =
  (expectArrLen = 0) =>
  (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      if (value.length !== expectArrLen) {
        return `must contain ${expectArrLen} array items`;
      }
      for (const item of value) {
        if (typeof item !== "number") {
          return `must contain only numbers in the array. "${item}" is not a number.`;
        }
      }
    }
    return undefined;
  };

export const isOrientation = (value: unknown): string | undefined => {
  const isNumberArrayErr = isNumberArray(4)(value);
  if (isNumberArrayErr != undefined) {
    return isNumberArrayErr;
  }
  if (value != undefined) {
    const quaternionSum = (value as Array<number>).reduce((memo, item) => memo + item * item, 0);
    // Very rough validation to make sure the quaternion numbers are not too far off
    if (Math.abs(quaternionSum - 1) > 0.1) {
      return "must be valid quaternion";
    }
  }
  return undefined;
};

// return the first error
const join = (rules: Array<Rule>) => (value: unknown) =>
  rules.map((rule) => rule(value)).filter((error) => error != undefined)[0];

export const createValidator = (rules: Rules) => {
  return (
    data: Record<string, unknown> = {},
  ): {
    [field: string]: string;
  } => {
    const errors: Record<string, string> = {};
    Object.entries(rules).forEach(([key, rule]) => {
      // concat enables both functions and arrays of functions
      const joinedRules = join(rule);
      const error = joinedRules(data[key]);
      if (error != undefined) {
        errors[key] = error;
      }
    });
    return errors;
  };
};

export type ValidationResult =
  | string
  | {
      [fieldName: string]: string;
    };

export const validationErrorToString = (validationResult: ValidationResult): string =>
  typeof validationResult === "string"
    ? validationResult
    : Object.keys(validationResult)
        .map((key) => `${key}: ${validationResult[key]}`)
        .join(", ");

export const cameraStateValidator = (jsonData: unknown): ValidationResult | undefined => {
  const data = (typeof jsonData !== "object" ? {} : jsonData ?? {}) as Record<string, unknown>;
  const rules = {
    distance: [isNumber],
    perspective: [isBoolean],
    phi: [isNumber],
    thetaOffset: [isNumber],
    target: [isNumberArray(3)],
    targetOffset: [isNumberArray(3)],
    targetOrientation: [isOrientation],
  };
  const validator = createValidator(rules);
  const result = validator(data);

  return Object.keys(result).length === 0 ? undefined : result;
};

const isXYPointArray = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item == undefined || item.x == undefined || item.y == undefined) {
        return `must contain x and y points`;
      }
      if (typeof item.x !== "number" || typeof item.y !== "number") {
        return `x and y points must be numbers`;
      }
    }
    return undefined;
  } else {
    return "must be an array of x and y points";
  }
};

const isPolygons = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const error = isXYPointArray(item);
      if (error != undefined) {
        return error;
      }
    }
    return undefined;
  } else {
    return "must be an array of nested x and y points";
  }
};

// validate the polygons must be a nested array of xy points
export const polygonPointsValidator = (jsonData?: unknown): ValidationResult | undefined => {
  if (jsonData == undefined || jsonData === "" || isEqual(jsonData, []) || isEqual(jsonData, {})) {
    return undefined;
  }
  const rules = { polygons: [isPolygons] };
  const validator = createValidator(rules);
  const result = validator({ polygons: jsonData });
  return Object.keys(result).length === 0 ? undefined : result.polygons;
};

export const point2DValidator = (jsonData?: unknown): ValidationResult | undefined => {
  const data = (typeof jsonData !== "object" ? {} : jsonData ?? {}) as Record<string, unknown>;
  const rules = { x: [isRequired, isNumber], y: [isRequired, isNumber] };
  const validator = createValidator(rules);
  const result = validator(data);
  return Object.keys(result).length === 0 ? undefined : result;
};
