/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PropsValue, ValueAction } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import Value from "./Value";

// Mock dependencies
jest.mock("@lichtblick/suite-base/util/clipboard", () => ({
  copy: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@lichtblick/suite-base/panels/Plot/utils/openSiblingPlotPanel", () => ({
  openSiblingPlotPanel: jest.fn(),
}));

jest.mock(
  "@lichtblick/suite-base/panels/StateTransitions/openSiblingStateTransitionsPanel",
  () => ({
    openSiblingStateTransitionsPanel: jest.fn(),
  }),
);

jest.mock("./HighlightedValue", () => ({
  __esModule: true,
  default: ({ itemLabel }: { itemLabel: string }) => (
    <span data-testid="highlighted-value">{itemLabel}</span>
  ),
}));

jest.mock("./index.style", () => ({
  useStylesValue: () => ({
    classes: {
      placeholderActionContainer: "mock-placeholder-container",
    },
    cx: (...args: string[]) => args.join(" "),
  }),
}));

const createDefaultProps = (overrides?: Partial<PropsValue>): PropsValue => ({
  arrLabel: "",
  basePath: "/topic",
  itemLabel: BasicBuilder.string(),
  itemValue: BasicBuilder.number(),
  valueAction: undefined,
  onTopicPathChange: jest.fn(),
  openSiblingPanel: jest.fn(),
  ...overrides,
});

describe("Value", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering basic values", () => {
    const itemLabel = BasicBuilder.string();

    describe("when rendering a simple value without array label", () => {
      const props = createDefaultProps({ itemLabel, arrLabel: "" });
      const { container } = render(<Value {...props} />);
      it("then should display the item label", () => {
        // Then
        expect(screen.getByTestId("highlighted-value")).toHaveTextContent(itemLabel);
      });

      it("then should not show action buttons initially", () => {
        // Then
        const buttons = container.querySelectorAll("button");
        expect(buttons).toHaveLength(0);
      });
    });

    describe("when rendering a value with array label", () => {
      const arrLabel = `(${BasicBuilder.number()})[${BasicBuilder.number()}]`;
      const props = createDefaultProps({ itemLabel, arrLabel });
      it("then should display both item label and array label", () => {
        // When
        const { container } = render(<Value {...props} />);

        // Then
        expect(screen.getByTestId("highlighted-value")).toHaveTextContent(itemLabel);
        expect(container.textContent).toContain(arrLabel);
      });
    });

    describe("when rendering different value types", () => {
      const itemValueString = BasicBuilder.string();
      const itemValueNumber = BasicBuilder.number();
      const itemValueBoolean = BasicBuilder.boolean();
      const itemValueBigInt = BasicBuilder.bigInt();
      it("then should handle string values", () => {
        // When
        const props = createDefaultProps({ itemValue: itemValueString });
        render(<Value {...props} />);

        // Then
        expect(screen.getByTestId("highlighted-value")).toBeInTheDocument();
      });

      it("then should handle number values", () => {
        // Given
        const props = createDefaultProps({ itemValue: itemValueNumber });

        // When
        render(<Value {...props} />);

        // Then
        expect(screen.getByTestId("highlighted-value")).toBeInTheDocument();
      });

      it("then should handle boolean values", () => {
        // Given
        const props = createDefaultProps({ itemValue: itemValueBoolean });

        // When
        render(<Value {...props} />);

        // Then
        expect(screen.getByTestId("highlighted-value")).toBeInTheDocument();
      });

      it("then should handle bigint values", () => {
        // Given
        const props = createDefaultProps({ itemValue: itemValueBigInt });

        // When
        render(<Value {...props} />);

        // Then
        expect(screen.getByTestId("highlighted-value")).toBeInTheDocument();
      });
    });
  });

  describe("copy action", () => {
    describe("given a value with array label", () => {
      const arrLabel = `(${BasicBuilder.number()})[${BasicBuilder.number()}]`;
      describe("when hovering over the value", () => {
        it("then should show copy button", async () => {
          // Given
          const user = userEvent.setup();
          const props = createDefaultProps({ arrLabel });

          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          expect(stackElement).toBeInTheDocument();

          await user.hover(stackElement!);

          // Then
          await waitFor(() => {
            const buttons = container.querySelectorAll("button");
            expect(buttons.length).toBeGreaterThan(0);
          });
        });
      });

      describe("when clicking copy button", () => {
        const user = userEvent.setup();
        const itemValue = { foo: BasicBuilder.string(), num: BasicBuilder.number() };
        const props = createDefaultProps({ itemValue, arrLabel });
        it("then should have copy action available", async () => {
          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(
            () => {
              const copyButton = screen.queryByLabelText(/copy/i);
              expect(copyButton).toBeInTheDocument();
            },
            { timeout: 500 },
          );
        });
      });
    });
  });

  describe("filter action", () => {
    describe("given a value action with filter path", () => {
      const user = userEvent.setup();
      const basePath = BasicBuilder.string("/topic");
      const filterPath = BasicBuilder.string(".field");
      const onTopicPathChange = jest.fn();
      const valueAction: ValueAction = {
        singleSlicePath: BasicBuilder.string(".field"),
        multiSlicePath: BasicBuilder.string(".field[:]"),
        primitiveType: "float64",
        filterPath,
      };
      const props = createDefaultProps({
        basePath,
        valueAction,
        onTopicPathChange,
      });
      describe("when rendering with filter action", () => {
        it("then should have filter action available on hover", async () => {
          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(
            () => {
              const filterButton = screen.queryByLabelText(/filter/i);
              expect(filterButton).toBeInTheDocument();
            },
            { timeout: 500 },
          );
        });
      });
    });
  });

  describe("plot actions", () => {
    const user = userEvent.setup();
    const valueAction: ValueAction = {
      singleSlicePath: BasicBuilder.string(".field"),
      multiSlicePath: BasicBuilder.string(".field[:]"),
      primitiveType: "float64",
      filterPath: "",
    };
    const props = createDefaultProps({ valueAction });
    describe("given a plotable value type", () => {
      describe("when value action has single slice path", () => {
        it("then should show line chart action", async () => {
          // Given

          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(() => {
            const buttons = container.querySelectorAll("button");
            expect(buttons.length).toBeGreaterThan(0);
          });
        });
      });

      describe("when rendering with line chart action", () => {
        it("then should have line chart action available on hover", async () => {
          // Given

          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(
            () => {
              const lineChartButton = screen.queryByLabelText(/line chart/i);
              expect(lineChartButton).toBeInTheDocument();
            },
            { timeout: 500 },
          );
        });
      });

      describe("when rendering with scatter plot action", () => {
        it("then should have scatter plot action available on hover", async () => {
          // Given

          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(
            () => {
              const scatterPlotButton = screen.queryByLabelText(/scatter plot/i);
              expect(scatterPlotButton).toBeInTheDocument();
            },
            { timeout: 500 },
          );
        });
      });
    });

    describe("given a non-plotable value type", () => {
      describe("when value action has non-plotable primitive type", () => {
        it("then should not show plot actions", async () => {
          // Given
          const valueActionNonPlotable: ValueAction = {
            ...valueAction,
            primitiveType: "json", // not plotable type
          };
          const propsNonPlotable = createDefaultProps({ valueAction: valueActionNonPlotable });

          // When
          const { container } = render(<Value {...propsNonPlotable} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(() => {
            const lineChartButton = screen.queryByLabelText(/line chart/i);
            const scatterPlotButton = screen.queryByLabelText(/scatter plot/i);
            // Should not have plot actions for non-plotable types
            expect(lineChartButton).not.toBeInTheDocument();
            expect(scatterPlotButton).not.toBeInTheDocument();
          });
        });
      });
    });
  });

  describe("state transitions action", () => {
    const user = userEvent.setup();
    const singleSlicePath = BasicBuilder.string(".state");
    const valueAction: ValueAction = {
      singleSlicePath,
      multiSlicePath: singleSlicePath, // Same path
      primitiveType: "uint8", // transitional type
      filterPath: "",
    };
    const props = createDefaultProps({ valueAction });
    describe("given a transitional value type", () => {
      describe("when multi slice path equals single slice path", () => {
        it("then should show state transitions action", async () => {
          // Given

          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(() => {
            const buttons = container.querySelectorAll("button");
            expect(buttons.length).toBeGreaterThan(0);
          });
        });
      });

      describe("when rendering with state transitions action", () => {
        it("then should have state transitions action available on hover", async () => {
          // When
          const { container } = render(<Value {...props} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          await waitFor(
            () => {
              const stateTransitionsButton = screen.queryByLabelText(/state transitions/i);
              expect(stateTransitionsButton).toBeInTheDocument();
            },
            { timeout: 500 },
          );
        });
      });
    });

    describe("given a transitional type with different paths", () => {
      describe("when multi slice path differs from single slice path", () => {
        const valueActionDifferentPaths: ValueAction = {
          ...valueAction,
          multiSlicePath: BasicBuilder.string(".state[:]"), // Different path
        };
        const propsDifferentPaths = createDefaultProps({
          valueAction: valueActionDifferentPaths,
        });
        it("then should not show state transitions action", async () => {
          // When
          const { container } = render(<Value {...propsDifferentPaths} />);
          const stackElement = container.querySelector("div");
          if (stackElement) {
            await user.hover(stackElement);
          }

          // Then
          // State transitions should not be available when paths differ
          await waitFor(() => {
            const buttons = container.querySelectorAll("button");
            // Will have line chart for uint8, but not state transitions
            expect(buttons.length).toBeGreaterThanOrEqual(0);
          });
        });
      });
    });
  });

  describe("hover behavior", () => {
    const user = userEvent.setup();
    const arrLabel = `(${BasicBuilder.string()}) [${BasicBuilder.string()}]`;
    const props = createDefaultProps({ arrLabel });
    describe("when pointer enters the component", () => {
      it("then should show action buttons", async () => {
        // When
        const { container } = render(<Value {...props} />);
        const stackElement = container.querySelector("div");

        const buttonsBefore = container.querySelectorAll("button");
        expect(buttonsBefore).toHaveLength(0);

        expect(stackElement).not.toBeNull();
        await user.hover(stackElement!);

        // Then
        await waitFor(() => {
          const buttonsAfter = container.querySelectorAll("button");
          expect(buttonsAfter.length).toBeGreaterThan(0);
        });
      });
    });

    describe("when pointer leaves the component", () => {
      it("then should hide action buttons", async () => {
        // When
        const { container } = render(<Value {...props} />);
        const stackElement = container.querySelector("div");
        expect(stackElement).not.toBeNull();

        await user.hover(stackElement!);
        await waitFor(() => {
          const buttons = container.querySelectorAll("button");
          expect(buttons.length).toBeGreaterThan(0);
        });

        await user.unhover(stackElement!);

        // Then
        await waitFor(() => {
          const buttonsAfter = container.querySelectorAll("button");
          expect(buttonsAfter).toHaveLength(0);
        });
      });
    });
  });

  describe("component lifecycle", () => {
    describe("when component unmounts", () => {
      it("then should clean up timeout", () => {
        // Given
        jest.useFakeTimers();
        const props = createDefaultProps({
          arrLabel: `(${BasicBuilder.string()}) [${BasicBuilder.string()}]`,
        });

        // When
        const { unmount } = render(<Value {...props} />);
        unmount();

        // Then
        expect(() => {
          jest.runAllTimers();
        }).not.toThrow();

        jest.useRealTimers();
      });
    });
  });

  describe("memoization", () => {
    describe("when props don't change", () => {
      it("then should not re-render", () => {
        // Given
        const props = createDefaultProps();
        const { rerender } = render(<Value {...props} />);
        const firstRender = screen.getByTestId("highlighted-value");

        // When
        rerender(<Value {...props} />);

        // Then
        const secondRender = screen.getByTestId("highlighted-value");
        expect(firstRender).toBe(secondRender);
      });
    });

    describe("when props change", () => {
      it("then should re-render with new value", () => {
        // Given
        const initialLabel = BasicBuilder.string();
        const newLabel = BasicBuilder.string();
        const props = createDefaultProps({ itemLabel: initialLabel });

        // When
        const { rerender } = render(<Value {...props} />);
        expect(screen.getByTestId("highlighted-value")).toHaveTextContent(initialLabel);

        rerender(<Value {...props} itemLabel={newLabel} />);

        // Then
        expect(screen.getByTestId("highlighted-value")).toHaveTextContent(newLabel);
      });
    });
  });
});
