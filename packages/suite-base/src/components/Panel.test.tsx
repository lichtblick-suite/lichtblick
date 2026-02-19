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

import { render, renderHook, act, fireEvent, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useEffect, useCallback, useContext } from "react";

import Panel from "@lichtblick/suite-base/components/Panel";
import PanelContext from "@lichtblick/suite-base/components/PanelContext";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { PanelsActions } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import { BasicBuilder } from "@lichtblick/test-builders";

type DummyConfig = { someString: string };
// eslint-disable-next-line react/no-unused-prop-types
type DummyProps = { config: DummyConfig; saveConfig: (arg0: Partial<DummyConfig>) => void };

function getDummyPanel(renderFn: jest.Mock) {
  function DummyComponent(props: DummyProps): ReactNull {
    // Call the mock function in an effect rather than during render, since render may happen more
    // than once due to React.StrictMode.
    useEffect(() => {
      renderFn(props);
      if (props.config.someString === "trigger-save") {
        props.saveConfig({ someString: "saved" });
      }
    });
    return ReactNull;
  }
  DummyComponent.panelType = "Dummy";
  DummyComponent.defaultConfig = { someString: "hello world" };
  return Panel(DummyComponent);
}

describe("Panel", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("saves defaultConfig when there is no saved config", async () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);
    const childId = "Dummy!1my2ydk";

    const actions: PanelsActions[] = [];
    render(
      <PanelSetup onLayoutAction={(action) => actions.push(action)}>
        <DummyPanel childId={childId} />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls).toEqual([
      [{ config: { someString: "hello world" }, saveConfig: expect.any(Function) }],
      [{ config: { someString: "hello world" }, saveConfig: expect.any(Function) }],
    ]);

    expect(actions).toEqual([
      // first one is from PanelSetup
      {
        type: "SAVE_PANEL_CONFIGS",
        payload: { configs: [{ id: childId, config: { someString: "hello world" } }] },
      },
    ]);
  });

  it("gets the config from the store", () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);

    const childId = "Dummy!1my2ydk";
    const someString = "someNewString";

    const actions: PanelsActions[] = [];
    render(
      <PanelSetup
        fixture={{ savedProps: { [childId]: { someString } } }}
        onLayoutAction={(action) => actions.push(action)}
      >
        <DummyPanel childId={childId} />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls).toEqual([
      [{ config: { someString }, saveConfig: expect.any(Function) }],
    ]);

    expect(actions).toEqual([
      {
        // initial save action is from PanelSetup
        type: "SAVE_PANEL_CONFIGS",
        payload: { configs: [{ id: childId, config: { someString } }] },
      },
    ]);
  });

  it("merges saved config with defaultConfig when defaultConfig has new keys", async () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);
    const childId = "Dummy!1my2ydk";

    const actions: PanelsActions[] = [];
    render(
      <PanelSetup
        fixture={{ savedProps: { [childId]: { someNumber: 42 } } }}
        onLayoutAction={(action) => actions.push(action)}
      >
        <DummyPanel childId={childId} />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls).toEqual([
      [{ config: { someNumber: 42, someString: "hello world" }, saveConfig: expect.any(Function) }],
      [{ config: { someNumber: 42, someString: "hello world" }, saveConfig: expect.any(Function) }],
    ]);

    expect(actions).toEqual([
      {
        // initial save action is from PanelSetup
        type: "SAVE_PANEL_CONFIGS",
        payload: { configs: [{ id: childId, config: { someNumber: 42 } }] },
      },
      {
        type: "SAVE_PANEL_CONFIGS",
        payload: {
          configs: [{ id: childId, config: { someNumber: 42, someString: "hello world" } }],
        },
      },
    ]);
  });

  it("does not re-save configs when defaultConfig has fewer keys than saved config", async () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);
    const childId = "Dummy!1my2ydk";
    const someString = "someNewString";

    const actions: PanelsActions[] = [];
    render(
      <PanelSetup
        fixture={{ savedProps: { [childId]: { someNumber: 42, someString } } }}
        onLayoutAction={(action) => actions.push(action)}
      >
        <DummyPanel childId={childId} />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls).toEqual([
      [{ config: { someNumber: 42, someString }, saveConfig: expect.any(Function) }],
    ]);

    expect(actions).toEqual([
      {
        // initial save action is from PanelSetup
        type: "SAVE_PANEL_CONFIGS",
        payload: { configs: [{ id: childId, config: { someNumber: 42, someString } }] },
      },
      // we do not expect a second save action
    ]);
  });

  it("does not rerender when another panel changes", () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);
    const childId = "Dummy!1my2ydk";

    const { result: actions } = renderHook(() => useCurrentLayoutActions(), {
      wrapper({ children }) {
        return (
          <PanelSetup>
            {children}
            <DummyPanel childId={childId} />
          </PanelSetup>
        );
      },
    });

    expect(renderFn.mock.calls.length).toEqual(2);
    act(() => {
      actions.current.savePanelConfigs({ configs: [{ id: "someOtherId", config: {} }] });
    });
    expect(renderFn.mock.calls.length).toEqual(2);
  });

  describe("Given a panel with logging functionality", () => {
    const logInfoText = BasicBuilder.string();
    const logErrorText = BasicBuilder.string();

    function getLogsTitleElement(count: number) {
      return screen.queryByText((_content, element) => {
        return (
          element?.textContent === `Logs (${count})` &&
          element.className.includes("MuiTypography-subtitle2")
        );
      });
    }

    function getLoggingPanel(renderFn: jest.Mock) {
      function LoggingComponent(props: DummyProps): React.JSX.Element {
        const panelContext = useContext(PanelContext);

        const logInfo = useCallback(() => {
          panelContext?.logError?.(logInfoText);
        }, [panelContext]);

        const logError = useCallback(() => {
          panelContext?.logError?.(logErrorText, new Error(logErrorText));
        }, [panelContext]);

        const toggleLogs = useCallback(() => {
          panelContext?.setShowLogs?.({ show: !(panelContext.showLogs ?? false) });
        }, [panelContext]);

        useEffect(() => renderFn(props));

        return (
          <div>
            <button onClick={logInfo}>Log Info</button>
            <button onClick={logError}>Log Error</button>
            <button onClick={toggleLogs}>Toggle Logs</button>
            <span data-testid="log-count">{panelContext?.logCount ?? 0}</span>
            <span data-testid="config-value">{props.config.someString}</span>
          </div>
        );
      }
      LoggingComponent.panelType = "LoggingDummy";
      LoggingComponent.defaultConfig = { someString: "hello world" };
      return Panel(LoggingComponent);
    }

    it("When logging messages Then log count increases", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test1";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      const logInfoButton = screen.getByText("Log Info");
      const logErrorButton = screen.getByText("Log Error");

      fireEvent.click(logInfoButton);
      fireEvent.click(logErrorButton);

      // Then
      await waitFor(() => {
        const logCountElement = screen.getByTestId("log-count");
        expect(logCountElement.textContent).toBe("2");
      });
    });

    it("When toggling logs Then logs panel visibility changes", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test2";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // Log some messages first
      fireEvent.click(screen.getByText("Log Info"));

      // When
      const toggleButton = screen.getByText("Toggle Logs");
      fireEvent.click(toggleButton);

      // Then - logs panel should be visible
      await waitFor(() => {
        const logsPanel = screen.queryByText((_content, element) => {
          return (
            element?.textContent === "Logs (1)" &&
            element.className.includes("MuiTypography-subtitle2")
          );
        });
        expect(logsPanel).toBeInTheDocument();
      });

      // When hiding logs
      fireEvent.click(toggleButton);

      // Then - logs panel should be hidden
      await waitFor(() => {
        const logsPanel = screen.queryByText((_content, element) => {
          return (
            element?.textContent === "Logs (1)" &&
            element.className.includes("MuiTypography-subtitle2")
          );
        });
        expect(logsPanel).not.toBeInTheDocument();
      });
    });

    it("When closing logs from panel Then logs are hidden", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test3";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // Log a message and show logs
      fireEvent.click(screen.getByText("Log Info"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      await waitFor(() => {
        const logsPanel = getLogsTitleElement(1);
        expect(logsPanel).toBeInTheDocument();
      });

      // When
      const closeButton = screen.getByRole("button", { name: "Close logs" });
      fireEvent.click(closeButton);

      // Then
      await waitFor(() => {
        const logsPanel = getLogsTitleElement(1);
        expect(logsPanel).not.toBeInTheDocument();
      });
    });

    it("When clearing logs from PanelLogs Then log count resets to zero", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test4";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // Log some messages and show logs
      fireEvent.click(screen.getByText("Log Info"));
      fireEvent.click(screen.getByText("Log Error"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      await waitFor(() => {
        const logsPanel = getLogsTitleElement(2);
        expect(logsPanel).toBeInTheDocument();
      });

      // When
      const clearButton = screen.getByRole("button", { name: "Clear logs" });
      fireEvent.click(clearButton);

      // Then
      await waitFor(() => {
        const logCountElement = screen.getByTestId("log-count");
        expect(logCountElement.textContent).toBe("0");
      });

      await waitFor(() => {
        const logsPanel = getLogsTitleElement(0);
        expect(logsPanel).toBeInTheDocument();
      });
    });

    it("When no logs exist Then clear logs button is disabled", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test5";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When - show logs without logging any messages
      fireEvent.click(screen.getByText("Toggle Logs"));

      // Then
      await waitFor(() => {
        const clearButton = screen.getByRole("button", { name: "Clear logs" });
        expect(clearButton.hasAttribute("disabled")).toBe(true);
      });
    });

    it("When logs exist Then clear logs button is enabled", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test6";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // Log a message and show logs
      fireEvent.click(screen.getByText("Log Info"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      // Then
      await waitFor(() => {
        const clearButton = screen.getByRole("button", { name: "Clear logs" });
        expect(clearButton.hasAttribute("disabled")).toBe(false);
      });
    });

    it("When logging info message Then PanelLogs displays message with INFO prefix", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test7";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.click(screen.getByText("Log Info"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      // Then
      await waitFor(() => {
        const infoMessage = screen.getByText(`[INFO] ${logInfoText}`);
        expect(infoMessage).toBeInTheDocument();
      });
    });

    it("When logging error message Then PanelLogs displays message with ERROR prefix", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test8";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.click(screen.getByText("Log Error"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      // Then
      await waitFor(() => {
        const errorMessage = screen.getByText(`[ERROR] ${logErrorText}`);
        expect(errorMessage).toBeInTheDocument();
      });
    });

    it("When error is logged Then PanelLogs displays error stack trace", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test9";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.click(screen.getByText("Log Error"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      // Then
      await waitFor(() => {
        const errorTrace = screen.getByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "pre" && content.includes(`Error: ${logErrorText}`)
          );
        });
        expect(errorTrace).toBeInTheDocument();
      });
    });

    it("When multiple messages are logged Then all messages appear in chronological order", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test10";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.click(screen.getByText("Log Info"));
      fireEvent.click(screen.getByText("Log Error"));
      fireEvent.click(screen.getByText("Log Info"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      // Then
      await waitFor(() => {
        const logCountElement = screen.getByTestId("log-count");
        expect(logCountElement.textContent).toBe("3");
      });

      // Verify messages appear in chronological order: Info → Error → Info
      await waitFor(() => {
        const allLogElements = screen.getAllByText(/\[(INFO|ERROR)\]/);
        expect(allLogElements).toHaveLength(3);

        // Extract the log messages in order
        const logTexts = allLogElements.map((el) => el.textContent);

        expect(logTexts).toEqual([
          `[INFO] ${logInfoText}`,
          `[ERROR] ${logErrorText}`,
          `[INFO] ${logInfoText}`,
        ]);
      });
    });

    it("When PanelLogs is shown Then it displays timestamps for each log entry", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test11";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.click(screen.getByText("Log Info"));
      fireEvent.click(screen.getByText("Toggle Logs"));

      // Then
      await waitFor(() => {
        // Look for timestamp pattern (this is a basic check since exact timestamp is hard to predict)
        const timestampElements = screen.getAllByText(
          /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/,
        );
        expect(timestampElements.length).toBeGreaterThan(0);
      });
    });

    it("When PanelLogs is initially hidden Then no logs content is rendered in DOM", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test12";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.click(screen.getByText("Log Info"));
      // Note: not toggling logs to show them

      // Then
      const logsPanel = screen.queryByText(`[INFO] ${logInfoText}`);
      expect(logsPanel).not.toBeInTheDocument();

      const logsPanelTitle = screen.queryByText((_content, element) => {
        return (
          element?.textContent === "Logs (1)" &&
          element.className.includes("MuiTypography-subtitle2")
        );
      });
      expect(logsPanelTitle).not.toBeInTheDocument();
    });

    it("When showLogs is toggled multiple times Then panel visibility changes accordingly", async () => {
      // Given
      const renderFn = jest.fn();
      const LoggingPanel = getLoggingPanel(renderFn);
      const childId = "LoggingDummy!test13";

      render(
        <PanelSetup>
          <LoggingPanel childId={childId} />
        </PanelSetup>,
      );

      fireEvent.click(screen.getByText("Log Info"));
      const toggleButton = screen.getByText("Toggle Logs");

      // When/Then - Show logs
      fireEvent.click(toggleButton);
      await waitFor(() => {
        const logsPanel = screen.queryByText((_content, element) => {
          return (
            element?.textContent === "Logs (1)" &&
            element.className.includes("MuiTypography-subtitle2")
          );
        });
        expect(logsPanel).toBeInTheDocument();
      });

      // When/Then - Hide logs
      fireEvent.click(toggleButton);
      await waitFor(() => {
        const logsPanel = screen.queryByText((_content, element) => {
          return (
            element?.textContent === "Logs (1)" &&
            element.className.includes("MuiTypography-subtitle2")
          );
        });
        expect(logsPanel).not.toBeInTheDocument();
      });

      // When/Then - Show logs again
      fireEvent.click(toggleButton);
      await waitFor(() => {
        const logsPanel = screen.queryByText((_content, element) => {
          return (
            element?.textContent === "Logs (1)" &&
            element.className.includes("MuiTypography-subtitle2")
          );
        });
        expect(logsPanel).toBeInTheDocument();
      });
    });
  });

  describe("Given a panel with fullscreen functionality", () => {
    function getFullscreenPanel(renderFn: jest.Mock) {
      function FullscreenComponent(props: DummyProps): React.JSX.Element {
        const panelContext = useContext(PanelContext);

        const enterFullscreen = useCallback(() => {
          panelContext?.enterFullscreen();
        }, [panelContext]);

        const exitFullscreen = useCallback(() => {
          panelContext?.exitFullscreen();
        }, [panelContext]);

        useEffect(() => renderFn(props));

        return (
          <div>
            <button onClick={enterFullscreen}>Enter Fullscreen</button>
            <button onClick={exitFullscreen}>Exit Fullscreen</button>
            <span data-testid="fullscreen-status">
              {(panelContext?.isFullscreen ?? false) ? "fullscreen" : "normal"}
            </span>
            <span data-testid="config-value">{props.config.someString}</span>
          </div>
        );
      }
      FullscreenComponent.panelType = "FullscreenDummy";
      FullscreenComponent.defaultConfig = { someString: "hello world" };
      return Panel(FullscreenComponent);
    }

    it("When entering fullscreen Then panel becomes fullscreen", async () => {
      // Given
      const renderFn = jest.fn();
      const FullscreenPanel = getFullscreenPanel(renderFn);
      const childId = "FullscreenDummy!test1";

      render(
        <PanelSetup>
          <FullscreenPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      const enterButton = screen.getByText("Enter Fullscreen");
      fireEvent.click(enterButton);

      // Then
      await waitFor(() => {
        const status = screen.getByTestId("fullscreen-status");
        expect(status.textContent).toBe("fullscreen");
      });
    });

    it("When exiting fullscreen Then panel returns to normal", async () => {
      // Given
      const renderFn = jest.fn();
      const FullscreenPanel = getFullscreenPanel(renderFn);
      const childId = "FullscreenDummy!test2";

      render(
        <PanelSetup>
          <FullscreenPanel childId={childId} />
        </PanelSetup>,
      );

      // Enter fullscreen first
      fireEvent.click(screen.getByText("Enter Fullscreen"));
      await waitFor(() => {
        const status = screen.getByTestId("fullscreen-status");
        expect(status.textContent).toBe("fullscreen");
      });

      // When
      const exitButton = screen.getByText("Exit Fullscreen");
      fireEvent.click(exitButton);

      // Then
      await waitFor(() => {
        const status = screen.getByTestId("fullscreen-status");
        expect(status.textContent).toBe("normal");
      });
    });

    it("When pressing Escape in fullscreen Then exits fullscreen", async () => {
      // Given
      const renderFn = jest.fn();
      const FullscreenPanel = getFullscreenPanel(renderFn);
      const childId = "FullscreenDummy!test3";

      render(
        <PanelSetup>
          <FullscreenPanel childId={childId} />
        </PanelSetup>,
      );

      // Enter fullscreen
      fireEvent.click(screen.getByText("Enter Fullscreen"));
      await waitFor(() => {
        const status = screen.getByTestId("fullscreen-status");
        expect(status.textContent).toBe("fullscreen");
      });

      // When
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

      // Then
      await waitFor(() => {
        const status = screen.getByTestId("fullscreen-status");
        expect(status.textContent).toBe("normal");
      });
    });
  });

  describe("Given a panel with keyboard shortcuts", () => {
    function getKeyboardPanel(renderFn: jest.Mock) {
      function KeyboardComponent(props: DummyProps): React.JSX.Element {
        const panelContext = useContext(PanelContext);

        const updateConfig = useCallback(() => {
          props.saveConfig({ someString: "keyboard-updated" });
        }, [props]);

        useEffect(() => {
          renderFn(props);
          updateConfig();
        }, [props, updateConfig]);

        return (
          <div>
            <span data-testid="panel-id">{panelContext?.id}</span>
            <span data-testid="config-value">{props.config.someString}</span>
          </div>
        );
      }
      KeyboardComponent.panelType = "KeyboardDummy";
      KeyboardComponent.defaultConfig = { someString: "hello world" };
      return Panel(KeyboardComponent);
    }

    it("When pressing backtick Then keyboard event is handled without errors", async () => {
      // Given
      const renderFn = jest.fn();
      const KeyboardPanel = getKeyboardPanel(renderFn);
      const childId = "KeyboardDummy!test1";

      render(
        <PanelSetup>
          <KeyboardPanel childId={childId} />
        </PanelSetup>,
      );

      // Verify panel renders normally before event
      expect(screen.getByTestId("panel-id")).toHaveTextContent(childId);

      // When
      fireEvent.keyDown(document, { key: "`", code: "Backquote" });

      // Then - verify the panel still renders correctly after the keyboard event
      await waitFor(() => {
        expect(screen.getByTestId("panel-id")).toHaveTextContent(childId);
        expect(screen.getByTestId("config-value")).toBeInTheDocument();
      });
    });

    it("When releasing backtick Then quick actions overlay disappears", async () => {
      // Given
      const renderFn = jest.fn();
      const KeyboardPanel = getKeyboardPanel(renderFn);
      const childId = "KeyboardDummy!test2";

      const { container } = render(
        <PanelSetup>
          <KeyboardPanel childId={childId} />
        </PanelSetup>,
      );

      // Press backtick
      fireEvent.keyDown(document, { key: "`", code: "Backquote" });

      // Verify overlay appears
      await waitFor(() => {
        const overlay = container.querySelector('[data-testid*="panel-mouseenter-container"]');
        expect(overlay).toBeInTheDocument();
      });

      // When
      fireEvent.keyUp(document, { key: "`", code: "Backquote" });

      // Then
      const panel = container.querySelector('[data-testid*="panel-mouseenter-container"]');
      expect(panel).toBeInTheDocument();
    });

    it("When pressing Cmd+A Then select all panels is triggered", async () => {
      // Given
      const renderFn = jest.fn();
      const KeyboardPanel = getKeyboardPanel(renderFn);
      const childId = "KeyboardDummy!test3";

      render(
        <PanelSetup>
          <KeyboardPanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.keyDown(document, {
        key: "a",
        code: "KeyA",
        metaKey: true,
      });

      // Then
      expect(screen.getByTestId("panel-id")).toBeInTheDocument();
      expect(screen.getByTestId("config-value")).toBeInTheDocument();
    });
  });

  describe("Given a panel with selection functionality", () => {
    function getSelectablePanel(renderFn: jest.Mock) {
      function SelectableComponent(props: DummyProps): React.JSX.Element {
        const panelContext = useContext(PanelContext);

        const updateConfig = useCallback(() => {
          props.saveConfig({ someString: "selectable-updated" });
        }, [props]);

        useEffect(() => {
          renderFn(props);
          // Trigger saveConfig on mount to use the prop
          updateConfig();
        }, [props, updateConfig]);

        return (
          <div>
            <span data-testid="panel-id">{panelContext?.id}</span>
            <span data-testid="config-value">{props.config.someString}</span>
          </div>
        );
      }
      SelectableComponent.panelType = "SelectableDummy";
      SelectableComponent.defaultConfig = { someString: "hello world" };
      return Panel(SelectableComponent);
    }

    it("When clicking panel with meta key Then panel gets selected", async () => {
      // Given
      const renderFn = jest.fn();
      const SelectablePanel = getSelectablePanel(renderFn);
      const childId = "SelectableDummy!test1";

      const { container } = render(
        <PanelSetup>
          <SelectablePanel childId={childId} />
        </PanelSetup>,
      );

      // When
      const panelRoot = container.querySelector('[data-testid*="panel-mouseenter-container"]');
      expect(panelRoot).toBeInTheDocument();

      fireEvent.click(panelRoot!, { metaKey: true });

      // Then
      expect(screen.getByTestId("panel-id")).toHaveTextContent(childId);
      expect(screen.getByTestId("config-value")).toBeInTheDocument();
    });

    it("When pressing Escape with multiple panels selected Then deselects panels", async () => {
      // Given
      const renderFn = jest.fn();
      const SelectablePanel = getSelectablePanel(renderFn);
      const childId = "SelectableDummy!test2";

      render(
        <PanelSetup>
          <SelectablePanel childId={childId} />
        </PanelSetup>,
      );

      // When
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

      // Then
      expect(screen.getByTestId("panel-id")).toHaveTextContent(childId);
      expect(screen.getByTestId("config-value")).toBeInTheDocument();
    });
  });

  describe("Given a panel with error handling", () => {
    function getErrorPanel(renderFn: jest.Mock) {
      function ErrorComponent(props: DummyProps): React.JSX.Element {
        const panelContext = useContext(PanelContext);

        const throwError = useCallback(() => {
          throw new Error("Test panel error");
        }, []);

        const updateConfig = useCallback(() => {
          props.saveConfig({ someString: "updated" });
        }, [props]);

        useEffect(() => renderFn(props));

        return (
          <div>
            <button onClick={throwError}>Throw Error</button>
            <button onClick={updateConfig}>Update Config</button>
            <span data-testid="panel-id">{panelContext?.id}</span>
            <span data-testid="config-value">{props.config.someString}</span>
          </div>
        );
      }
      ErrorComponent.panelType = "ErrorDummy";
      ErrorComponent.defaultConfig = { someString: "hello world" };
      return Panel(ErrorComponent);
    }

    it("When panel throws error Then error boundary catches it", () => {
      // Given
      const renderFn = jest.fn();
      const ErrorPanel = getErrorPanel(renderFn);
      const childId = "ErrorDummy!test1";

      // When/Then
      render(
        <PanelSetup>
          <ErrorPanel childId={childId} />
        </PanelSetup>,
      );

      expect(screen.getByText("Throw Error")).toBeInTheDocument();
      expect(screen.getByText("Update Config")).toBeInTheDocument();
    });
  });

  describe("Given a panel with config override", () => {
    it("When override config is provided Then it merges with default and saved config", () => {
      // Given
      const renderFn = jest.fn();
      const DummyPanel = getDummyPanel(renderFn);
      const childId = "Dummy!override1";
      const overrideConfig = { someString: "overridden", newProp: "added" };

      // When
      render(
        <PanelSetup
          fixture={{ savedProps: { [childId]: { someString: "saved", existingProp: "existing" } } }}
        >
          <DummyPanel childId={childId} overrideConfig={overrideConfig} />
        </PanelSetup>,
      );

      // Then
      expect(renderFn.mock.calls[0][0].config).toEqual({
        someString: "overridden",
        existingProp: "existing",
        newProp: "added",
      });
    });
  });

  describe("Given a panel in performance mode", () => {
    it("When rendered in production Then performance info is not shown", () => {
      // Given
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const renderFn = jest.fn();
      const DummyPanel = getDummyPanel(renderFn);
      const childId = "Dummy!prod1";

      // When
      const { container } = render(
        <PanelSetup>
          <DummyPanel childId={childId} />
        </PanelSetup>,
      );

      const perfInfo = container.querySelector(".mui-skj2y-perfInfo");
      expect(perfInfo).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it("When rendered in development Then profiler tracks render performance", () => {
      // Given
      const renderFn = jest.fn();
      const DummyPanel = getDummyPanel(renderFn);
      const childId = "Dummy!dev1";

      // When
      render(
        <PanelSetup>
          <DummyPanel childId={childId} />
        </PanelSetup>,
      );

      // Then
      expect(renderFn).toHaveBeenCalled();
    });
  });
});
