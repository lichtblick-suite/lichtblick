/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import * as _ from "lodash-es";

import { SettingsTreeAction } from "@lichtblick/suite";
import GaugeBuilder from "@lichtblick/suite-base/testing/builders/GaugeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { settingsActionReducer } from "./settingsActionReducer";
import { SettingsActionReducerProps } from "./types";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("settingsActionReducer", () => {
  function buildUpdateAction({
    path,
    value,
  }: { path?: string[]; value?: string } = {}): SettingsTreeAction {
    return {
      action: "update",
      payload: {
        input: "autocomplete",
        path: path ?? BasicBuilder.strings(),
        value: value ?? BasicBuilder.string(),
      },
    };
  }

  function buildPerformNodeAction(): SettingsTreeAction {
    return {
      action: "perform-node-action",
      payload: {
        id: BasicBuilder.string(),
        path: BasicBuilder.strings(),
      },
    };
  }

  function setup(propsOverride: Partial<SettingsActionReducerProps> = {}): {
    props: SettingsActionReducerProps;
  } {
    const settingsTreeAction: "perform-node-action" | "update" = BasicBuilder.sample([
      "perform-node-action",
      "update",
    ]);
    const action: SettingsTreeAction = buildPerformNodeAction();
    if (settingsTreeAction === "update") {
      _.merge(action, buildUpdateAction());
    }

    const props: SettingsActionReducerProps = {
      prevConfig: GaugeBuilder.config(),
      action,
      ...propsOverride,
    };
    return { props };
  }

  it("should throw an error for 'perform-node-action' action", () => {
    const { props } = setup({
      action: buildPerformNodeAction(),
    });

    expect(() => settingsActionReducer(props)).toThrow(
      `Unhandled node action: ${(props.action.payload as any).id}`,
    );
  });

  it("should update a general property when path is 'general'", () => {
    const value = BasicBuilder.string();
    const path = ["general", ...BasicBuilder.strings()];
    const action = buildUpdateAction({ path, value });
    const { props } = setup({ action });

    const result = settingsActionReducer(props);

    expect(result).toHaveProperty(path[1]!);
    expect((result as any)[path[1]!]).toBe(value);
  });

  it("should throw an error for an unexpected path[0]", () => {
    const action = buildUpdateAction();
    const { props } = setup({ action });

    expect(() => settingsActionReducer(props)).toThrow(
      `Unexpected payload.path[0]: ${props.action.payload.path[0]}`,
    );
  });

  it("Immer should return the same config if the action type is not handled", () => {
    const action = {
      action: "unknown-action",
      payload: {},
    } as unknown as SettingsTreeAction;
    const { props } = setup({ action });

    const result = settingsActionReducer({ prevConfig: props.prevConfig, action });

    expect(result).toEqual(props.prevConfig);
  });
});
