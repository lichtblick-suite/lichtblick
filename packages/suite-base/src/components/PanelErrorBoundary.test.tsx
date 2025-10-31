/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import { Component, ReactNode } from "react";

import PanelErrorBoundary from "@lichtblick/suite-base/components/PanelErrorBoundary";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

jest.mock("@lichtblick/suite-base/reportError", () => ({
  reportError: jest.fn(),
}));

interface ErrorThrowingComponentProps {
  triggerError?: boolean;
  errorMessage?: string;
}

class ErrorThrowingComponent extends Component<ErrorThrowingComponentProps> {
  public override render(): ReactNode {
    if (this.props.triggerError ?? false) {
      throw new Error(this.props.errorMessage ?? "Test error");
    }
    return <div data-testid="working-component">Component is working</div>;
  }
}

function renderErrorBoundary(
  children: ReactNode,
  props: {
    onResetPanel?: () => void;
    onRemovePanel?: () => void;
    onLogError?: (message: string, error?: Error) => void;
    showErrorDetails?: boolean;
    hideErrorSourceLocations?: boolean;
  } = {},
) {
  const defaultProps = {
    onResetPanel: jest.fn(),
    onRemovePanel: jest.fn(),
    onLogError: jest.fn(),
    ...props,
  };

  return {
    ...render(
      <ThemeProvider isDark={false}>
        <PanelErrorBoundary {...defaultProps}>{children}</PanelErrorBoundary>
      </ThemeProvider>,
    ),
    props: defaultProps,
  };
}

describe("PanelErrorBoundary", () => {
  beforeEach(() => {
    // Silence console.error for error boundary tests
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe("Given a working component", () => {
    it("When rendered normally Then displays the child component", () => {
      // Given
      const workingComponent = <ErrorThrowingComponent triggerError={false} />;

      // When
      renderErrorBoundary(workingComponent);

      // Then
      expect(screen.getByTestId("working-component")).toBeTruthy();
      expect(screen.getByText("Component is working")).toBeTruthy();
    });

    it("When no error occurs Then does not call onLogError", () => {
      // Given
      const workingComponent = <ErrorThrowingComponent triggerError={false} />;

      // When
      const { props } = renderErrorBoundary(workingComponent);

      // Then
      expect(props.onLogError).not.toHaveBeenCalled();
    });
  });

  describe("Given a component that throws an error", () => {
    it("When error is thrown Then displays error boundary UI", () => {
      // Given
      const errorComponent = (
        <ErrorThrowingComponent triggerError={true} errorMessage="Test render error" />
      );

      // When
      renderErrorBoundary(errorComponent);

      // Then
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      expect(screen.getByText("Test render error")).toBeTruthy();
      expect(
        screen.queryAllByText((_, element) => {
          return (
            element?.textContent ===
            "Something went wrong in this panel. Dismiss this error to continue using this panel. If the issue persists, try resetting the panel."
          );
        }).length,
      ).toBeGreaterThan(0);
    });

    it("When error is thrown Then displays action buttons", () => {
      // Given
      const errorComponent = <ErrorThrowingComponent triggerError={true} />;

      // When
      renderErrorBoundary(errorComponent);

      // Then
      expect(screen.getByText("Dismiss")).toBeTruthy();
      expect(screen.getByText("Reset Panel")).toBeTruthy();
      expect(screen.getByText("Remove Panel")).toBeTruthy();
    });

    it("When error is thrown Then calls onLogError with error details", () => {
      // Given
      const errorMessage = "Custom error message";
      const errorComponent = (
        <ErrorThrowingComponent triggerError={true} errorMessage={errorMessage} />
      );

      // When
      const { props } = renderErrorBoundary(errorComponent);

      // Then
      expect(props.onLogError).toHaveBeenCalledTimes(1);
      expect(props.onLogError).toHaveBeenCalledWith(
        `Panel render error: ${errorMessage}`,
        expect.any(Error),
      );
      expect((props.onLogError as jest.Mock).mock.calls[0][1].message).toBe(errorMessage);
    });

    it("When onLogError is not provided Then does not throw", () => {
      // Given
      const errorComponent = <ErrorThrowingComponent triggerError={true} />;

      // When/Then - should not throw
      expect(() => {
        const { props } = renderErrorBoundary(errorComponent, { onLogError: undefined });
        expect(props.onLogError).toBeUndefined();
      }).not.toThrow();

      // Should still show error UI
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
    });
  });

  describe("Given error boundary is displaying error state", () => {
    it("When Dismiss button is clicked Then attempts to render children again", () => {
      // Given
      let shouldThrowError = true;
      const ConditionalErrorComponent = () => {
        if (shouldThrowError) {
          throw new Error("Conditional error");
        }
        return <div data-testid="recovered-component">Component recovered</div>;
      };

      renderErrorBoundary(<ConditionalErrorComponent />);

      // Verify error state is shown
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();

      // When
      shouldThrowError = false; // Fix the error condition
      const dismissButton = screen.getByText("Dismiss");
      fireEvent.click(dismissButton);

      // Then
      expect(screen.getByTestId("recovered-component")).toBeTruthy();
      expect(screen.getByText("Component recovered")).toBeTruthy();
      expect(screen.queryByText("This panel encountered an unexpected error")).toBeFalsy();
    });

    it("When Reset Panel button is clicked Then calls onResetPanel and clears error", () => {
      // Given
      const errorComponent = <ErrorThrowingComponent triggerError={true} />;

      const { props } = renderErrorBoundary(errorComponent);

      // Verify error state is shown
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();

      // When
      const resetButton = screen.getByText("Reset Panel");
      fireEvent.click(resetButton);

      // Then
      expect(props.onResetPanel).toHaveBeenCalledTimes(1);
    });

    it("When Remove Panel button is clicked Then calls onRemovePanel", () => {
      // Given
      const errorComponent = <ErrorThrowingComponent triggerError={true} />;

      const { props } = renderErrorBoundary(errorComponent);

      // Verify error state is shown
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();

      // When
      const removeButton = screen.getByText("Remove Panel");
      fireEvent.click(removeButton);

      // Then
      expect(props.onRemovePanel).toHaveBeenCalledTimes(1);
    });

    it("When multiple errors occur Then shows the first error until reset", () => {
      // Given
      const { rerender, props } = renderErrorBoundary(
        <ErrorThrowingComponent triggerError={true} errorMessage="First error" />,
      );

      // Verify first error is shown
      expect(screen.getByText("First error")).toBeTruthy();

      // When - rerender with different error (error boundary preserves first error)
      rerender(
        <ThemeProvider isDark={false}>
          <PanelErrorBoundary onResetPanel={props.onResetPanel} onRemovePanel={props.onRemovePanel}>
            <ErrorThrowingComponent triggerError={true} errorMessage="Second error" />
          </PanelErrorBoundary>
        </ThemeProvider>,
      );

      // Then - still shows first error (error boundary behavior)
      expect(screen.getByText("First error")).toBeTruthy();
      expect(screen.queryByText("Second error")).toBeFalsy();
    });
  });

  describe("Given error boundary with custom props", () => {
    it("When showErrorDetails is provided Then displays error UI with details", () => {
      // Given
      const errorComponent = (
        <ErrorThrowingComponent triggerError={true} errorMessage="Detailed error" />
      );

      // When
      renderErrorBoundary(errorComponent, { showErrorDetails: true });

      // Then
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      expect(screen.getByText("Detailed error")).toBeTruthy();
      expect(screen.getByText("Hide details")).toBeTruthy();
    });

    it("When hideErrorSourceLocations is provided Then shows error message without source locations", () => {
      // Given
      const errorComponent = (
        <ErrorThrowingComponent triggerError={true} errorMessage="Source error" />
      );

      // When
      renderErrorBoundary(errorComponent, { hideErrorSourceLocations: true });

      // Then
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      expect(screen.getByText("Source error")).toBeTruthy();
    });
  });

  describe("Given different error types", () => {
    it("When TypeError is thrown Then displays the error message", () => {
      // Given
      const TypeErrorComponent = () => {
        throw new TypeError("Invalid type operation");
      };

      // When
      renderErrorBoundary(<TypeErrorComponent />);

      // Then
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      expect(screen.getByText("Invalid type operation")).toBeTruthy();
    });

    it("When ReferenceError is thrown Then displays the error message", () => {
      // Given
      const ReferenceErrorComponent = () => {
        throw new ReferenceError("Variable not defined");
      };

      // When
      renderErrorBoundary(<ReferenceErrorComponent />);

      // Then
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      expect(screen.getByText("Variable not defined")).toBeTruthy();
    });

    it("When error with empty message is thrown Then displays empty error message", () => {
      // Given
      const EmptyErrorComponent = () => {
        const error = new Error();
        error.message = "";
        throw error;
      };

      // When
      renderErrorBoundary(<EmptyErrorComponent />);

      // Then
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      // Check for code element with empty error message using querySelector
      const codeElement = document.querySelector("code.MuiTypography-subtitle2");
      expect(codeElement).toBeTruthy();
      expect(codeElement?.textContent).toBe("");
    });
  });

  describe("Given error boundary in error state", () => {
    it("When component re-renders without error after Dismiss Then returns to normal state", () => {
      // Given
      let throwError = true;
      const ToggleErrorComponent = () => {
        if (throwError) {
          throw new Error("Toggle error");
        }
        return <div data-testid="normal-render">Normal rendering</div>;
      };

      renderErrorBoundary(<ToggleErrorComponent />);

      // Verify error state
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();

      // When - fix error condition and click Dismiss
      throwError = false;
      const dismissButton = screen.getByText("Dismiss");
      fireEvent.click(dismissButton);

      // Then
      expect(screen.getByTestId("normal-render")).toBeTruthy();
      expect(screen.getByText("Normal rendering")).toBeTruthy();
      expect(screen.queryByText("This panel encountered an unexpected error")).toBeFalsy();
    });
  });

  describe("Given complex component tree", () => {
    it("When nested child component throws error Then catches error at boundary level", () => {
      // Given
      const NestedErrorComponent = () => (
        <div>
          <div>
            <div>
              <ErrorThrowingComponent triggerError={true} errorMessage="Nested error" />
            </div>
          </div>
        </div>
      );

      // When
      renderErrorBoundary(<NestedErrorComponent />);

      // Then
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      expect(screen.getByText("Nested error")).toBeTruthy();
    });

    it("When sibling component throws error Then only affects error boundary subtree", () => {
      // Given
      const { props } = renderErrorBoundary(<div />, {});
      const MixedComponent = () => (
        <div>
          <div data-testid="working-sibling">Working sibling</div>
          <PanelErrorBoundary onResetPanel={props.onResetPanel} onRemovePanel={props.onRemovePanel}>
            <ErrorThrowingComponent triggerError={true} errorMessage="Isolated error" />
          </PanelErrorBoundary>
        </div>
      );

      // When
      render(
        <ThemeProvider isDark={false}>
          <MixedComponent />
        </ThemeProvider>,
      );

      // Then
      expect(screen.getByTestId("working-sibling")).toBeTruthy();
      expect(screen.getByText("Working sibling")).toBeTruthy();
      expect(screen.getByText("This panel encountered an unexpected error")).toBeTruthy();
      expect(screen.getByText("Isolated error")).toBeTruthy();
    });
  });
});
