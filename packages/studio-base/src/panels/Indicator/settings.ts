// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";
import { useMemo } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import {
  SettingsTreeAction,
  SettingsTreeNode,
  SettingsTreeNodeAction,
  SettingsTreeNodes,
} from "@foxglove/studio";

import { Config, Rule } from "./types";

function ruleToString(rule: Rule): string {
  const operator = {
    "=": "=",
    "<": "<",
    "<=": "≤",
    ">": ">",
    ">=": "≥",
  }[rule.operator];
  return `data ${operator} ${rule.rawValue}`;
}

export function settingsActionReducer(prevConfig: Config, action: SettingsTreeAction): Config {
  return produce(prevConfig, (draft) => {
    switch (action.action) {
      case "perform-node-action":
        if (action.payload.path[0] === "rules") {
          if (action.payload.id === "delete-rule") {
            const ruleIndex = +action.payload.path[1]!;
            draft.rules.splice(ruleIndex, 1);
          } else if (
            action.payload.id === "add-rule" ||
            action.payload.id === "add-rule-above" ||
            action.payload.id === "add-rule-below"
          ) {
            let insertIndex = draft.rules.length;
            if (action.payload.id === "add-rule-above" && action.payload.path[1] !== "default") {
              insertIndex = +action.payload.path[1]!;
            } else if (action.payload.id === "add-rule-below") {
              insertIndex = +action.payload.path[1]! + 1;
            }
            draft.rules.splice(insertIndex, 0, {
              operator: "=",
              rawValue: "true",
              color: `#${Math.floor(Math.random() * 0x1000000).toString(16)}`,
              label: "Label",
            });
          } else if (action.payload.id === "move-up") {
            const ruleIndex = +action.payload.path[1]!;
            const [rule] = draft.rules.splice(ruleIndex, 1);
            draft.rules.splice(ruleIndex - 1, 0, rule!);
          } else if (action.payload.id === "move-down") {
            const ruleIndex = +action.payload.path[1]!;
            const [rule] = draft.rules.splice(ruleIndex, 1);
            draft.rules.splice(ruleIndex + 1, 0, rule!);
          }
        }
        break;
      case "update":
        switch (action.payload.path[0]) {
          case "general":
            _.set(draft, [action.payload.path[1]!], action.payload.value);
            break;
          case "rules":
            if (action.payload.path[1] === "default") {
              _.set(draft, [action.payload.path[2]!], action.payload.value);
            } else {
              const ruleIndex = +action.payload.path[1]!;
              _.set(draft.rules[ruleIndex]!, [action.payload.path[2]!], action.payload.value);
            }
            break;
          default:
            throw new Error(`Unexpected payload.path[0]: ${action.payload.path[0]}`);
        }
        break;
    }
  });
}

const memoizedCreateRuleNode = memoizeWeak(
  (rule: Rule, i: number, rules: readonly Rule[]): SettingsTreeNode => {
    const actions: (SettingsTreeNodeAction | false)[] = [
      { type: "action", id: "delete-rule", label: "Delete rule", icon: "Delete" },
      i > 0 && { type: "action", id: "move-up", label: "Move up", icon: "MoveUp" },
      i < rules.length - 1 && {
        type: "action",
        id: "move-down",
        label: "Move down",
        icon: "MoveDown",
      },
      { type: "action", id: "add-rule-above", label: "Add rule above", icon: "Add" },
      { type: "action", id: "add-rule-below", label: "Add rule below", icon: "Add" },
    ];
    return {
      label: ruleToString(rule),
      actions: actions.filter((action): action is SettingsTreeNodeAction => action !== false),
      fields: {
        operator: {
          label: "Comparison",
          input: "select",
          value: rule.operator,
          options: [
            { label: "Equal to", value: "=" },
            { label: "Less than", value: "<" },
            { label: "Less than or equal to", value: "<=" },
            { label: "Greater than", value: ">" },
            { label: "Greater than or equal to", value: ">=" },
          ],
        },
        rawValue: {
          label: "Compare with",
          input: "string",
          value: rule.rawValue,
        },
        color: {
          label: "Color",
          input: "rgb",
          value: rule.color,
        },
        label: {
          label: "Label",
          input: "string",
          value: rule.label,
        },
      },
    };
  },
);

export function useSettingsTree(
  config: Config,
  pathParseError: string | undefined,
  error: string | undefined,
): SettingsTreeNodes {
  const { path, style, rules } = config;
  const generalSettings: SettingsTreeNode = useMemo(
    () => ({
      error,
      fields: {
        path: {
          label: "Message path",
          input: "messagepath",
          value: path,
          error: pathParseError,
        },
        style: {
          label: "Style",
          input: "select",
          value: style,
          options: [
            { label: "Bulb", value: "bulb" },
            { label: "Background", value: "background" },
          ],
        },
      },
    }),
    [error, path, pathParseError, style],
  );

  const { fallbackColor, fallbackLabel } = config;
  const ruleSettings: SettingsTreeNode = useMemo(
    () => ({
      label: "Rules (first matching rule wins)",
      actions: [{ type: "action", id: "add-rule", label: "Add rule", icon: "Add" }],
      children: Object.fromEntries(
        rules
          .map((rule, i) => [i.toString(), memoizedCreateRuleNode(rule, i, rules)])
          .concat([
            [
              "default",
              {
                label: "Otherwise",
                fields: {
                  fallbackColor: {
                    label: "Color",
                    input: "rgb",
                    value: fallbackColor,
                    help: "Color to use when no other rules match",
                  },
                  fallbackLabel: {
                    label: "Label",
                    input: "string",
                    value: fallbackLabel,
                    help: "Label to use when no other rules match",
                  },
                },
                actions: [
                  { type: "action", id: "add-rule-above", label: "Add rule above", icon: "Add" },
                ],
              },
            ],
          ]),
      ),
    }),
    [fallbackColor, fallbackLabel, rules],
  );

  return useShallowMemo({
    general: generalSettings,
    rules: ruleSettings,
  });
}
