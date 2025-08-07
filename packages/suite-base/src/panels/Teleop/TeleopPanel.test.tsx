/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import "@testing-library/jest-dom"; // Adiciona matchers como toHaveTextContent e toBeInTheDocument
import { render, screen, fireEvent } from "@testing-library/react";

import TeleopPanel, { buildSettingsTree } from "./TeleopPanel";

// Mocks
jest.mock("./DirectionalPad", () => ({
  __esModule: true,
  default: ({ onAction, disabled }: any) => (
    <div data-testid="directional-pad" data-disabled={disabled ? "true" : "false"}>
      <button onClick={() => onAction?.("UP")}>UP</button>
      <button onClick={() => onAction?.("DOWN")}>DOWN</button>
      <button onClick={() => onAction?.("LEFT")}>LEFT</button>
      <button onClick={() => onAction?.("RIGHT")}>RIGHT</button>
    </div>
  ),
  DirectionalPadAction: {
    UP: "UP",
    DOWN: "DOWN",
    LEFT: "LEFT",
    RIGHT: "RIGHT",
  },
}));

jest.mock("@lichtblick/suite-base/theme/ThemeProvider", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@lichtblick/suite-base/components/EmptyState", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="empty-state">{children}</div>,
}));

jest.mock("@lichtblick/suite-base/components/Stack", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

function getMockContext(overrides: any = {}) {
  return {
    initialState: {},
    saveState: jest.fn(),
    watch: jest.fn(),
    updatePanelSettingsEditor: jest.fn(),
    advertise: jest.fn(),
    unadvertise: jest.fn(),
    publish: jest.fn(),
    onRender: undefined,
    ...overrides,
  };
}

describe("TeleopPanel", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });
  it("renders EmptyState when publish is not available", () => {
    const context = getMockContext({ publish: undefined });
    render(<TeleopPanel context={context} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      "Connect to a data source that supports publishing",
    );
  });

  it("renders EmptyState when topic is missing", () => {
    const context = getMockContext({ publish: jest.fn() });
    render(<TeleopPanel context={context} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      "Select a publish topic in the panel settings",
    );
  });

  it("renders DirectionalPad when canPublish and hasTopic", () => {
    const context = getMockContext({
      publish: jest.fn(),
      initialState: { topic: "foo" },
    });
    render(<TeleopPanel context={context} />);
    expect(screen.queryByTestId("directional-pad")).toBeInTheDocument();
  });

  it("does not publish if publishRate is zero", () => {
    const publish = jest.fn();
    const context = getMockContext({
      publish,
      initialState: { topic: "foo", publishRate: 0 },
    });
    render(<TeleopPanel context={context} />);
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes message when DirectionalPad action is triggered", () => {
    jest.useFakeTimers();
    const publish = jest.fn();
    const context = getMockContext({
      publish,
      initialState: { topic: "foo", publishRate: 1 },
    });
    render(<TeleopPanel context={context} />);
    fireEvent.click(screen.getByText("UP"));
    jest.runOnlyPendingTimers();
    expect(publish).toHaveBeenCalledWith(
      "foo",
      expect.objectContaining({
        linear: expect.any(Object),
        angular: expect.any(Object),
      }),
    );
    jest.useRealTimers();
  });

  it("calls advertise and unadvertise when topic changes", () => {
    const advertise = jest.fn();
    const unadvertise = jest.fn();
    const context = getMockContext({
      publish: jest.fn(),
      advertise,
      unadvertise,
      initialState: { topic: "foo" },
    });
    const { rerender } = render(<TeleopPanel context={context} />);
    expect(advertise).toHaveBeenCalledWith(
      "foo",
      "geometry_msgs/Twist",
      expect.objectContaining({
        datatypes: expect.any(Map),
      }),
    );
    rerender(
      <TeleopPanel
        context={getMockContext({
          publish: jest.fn(),
          advertise,
          unadvertise,
          initialState: { topic: "bar" },
        })}
      />,
    );
    expect(unadvertise).toHaveBeenCalled();
  });

  it("initializes config with defaults when initialState is partial", () => {
    const context = getMockContext({
      initialState: { publishRate: 5, upButton: { field: "linear-y" } },
      publish: jest.fn(),
    });
    render(<TeleopPanel context={context} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      "Select a publish topic in the panel settings",
    );
  });

  it("settingsActionHandler updates config", () => {
    const context = getMockContext({
      publish: jest.fn(),
      initialState: { topic: "foo" },
    });
    render(<TeleopPanel context={context} />);
    const handler = context.updatePanelSettingsEditor.mock.calls[0][0].actionHandler;
    expect(() =>
      handler({
        action: "update",
        payload: { path: ["general", "publishRate"], value: 10 },
      }),
    ).not.toThrow();
  });

  it("buildSettingsTree returns correct structure", () => {
    const config = {
      topic: "foo",
      publishRate: 2,
      upButton: { field: "linear-x", value: 1 },
      downButton: { field: "linear-x", value: -1 },
      leftButton: { field: "angular-z", value: 1 },
      rightButton: { field: "angular-z", value: -1 },
    };
    const topics = [
      { name: "foo", schemaName: "geometry_msgs/Twist" },
      { name: "bar", schemaName: "geometry_msgs/Twist" },
    ];
    const tree = buildSettingsTree(config, topics);
    expect(tree.general?.fields?.publishRate?.value).toBe(2);
    expect(tree.general?.fields?.topic?.input).toEqual("autocomplete");
    expect(tree.general?.children?.upButton?.fields?.field?.value).toBe("linear-x");
  });
});
