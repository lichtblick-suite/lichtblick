// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { assertNever } from "@lichtblick/suite-base/util/assertNever";

import { IndicatorRule, RawValueIndicator } from "./types";

export function getMatchingRule(
  rawValue: RawValueIndicator,
  rules: readonly IndicatorRule[],
): IndicatorRule | undefined {
  const value = typeof rawValue === "object" ? rawValue.data : rawValue;
  if (value == undefined) {
    return undefined;
  }
  for (const rule of rules) {
    let rhs: boolean | number | string | bigint;
    try {
      if (typeof value === "boolean" || typeof value === "number") {
        rhs = JSON.parse(rule.rawValue);
        if (typeof rhs !== "boolean" && typeof rhs !== "number") {
          continue;
        }
      } else if (typeof value === "string") {
        rhs = rule.rawValue;
      } else if (typeof value === "bigint") {
        rhs = BigInt(rule.rawValue);
      } else {
        assertNever(value, "Unsupported rule value");
      }
    } catch (error: unknown) {
      console.error(error);
      continue;
    }

    if (rule.operator === "=" && value === rhs) {
      return rule;
    } else if (rule.operator === "<" && value < rhs) {
      return rule;
    } else if (rule.operator === "<=" && value <= rhs) {
      return rule;
    } else if (rule.operator === ">" && value > rhs) {
      return rule;
    } else if (rule.operator === ">=" && value >= rhs) {
      return rule;
    }
  }
  return undefined;
}
