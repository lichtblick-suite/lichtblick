/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import { Component, ReactNode } from "react";

import PanelErrorBoundary from "@lichtblick/suite-base/components/PanelErrorBoundary";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

// Mock reportError to avoid actual error reporting during tests
jest.mock("@lichtblick/suite-base/reportError", () => ({
  reportError: jest.fn(),
}));

// Component that throws an error when triggerError prop is true
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
      const onLogError = jest.fn();
      const workingComponent = <ErrorThrowingComponent triggerError={false} />;

      // When
      renderErrorBoundary(workingComponent, { onLogError });

      // Then
      expect(onLogError).not.toHaveBeenCalled();
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
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error: Test render error")).toBeTruthy();
      expect(screen.getByText("Check the panel logs for details.")).toBeTruthy();
    });

    it("When error is thrown Then displays action buttons", () => {
      // Given
      const errorComponent = <ErrorThrowingComponent triggerError={true} />;

      // When
      renderErrorBoundary(errorComponent);

      // Then
      expect(screen.getByText("Try Again")).toBeTruthy();
      expect(screen.getByText("Reset Panel")).toBeTruthy();
    });

    it("When error is thrown Then calls onLogError with error details", () => {
      // Given
      const onLogError = jest.fn();
      const errorMessage = "Custom error message";
      const errorComponent = (
        <ErrorThrowingComponent triggerError={true} errorMessage={errorMessage} />
      );

      // When
      renderErrorBoundary(errorComponent, { onLogError });

      // Then
      expect(onLogError).toHaveBeenCalledTimes(1);
      expect(onLogError).toHaveBeenCalledWith(
        `Panel render error: ${errorMessage}`,
        expect.any(Error),
      );
      expect(onLogError.mock.calls[0][1].message).toBe(errorMessage);
    });

    it("When onLogError is not provided Then does not throw", () => {
      // Given
      const errorComponent = <ErrorThrowingComponent triggerError={true} />;

      // When/Then - should not throw
      expect(() => {
        renderErrorBoundary(errorComponent, { onLogError: undefined });
      }).not.toThrow();

      // Should still show error UI
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
    });
  });

  describe("Given error boundary is displaying error state", () => {
    it("When Try Again button is clicked Then attempts to render children again", () => {
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
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();

      // When
      shouldThrowError = false; // Fix the error condition
      const tryAgainButton = screen.getByText("Try Again");
      fireEvent.click(tryAgainButton);

      // Then
      expect(screen.getByTestId("recovered-component")).toBeTruthy();
      expect(screen.getByText("Component recovered")).toBeTruthy();
      expect(screen.queryByText("Panel encountered a render error")).toBeFalsy();
    });

    it("When Reset Panel button is clicked Then calls onResetPanel and clears error", () => {
      // Given
      const onResetPanel = jest.fn();
      const errorComponent = <ErrorThrowingComponent triggerError={true} />;

      renderErrorBoundary(errorComponent, { onResetPanel });

      // Verify error state is shown
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();

      // When
      const resetButton = screen.getByText("Reset Panel");
      fireEvent.click(resetButton);

      // Then
      expect(onResetPanel).toHaveBeenCalledTimes(1);
    });

    it("When multiple errors occur Then shows the first error until reset", () => {
      // Given
      const { rerender } = renderErrorBoundary(
        <ErrorThrowingComponent triggerError={true} errorMessage="First error" />,
      );

      // Verify first error is shown
      expect(screen.getByText("Error: First error")).toBeTruthy();

      // When - rerender with different error (error boundary preserves first error)
      rerender(
        <ThemeProvider isDark={false}>
          <PanelErrorBoundary onResetPanel={jest.fn()} onRemovePanel={jest.fn()}>
            <ErrorThrowingComponent triggerError={true} errorMessage="Second error" />
          </PanelErrorBoundary>
        </ThemeProvider>,
      );

      // Then - still shows first error (error boundary behavior)
      expect(screen.getByText("Error: First error")).toBeTruthy();
      expect(screen.queryByText("Error: Second error")).toBeFalsy();
    });
  });

  describe("Given error boundary with custom props", () => {
    it("When showErrorDetails is provided Then still shows basic error UI", () => {
      // Given
      const errorComponent = (
        <ErrorThrowingComponent triggerError={true} errorMessage="Detailed error" />
      );

      // When
      renderErrorBoundary(errorComponent, { showErrorDetails: true });

      // Then
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error: Detailed error")).toBeTruthy();
    });

    it("When hideErrorSourceLocations is provided Then still shows error message", () => {
      // Given
      const errorComponent = (
        <ErrorThrowingComponent triggerError={true} errorMessage="Source error" />
      );

      // When
      renderErrorBoundary(errorComponent, { hideErrorSourceLocations: true });

      // Then
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error: Source error")).toBeTruthy();
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
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error: Invalid type operation")).toBeTruthy();
    });

    it("When ReferenceError is thrown Then displays the error message", () => {
      // Given
      const ReferenceErrorComponent = () => {
        throw new ReferenceError("Variable not defined");
      };

      // When
      renderErrorBoundary(<ReferenceErrorComponent />);

      // Then
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error: Variable not defined")).toBeTruthy();
    });

    it("When error with empty message is thrown Then displays generic error info", () => {
      // Given
      const EmptyErrorComponent = () => {
        const error = new Error();
        error.message = "";
        throw error;
      };

      // When
      renderErrorBoundary(<EmptyErrorComponent />);

      // Then
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error:")).toBeTruthy(); // Empty message case
    });
  });

  describe("Given error boundary in error state", () => {
    it("When component re-renders without error after Try Again Then returns to normal state", () => {
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
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();

      // When - fix error condition and click Try Again
      throwError = false;
      const tryAgainButton = screen.getByText("Try Again");
      fireEvent.click(tryAgainButton);

      // Then
      expect(screen.getByTestId("normal-render")).toBeTruthy();
      expect(screen.getByText("Normal rendering")).toBeTruthy();
      expect(screen.queryByText("Panel encountered a render error")).toBeFalsy();
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
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error: Nested error")).toBeTruthy();
    });

    it("When sibling component throws error Then only affects error boundary subtree", () => {
      // Given
      const MixedComponent = () => (
        <div>
          <div data-testid="working-sibling">Working sibling</div>
          <PanelErrorBoundary onResetPanel={jest.fn()} onRemovePanel={jest.fn()}>
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
      expect(screen.getByText("Panel encountered a render error")).toBeTruthy();
      expect(screen.getByText("Error: Isolated error")).toBeTruthy();
    });
  });
});
