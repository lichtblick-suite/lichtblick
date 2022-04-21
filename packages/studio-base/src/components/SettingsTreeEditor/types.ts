// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type SettingsTreeFieldValue =
  | { input: "autocomplete"; value?: string; items: string[] }
  | { input: "boolean"; value?: boolean }
  | { input: "color"; value?: string }
  | { input: "gradient"; value?: string }
  | { input: "messagepath"; value?: string; validTypes?: string[] }
  | { input: "number"; value?: number; step?: number }
  | {
      input: "select";
      value?: number | readonly number[];
      options: Array<{ label: string; value: undefined | number }>;
    }
  | {
      input: "select";
      value?: string | readonly string[];
      options: Array<{ label: string; value: undefined | string }>;
    }
  | { input: "string"; value?: string }
  | { input: "toggle"; value?: string; options: string[] };

export type SettingsTreeField = SettingsTreeFieldValue & {
  help?: string;
  label: string;
  placeholder?: string;
};

export type SettingsTreeFields = Record<string, SettingsTreeField>;

export type SettingsTreeChildren = Record<string, SettingsTreeNode>;

export type SettingsTreeNode = {
  children?: SettingsTreeChildren;
  fields?: SettingsTreeFields;
  label?: string;
};

/**
 * Distributes Pick<T, K> across all members of a union, used for extracting structured
 * subtypes.
 */
type DistributivePick<T, K extends keyof T> = T extends unknown ? Pick<T, K> : never;

/**
 * Represents actions that can be dispatched to source of the SettingsTree to implement
 * edits and updates.
 */
export type SettingsTreeAction = {
  action: "update";
  payload: { path: readonly string[] } & DistributivePick<
    SettingsTreeFieldValue,
    "input" | "value"
  >;
};

/**
 * A settings tree is a tree of panel settings that can be managed by
 * a default user interface in Studio.
 */
export type SettingsTree = {
  /**
   * Handler to process all actions on the settings tree initiated by the UI.
   */
  actionHandler: (action: SettingsTreeAction) => void;

  /**
   * True if the editor should not show the filter control.
   */
  disableFilter?: boolean;

  /**
   * The actual settings tree. Updates to this will automatically be reflected in the
   * editor UI.
   */
  settings: SettingsTreeNode;
};
