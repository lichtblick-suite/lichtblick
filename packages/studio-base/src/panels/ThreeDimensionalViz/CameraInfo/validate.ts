// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ValidationResult } from "@foxglove/studio-base/util/validators";

type Rule = (value: unknown) => string | undefined;
type Rules = {
  [name: string]: Rule[];
};

function isEmpty(value: unknown) {
  return value == undefined;
}

const isRequired = (value: unknown): string | undefined =>
  value == undefined ? "is required" : undefined;

const isNumber = (value: unknown): string | undefined =>
  !isEmpty(value) && typeof value !== "number" ? "must be a number" : undefined;

const isBoolean = (value: unknown): string | undefined =>
  !isEmpty(value) && typeof value !== "boolean" ? `must be "true" or "false"` : undefined;

// return the first error
const join = (rules: Array<Rule>) => (value: unknown) =>
  rules.map((rule) => rule(value)).filter((error) => error != undefined)[0];

const createValidator = (rules: Rules) => {
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

const isNumberArray =
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

const isOrientation = (value: unknown): string | undefined => {
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

export const point2DValidator = (jsonData?: unknown): ValidationResult | undefined => {
  const data = (typeof jsonData !== "object" ? {} : jsonData ?? {}) as Record<string, unknown>;
  const rules = { x: [isRequired, isNumber], y: [isRequired, isNumber] };
  const validator = createValidator(rules);
  const result = validator(data);
  return Object.keys(result).length === 0 ? undefined : result;
};
