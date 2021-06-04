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
  if (value) {
    const quaternionSum = (value as Array<number>).reduce((memo, item) => memo + item * item, 0);
    // Very rough validation to make sure the quaternion numbers are not too far off
    if (Math.abs(quaternionSum - 1) > 0.1) {
      return "must be valid quaternion";
    }
  }
  return undefined;
};

export const isString = (value: unknown): string | undefined =>
  typeof value !== "string" ? "must be string" : undefined;

export const minLen =
  (minLength = 0) =>
  (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      return value.length < minLength
        ? `must contain at least ${minLength} array ${minLength === 1 ? "item" : "items"}`
        : undefined;
    } else if (typeof value === "string") {
      return value.length < minLength
        ? `must contain at least ${minLength} ${minLength === 1 ? "character" : "characters"}`
        : undefined;
    }
    return undefined;
  };

export const maxLen =
  (maxLength = 0) =>
  (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      return value.length > maxLength ? `must contain at most ${maxLength} array items` : undefined;
    } else if (typeof value === "string") {
      return value.length > maxLength ? `must contain at most ${maxLength} characters` : undefined;
    }
    return undefined;
  };

export const hasLen =
  (len = 0) =>
  (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      return value.length !== len
        ? `must contain exact ${len} array items (current item count: ${value.length})`
        : undefined;
    } else if (typeof value === "string") {
      return value.length !== len
        ? `must contain ${len} characters (current count: ${value.length})`
        : undefined;
    }
    return undefined;
  };

// return the first error
const join = (rules: Array<Rule>) => (value: unknown) =>
  rules.map((rule) => rule(value)).filter((error) => error != undefined)[0];

export const getWebsocketUrlError = (websocketUrl: string): string => {
  return `"${websocketUrl}" is an invalid WebSocket URL`;
};
export const isWebsocketUrl = (value: string): string | undefined => {
  const pattern = new RegExp(`wss?://[a-z.-_\\d]+(:(d+))?`, "gi");
  if (!pattern.test(value)) {
    return getWebsocketUrlError(value);
  }
  return undefined;
};

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

export const createPrimitiveValidator = (rules: Rule[]) => {
  return (data: unknown): string | undefined => {
    for (const rule of rules) {
      const error = rule(data);
      if (error != undefined) {
        return error;
      }
    }
    return undefined;
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
      if (!item || item.x == undefined || item.y == undefined) {
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
  if (!jsonData || isEqual(jsonData, []) || isEqual(jsonData, {})) {
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
