/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import "@testing-library/jest-dom";

import { FieldEditor } from "@lichtblick/suite-base/components/SettingsTreeEditor/FieldEditor";
import { FieldEditorProps } from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

jest.mock("@lichtblick/suite-base/hooks/useGlobalVariables");

jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: () => ({
    datatypes: new Map(),
    topics: [],
  }),
}));

describe("FieldEditor", () => {
  const label = BasicBuilder.string();

  const renderComponent = async (overrides: Partial<FieldEditorProps> = {}) => {
    const defaultProps: FieldEditorProps = {
      actionHandler: jest.fn(),
      path: ["root"],
      field: { input: "string", label },
      ...overrides,
    };

    const ui: React.ReactElement = (
      <FieldEditor
        actionHandler={defaultProps.actionHandler}
        path={defaultProps.path}
        field={defaultProps.field}
      />
    );

    return {
      ...render(ui),
      user: userEvent.setup(),
      props: defaultProps,
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();

    (useGlobalVariables as jest.Mock).mockReturnValue({
      globalVariables: new Map(),
      setGlobalVariables: jest.fn(),
      overwriteGlobalVariables: jest.fn(),
    });
  });

  it("renders a text input and triggers update action when value changes", async () => {
    const input = "string";
    const tooltip = BasicBuilder.string();
    const error = BasicBuilder.string();

    const { props } = await renderComponent({
      field: { input, label, tooltip, error },
    });

    fireEvent.click(screen.getByTestId("FieldEditor-TextField"));
    const inputField = screen.getByRole("textbox");
    const newValue = BasicBuilder.string();
    fireEvent.change(inputField, { target: { value: newValue } });

    expect(props.actionHandler).toHaveBeenCalledWith({
      action: "update",
      payload: {
        path: props.path,
        input: "string",
        value: newValue,
      },
    });
  });

  it("renders a number input and triggers update action when value changes", async () => {
    const input = "number";

    const { props } = await renderComponent({
      field: { input, label },
    });

    fireEvent.click(screen.getByTestId("FieldEditor-NumberInput"));
    const inputField = screen.getByRole("spinbutton");
    const newValue = BasicBuilder.number();
    fireEvent.change(inputField, { target: { value: newValue } });

    expect(props.actionHandler).toHaveBeenCalledWith({
      action: "update",
      payload: {
        path: props.path,
        input: "number",
        value: newValue,
      },
    });
  });

  describe("Autocomplete", () => {
    const items = BasicBuilder.strings({ count: 3 });
    it("should render an Autocomplete component", async () => {
      const input = "autocomplete";

      await renderComponent({
        field: { input, label, items, value: "string" },
      });

      const combobox = screen.getByRole("combobox");
      await userEvent.click(combobox);

      expect(screen.getByTestId("FieldEditor-Autocomplete")).toBeInTheDocument();
      expect(await screen.findByText(items[0]!)).toBeInTheDocument();
    });

    it("should update value in Autocomplete component", async () => {
      const input = "autocomplete";

      const { props } = await renderComponent({
        field: { input, label, items, value: "string" },
      });

      const combobox = screen.getByRole("combobox");
      await userEvent.click(combobox);
      await userEvent.click(screen.getByText(items[1]!));

      expect(combobox).toHaveValue(items[1]);
      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "autocomplete",
          value: items[1],
        },
      });
    });
  });

  describe("ToggleButtonGroup - toggle input type", () => {
    const options = BasicBuilder.strings({ count: 2 });
    it("should render ToggleButtonGroup component", async () => {
      const input = "toggle";

      await renderComponent({
        field: { input, label, options },
      });

      const toggleButtonOption1 = screen.getByRole("button", { name: options[0] });
      const toggleButtonOption2 = screen.getByRole("button", { name: options[1] });

      expect(screen.getByTestId("FieldEditor-ToggleButtonGroup-toggle")).toBeInTheDocument();
      expect(toggleButtonOption1).toBeInTheDocument();
      expect(toggleButtonOption2).toBeInTheDocument();
    });

    it("should update ToggleButtonGroup component", async () => {
      const input = "toggle";

      const { props } = await renderComponent({
        field: { input, label, options },
      });

      const toggleButtonOption1 = screen.getByRole("button", { name: options[0] });
      await userEvent.click(toggleButtonOption1);

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "toggle",
          value: options[0],
        },
      });
    });
  });

  describe("ToggleButtonGroup - boolean input type", () => {
    it("should render boolean ToggleButtonGroup component", async () => {
      const input = "boolean";

      await renderComponent({ field: { input, label } });
      expect(screen.getByTestId("FieldEditor-ToggleButtonGroup-boolean")).toBeInTheDocument();
    });

    it("should update boolean ToggleButtonGroup component", async () => {
      const input = "boolean";

      const { props } = await renderComponent({ field: { input, label } });
      const toggleOnButton = screen.getByRole("button", { name: /On/i });
      await userEvent.click(toggleOnButton);

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "boolean",
          value: true,
        },
      });
    });
  });

  describe("ColorPickerInput component", () => {
    it("renders a Color Picker input type rgb and triggers update action when value changes", async () => {
      const input = "rgb";

      const { props } = await renderComponent({
        field: { input, label },
      });

      const colorInput = screen.getByTestId("ColorPickerInput");
      fireEvent.click(colorInput);
      fireEvent.change(colorInput.querySelector("input")!, { target: { value: "255" } });

      expect(screen.getByTestId("ColorPickerInput")).toBeInTheDocument();
      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "rgb",
          value: "#225555",
        },
      });
    });

    it("renders a Color Picker input type rgba and triggers update action when value changes", async () => {
      const input = "rgba";

      const { props } = await renderComponent({
        field: { input, label },
      });

      const colorInput = screen.getByTestId("ColorPickerInput");
      fireEvent.click(colorInput);
      fireEvent.change(colorInput.querySelector("input")!, { target: { value: "255" } });

      expect(screen.getByTestId("ColorPickerInput")).toBeInTheDocument();
      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "rgba",
          value: "#225555ff",
        },
      });
    });
  });

  describe("Select input", () => {
    it("renders a select input and triggers update action when value changes", async () => {
      const option1 = BasicBuilder.string();
      const option2 = BasicBuilder.string();
      const options = [
        { label: option1, value: option1 },
        { label: option2, value: option2 },
      ];

      const input = "select";
      const { props } = await renderComponent({
        field: { input, label, options, value: "opt1" },
      });

      const select = screen.getByRole("combobox");
      fireEvent.mouseDown(select);
      const selectOption2 = await screen.findByText(option2);
      fireEvent.click(selectOption2);

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "select",
          value: option2,
        },
      });
    });
  });

  describe("Vec3 input", () => {
    it("renders a vec3 input and triggers update action when value changes", async () => {
      const input = "vec3";
      const value = BasicBuilder.numbers() as [number, number, number];
      const { props } = await renderComponent({
        field: { input, label, value },
      });
      const newValue0 = BasicBuilder.number({ max: 2000 });
      const newValue1 = BasicBuilder.number({ max: 2000 });
      const newValue2 = BasicBuilder.number({ max: 2000 });

      const vec3Input0 = screen.getByTestId("Vec3Input-0").querySelector("input")!;
      fireEvent.change(vec3Input0, { target: { value: newValue0 } });

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "vec3",
          value: [newValue0, value[1], value[2]],
        },
      });

      const vec3Input1 = screen.getByTestId("Vec3Input-1").querySelector("input")!;
      fireEvent.change(vec3Input1, { target: { value: newValue1 } });

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "vec3",
          value: [value[0], newValue1, value[2]],
        },
      });

      const vec3Input2 = screen.getByTestId("Vec3Input-2").querySelector("input")!;
      fireEvent.change(vec3Input2, { target: { value: newValue2 } });

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "vec3",
          value: [value[0], value[1], newValue2],
        },
      });

      expect(props.actionHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe("Vec2 input", () => {
    it("renders a vec2 input and triggers update action when value changes", async () => {
      const input = "vec2";
      const value = [1, 2] as [number, number];
      const { props } = await renderComponent({
        field: { input, label, value },
      });

      const newValue0 = BasicBuilder.number({ max: 2000 });
      const newValue1 = BasicBuilder.number({ max: 2000 });

      const vec2Input0 = screen.getByTestId("Vec2Input-0").querySelector("input")!;
      fireEvent.change(vec2Input0, { target: { value: newValue0 } });

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "vec2",
          value: [newValue0, value[1]],
        },
      });

      const vec2Input1 = screen.getByTestId("Vec2Input-1").querySelector("input")!;
      fireEvent.change(vec2Input1, { target: { value: newValue1 } });

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "vec2",
          value: [value[0], newValue1],
        },
      });

      expect(props.actionHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe("LegendControls input", () => {
    it("renders legend controls", async () => {
      const input = "legendcontrols";
      await renderComponent({
        field: { input, label },
      });

      expect(screen.getByTestId("LegendControls")).toBeInTheDocument();
    });
  });

  describe("Slider input", () => {
    it("renders a slider and triggers update action when value changes", async () => {
      const input = "slider";
      const value = 50;
      const min = 0;
      const max = 100;
      const step = 1;
      const { props } = await renderComponent({
        field: { input, label, value, min, max, step },
      });

      const slider = screen.getByRole("slider");
      fireEvent.change(slider, { target: { value: 75 } });

      expect(props.actionHandler).toHaveBeenCalledWith({
        action: "update",
        payload: {
          path: props.path,
          input: "slider",
          value: 75,
        },
      });
    });
  });

  it("renders a message path input and triggers update action when value changes", async () => {
    const input = "messagepath";

    const { props } = await renderComponent({
      field: { input, label },
    });

    fireEvent.click(screen.getByTestId("autocomplete-textfield"));
    const inputField = screen.getByTestId("autocomplete-textfield").querySelector("input")!;
    const newValue = BasicBuilder.string();
    fireEvent.change(inputField, { target: { value: newValue } });

    expect(props.actionHandler).toHaveBeenCalledWith({
      action: "update",
      payload: {
        path: props.path,
        input: "messagepath",
        value: newValue,
      },
    });
  });
});
