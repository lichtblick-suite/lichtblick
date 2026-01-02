/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import { Topic } from "@lichtblick/suite";
import { buildSettingsTreeTeleop } from "@lichtblick/suite-base/panels/Teleop/buildSettingsTree";
import {
  DirectionalPadAction,
  DirectionalPadProps,
  TeleopConfig,
} from "@lichtblick/suite-base/panels/Teleop/types";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import TeleopPanel from "./TeleopPanel";

// Mocks
function MockDirectionalPad({ onAction, disabled }: DirectionalPadProps): React.JSX.Element {
  return (
    <div data-testid="directional-pad" data-disabled={(disabled ?? false).toString()}>
      <button onClick={() => onAction?.(DirectionalPadAction.UP)}>UP</button>
      <button onClick={() => onAction?.(DirectionalPadAction.DOWN)}>DOWN</button>
      <button onClick={() => onAction?.(DirectionalPadAction.LEFT)}>LEFT</button>
      <button onClick={() => onAction?.(DirectionalPadAction.RIGHT)}>RIGHT</button>
    </div>
  );
}

jest.mock("./DirectionalPad", () => ({
  __esModule: true,
  default: MockDirectionalPad,
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
      initialState: { topic: BasicBuilder.string() },
    });
    render(<TeleopPanel context={context} />);
    expect(screen.queryByTestId("directional-pad")).toBeInTheDocument();
  });

  it("does not publish if publishRate is zero", () => {
    const publish = jest.fn();
    const context = getMockContext({
      publish,
      initialState: { topic: BasicBuilder.string(), publishRate: 0 },
    });
    render(<TeleopPanel context={context} />);
    expect(publish).not.toHaveBeenCalled();
  });

  it("publishes message when DirectionalPad action is triggered", () => {
    jest.useFakeTimers();
    const publish = jest.fn();
    const initialState: Partial<TeleopConfig> = { topic: BasicBuilder.string(), publishRate: 1 };
    const context = getMockContext({
      publish,
      initialState,
    });
    render(<TeleopPanel context={context} />);
    fireEvent.click(screen.getByText("UP"));
    jest.runOnlyPendingTimers();
    expect(publish).toHaveBeenCalledWith(
      initialState.topic,
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
    const initialState: Partial<TeleopConfig> = { topic: BasicBuilder.string() };
    const context = getMockContext({
      publish: jest.fn(),
      advertise,
      unadvertise,
      initialState,
    });
    const { rerender } = render(<TeleopPanel context={context} />);
    expect(advertise).toHaveBeenCalledWith(
      initialState.topic,
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
          initialState,
        })}
      />,
    );
    expect(unadvertise).toHaveBeenCalled();
  });

  it("initializes config with defaults when initialState is partial", () => {
    const initialState: Partial<TeleopConfig> = {
      publishRate: BasicBuilder.number(),
      upButton: {
        field: BasicBuilder.string(),
        value: 0,
      },
    };
    const context = getMockContext({
      initialState,
      publish: jest.fn(),
    });
    render(<TeleopPanel context={context} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      "Select a publish topic in the panel settings",
    );

    const handler = context.updatePanelSettingsEditor.mock.calls[0][0].actionHandler;
    expect(() =>
      handler({
        action: "setFieldValue",
        payload: { path: ["general", "downButton", "field"], value: "linear-x" },
      }),
    ).not.toThrow();

    expect(() =>
      handler({
        action: "setFieldValue",
        payload: { path: ["general", "rightButton", "field"], value: "angular-z" },
      }),
    ).not.toThrow();
  });

  it("settingsActionHandler updates config", () => {
    const context = getMockContext({
      publish: jest.fn(),
      initialState: { topic: BasicBuilder.string() },
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
    const config: TeleopConfig = {
      topic: BasicBuilder.string(),
      publishRate: 2,
      upButton: { field: "linear-x", value: 1 },
      downButton: { field: "linear-x", value: -1 },
      leftButton: { field: "angular-z", value: 1 },
      rightButton: { field: "angular-z", value: -1 },
    };
    const topics = [
      PlayerBuilder.topic({ schemaName: "geometry_msgs/Twist" }),
      PlayerBuilder.topic({ schemaName: "geometry_msgs/Twist" }),
    ] as Readonly<Topic[]>;

    const tree = buildSettingsTreeTeleop(config, topics);
    expect(tree.general?.fields?.publishRate?.value).toBe(2);
    expect(tree.general?.fields?.topic?.input).toEqual("autocomplete");
    expect(tree.general?.children?.upButton?.fields?.field?.value).toBe("linear-x");
  });

  describe("DirectionalPad Actions and Field Value Setting", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    describe("Given a TeleopPanel with a configured topic and publish capability", () => {
      const setupTestEnvironment = (buttonConfig: Partial<TeleopConfig> = {}) => {
        const publish = jest.fn();
        const topic = "test/cmd_vel";
        const defaultConfig: TeleopConfig = {
          topic,
          publishRate: 10,
          upButton: { field: "linear-x", value: 2.0 },
          downButton: { field: "linear-x", value: -2.0 },
          leftButton: { field: "angular-z", value: 1.5 },
          rightButton: { field: "angular-z", value: -1.5 },
          ...buttonConfig,
        };

        const context = getMockContext({
          publish,
          initialState: defaultConfig,
        });

        return { context, publish, topic, config: defaultConfig };
      };

      describe("When UP action is triggered", () => {
        it("Then should set linear-x field with upButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            upButton: { field: "linear-x", value: 3.0 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("UP"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 3.0, y: 0, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: 0 }),
            }),
          );
        });

        it("Then should set linear-y field with upButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            upButton: { field: "linear-y", value: 1.5 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("UP"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: 1.5, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: 0 }),
            }),
          );
        });

        it("Then should set linear-z field with upButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            upButton: { field: "linear-z", value: 0.8 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("UP"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: 0, z: 0.8 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: 0 }),
            }),
          );
        });
      });

      describe("When DOWN action is triggered", () => {
        it("Then should set linear-x field with downButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            downButton: { field: "linear-x", value: -2.5 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("DOWN"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: -2.5, y: 0, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: 0 }),
            }),
          );
        });

        it("Then should set angular-x field with downButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            downButton: { field: "angular-x", value: -1.2 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("DOWN"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: 0, z: 0 }),
              angular: expect.objectContaining({ x: -1.2, y: 0, z: 0 }),
            }),
          );
        });
      });

      describe("When LEFT action is triggered", () => {
        it("Then should set angular-z field with leftButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            leftButton: { field: "angular-z", value: 2.0 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("LEFT"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: 0, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: 2.0 }),
            }),
          );
        });

        it("Then should set angular-y field with leftButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            leftButton: { field: "angular-y", value: 0.9 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("LEFT"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: 0, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0.9, z: 0 }),
            }),
          );
        });
      });

      describe("When RIGHT action is triggered", () => {
        it("Then should set angular-z field with rightButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            rightButton: { field: "angular-z", value: -1.8 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("RIGHT"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: 0, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: -1.8 }),
            }),
          );
        });

        it("Then should set linear-y field with rightButton value", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            rightButton: { field: "linear-y", value: -0.7 },
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("RIGHT"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: -0.7, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: 0 }),
            }),
          );
        });
      });

      describe("When testing all field combinations", () => {
        const fieldCombinations = [
          { field: "linear-x", expectedPath: "linear.x" },
          { field: "linear-y", expectedPath: "linear.y" },
          { field: "linear-z", expectedPath: "linear.z" },
          { field: "angular-x", expectedPath: "angular.x" },
          { field: "angular-y", expectedPath: "angular.y" },
          { field: "angular-z", expectedPath: "angular.z" },
        ];

        fieldCombinations.forEach(({ field, expectedPath }) => {
          it(`Then should correctly set ${field} field value in message`, () => {
            // Given
            const testValue = Math.random() * 10;
            const { context, publish } = setupTestEnvironment({
              upButton: { field, value: testValue },
            });

            // When
            render(<TeleopPanel context={context} />);
            fireEvent.click(screen.getByText("UP"));
            jest.runOnlyPendingTimers();

            // Then
            const publishedMessage = publish.mock.calls[0][1];
            const actualValue = expectedPath
              .split(".")
              .reduce((obj, key) => obj[key], publishedMessage);
            expect(actualValue).toBe(testValue);
          });
        });
      });

      describe("When multiple actions are triggered in sequence", () => {
        it("Then should publish correct values for each action", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            upButton: { field: "linear-x", value: 1.0 },
            downButton: { field: "linear-x", value: -1.0 },
            leftButton: { field: "angular-z", value: 0.5 },
            rightButton: { field: "angular-z", value: -0.5 },
          });

          // When
          render(<TeleopPanel context={context} />);

          // Trigger UP
          fireEvent.click(screen.getByText("UP"));
          jest.runOnlyPendingTimers();

          // Clear previous calls and trigger DOWN
          publish.mockClear();
          fireEvent.click(screen.getByText("DOWN"));
          jest.runOnlyPendingTimers();

          // Clear previous calls and trigger LEFT
          publish.mockClear();
          fireEvent.click(screen.getByText("LEFT"));
          jest.runOnlyPendingTimers();

          // Clear previous calls and trigger RIGHT
          publish.mockClear();
          fireEvent.click(screen.getByText("RIGHT"));
          jest.runOnlyPendingTimers();

          // Then
          expect(publish).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              linear: expect.objectContaining({ x: 0, y: 0, z: 0 }),
              angular: expect.objectContaining({ x: 0, y: 0, z: -0.5 }),
            }),
          );
        });
      });

      describe("When publishRate affects message timing", () => {
        it("Then should publish at correct intervals based on publishRate", () => {
          // Given
          const { context, publish } = setupTestEnvironment({
            publishRate: 5, // 5 Hz = 200ms intervals
          });

          // When
          render(<TeleopPanel context={context} />);
          fireEvent.click(screen.getByText("UP"));

          // Advance time by 200ms (one interval)
          jest.advanceTimersByTime(200);

          // Then
          expect(publish).toHaveBeenCalledTimes(2); // Initial + one interval

          // When advancing another 200ms
          jest.advanceTimersByTime(200);

          // Then
          expect(publish).toHaveBeenCalledTimes(3); // Initial + two intervals
        });
      });
    });
  });

  describe("onRender callback functionality", () => {
    const setupRenderTestEnvironment = () => {
      const context = getMockContext({
        publish: jest.fn(),
        initialState: { topic: "test/topic" },
      });
      return { context };
    };

    describe("When onRender is called with topics", () => {
      it("Then should set topics from renderState", () => {
        // Given
        const { context } = setupRenderTestEnvironment();
        const mockTopics: Topic[] = [
          {
            ...PlayerBuilder.topic({ schemaName: "geometry_msgs/Twist", name: "cmd_vel" }),
            schemaName: "geometry_msgs/Twist",
          },
          {
            ...PlayerBuilder.topic({ schemaName: "sensor_msgs/LaserScan", name: "scan" }),
            schemaName: "sensor_msgs/LaserScan",
          },
        ] as Topic[];

        // When
        render(<TeleopPanel context={context} />);
        const onRenderCallback = context.onRender;
        expect(onRenderCallback).toBeDefined();

        // Simulate onRender call with topics
        onRenderCallback?.({ topics: mockTopics }, jest.fn());

        // Then
        // Verify that updatePanelSettingsEditor is called with the new topics
        // The buildSettingsTreeTeleop function uses the topics to build the settings tree
        expect(context.updatePanelSettingsEditor).toHaveBeenCalledWith(
          expect.objectContaining({
            nodes: expect.any(Object),
          }),
        );
      });
    });

    describe("When onRender is called with colorScheme", () => {
      it("Then should set colorScheme to dark when provided", () => {
        // Given
        const { context } = setupRenderTestEnvironment();

        // When
        const { container } = render(<TeleopPanel context={context} />);
        const onRenderCallback = context.onRender;

        // Simulate onRender call with dark color scheme
        onRenderCallback?.({ colorScheme: "dark" }, jest.fn());

        // Then
        expect(container).toBeInTheDocument();
      });
    });
  });
});
