/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
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

import { userEvent } from "@storybook/testing-library";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { useDebounce } from "use-debounce";

import { MessagePath } from "@lichtblick/message-path";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { useUserProfileStorage } from "@lichtblick/suite-base/context/UserProfileStorageContext";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";

import MessagePathInput, {
  tryToSetDefaultGlobalVar,
  getFirstInvalidVariableFromRosPath,
} from "./MessagePathInput";
import { MessagePathInputBaseProps } from "./types";

jest.mock("@lichtblick/suite-base/hooks/useGlobalVariables");
jest.mock("@lichtblick/suite-base/components/MessagePipeline");
jest.mock("@lichtblick/suite-base/context/UserProfileStorageContext");
jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext");
jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: () => ({
    datatypes: new Map(),
    topics: [],
  }),
}));
jest.mock("@lichtblick/suite-base/services/LayoutManager/LayoutManager", () =>
  jest.fn(() => new MockLayoutManager()),
);
jest.mock("use-debounce");

describe("tryToSetDefaultGlobalVar", () => {
  it("correctly returns true/false depending on whether a global variable has a default", () => {
    const setGlobalVars = jest.fn();
    expect(tryToSetDefaultGlobalVar("some_var_without_default", setGlobalVars)).toEqual(false);
    expect(setGlobalVars).not.toHaveBeenCalled();
  });
});

describe("getFirstInvalidVariableFromRosPath", () => {
  it("returns all possible message paths when not passing in `validTypes`", () => {
    const setGlobalVars = jest.fn();
    const defaultOperator = "==";
    const rosPath: MessagePath = {
      topicName: "/some_topic",
      topicNameRepr: "/some_topic",
      messagePath: [
        { type: "name", name: "fieldName", repr: "fieldName" },
        { type: "slice", start: 0, end: Infinity },
        {
          type: "filter",
          path: ["myId"],
          value: { variableName: "not_yet_set_global_var", startLoc: 10 },
          nameLoc: 11,
          valueLoc: 10,
          repr: "myId==$not_yet_set_global_var",
          operator: defaultOperator,
        },
      ],
      modifier: undefined,
    };
    expect(getFirstInvalidVariableFromRosPath(rosPath, {}, setGlobalVars)).toEqual({
      loc: 10,
      variableName: "not_yet_set_global_var",
    });
    expect(setGlobalVars).not.toHaveBeenCalled();

    expect(
      getFirstInvalidVariableFromRosPath(rosPath, { not_yet_set_global_var: 5 }, setGlobalVars),
    ).toEqual(undefined);
    expect(setGlobalVars).not.toHaveBeenCalled();
  });
});

describe("MessagePathInput Component", () => {
  const mockOnChange = jest.fn();
  (useGlobalVariables as jest.Mock).mockReturnValue({
    globalVariables: {},
    setGlobalVariables: jest.fn(),
  });
  (useMessagePipeline as jest.Mock).mockReturnValue({});
  (useUserProfileStorage as jest.Mock).mockReturnValue({
    getUserProfile: {},
    setUserProfile: jest.fn(),
  });
  (useDebounce as jest.Mock).mockImplementation((value) => [value]);

  const renderComponent = (propsOverride: Partial<MessagePathInputBaseProps> = {}) => {
    const props: MessagePathInputBaseProps = {
      onChange: mockOnChange,
      path: "",
      index: 0,
      ...propsOverride,
    };

    const ui: React.ReactElement = (
      <MockPanelContextProvider>
        <MessagePathInput {...props} />
      </MockPanelContextProvider>
    );

    return {
      ...render(ui),
      user: userEvent.setup(),
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should update value when onChange is called", async () => {
    renderComponent();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "newValue" } });

    expect(input.getAttribute("value")).toBe("newValue");
  });

  it('should insert "}" after typing "{"', async () => {
    const { user } = renderComponent();

    const input = screen.getByRole("combobox");
    await user.type(input, "{{");

    expect(mockOnChange).toHaveBeenCalledWith("{}", 0);
  });
});
