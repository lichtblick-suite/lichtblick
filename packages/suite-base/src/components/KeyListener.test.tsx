/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render } from "@testing-library/react";

import { BasicBuilder } from "@lichtblick/test-builders";

import KeyListener, { KeyListenerProps } from "./KeyListener";

describe("KeyListener", () => {
  let mockHandler: jest.Mock;

  beforeEach(() => {
    mockHandler = jest.fn();
  });

  function setup(propsOverride: Partial<KeyListenerProps> = {}) {
    const props: KeyListenerProps = {
      ...propsOverride,
    };

    return {
      ...render(<KeyListener {...props} />),
    };
  }

  describe("keydown events", () => {
    it("should call handler when key is pressed", () => {
      // Given
      const key = "a";
      const keyDownHandlers = { [key]: mockHandler };
      setup({ global: true, keyDownHandlers });

      // When
      const event = new KeyboardEvent("keydown", { key });
      document.dispatchEvent(event);

      // Then
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it("should prevent default behavior by default", () => {
      // Given
      const key = "a";
      const keyDownHandlers = { [key]: mockHandler };
      setup({ global: true, keyDownHandlers });

      // When
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      document.dispatchEvent(event);

      // Then
      expect(event.defaultPrevented).toBe(true);
    });

    it("should not prevent default when handler returns false", () => {
      // Given
      const key = "a";
      mockHandler.mockReturnValue(false);
      const keyDownHandlers = { [key]: mockHandler };

      setup({ global: true, keyDownHandlers });

      // When
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      document.dispatchEvent(event);

      // Then
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe("keyup events", () => {
    it("should call handler when key is released", () => {
      // Given
      const key = "a";
      const keyUpHandlers = { [key]: mockHandler };
      setup({ global: true, keyUpHandlers });

      // When
      const event = new KeyboardEvent("keyup", { key });
      document.dispatchEvent(event);

      // Then
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("keypress events", () => {
    it("should call handler when key is pressed", () => {
      // Given
      const key = "a";
      const keyPressHandlers = { [key]: mockHandler };
      setup({ global: true, keyPressHandlers });

      // When
      const event = new KeyboardEvent("keypress", { key });
      document.dispatchEvent(event);

      // Then
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("editable element detection", () => {
    it("should ignore events from input elements", () => {
      // Given
      const key = BasicBuilder.string();
      const keyDownHandlers = { [key]: mockHandler };
      setup({ global: true, keyDownHandlers });
      const input = document.createElement("input");
      document.body.appendChild(input);

      // When
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      input.dispatchEvent(event);

      // Then
      expect(mockHandler).not.toHaveBeenCalled();
      input.remove();
    });

    it("should ignore events from textarea elements", () => {
      // Given
      const key = BasicBuilder.string();
      const keyDownHandlers = { [key]: mockHandler };
      setup({ global: true, keyDownHandlers });
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);

      // When
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      textarea.dispatchEvent(event);

      // Then
      expect(mockHandler).not.toHaveBeenCalled();
      textarea.remove();
    });

    it("should ignore events from contentEditable elements", () => {
      // Given
      const key = BasicBuilder.string();
      const keyDownHandlers = { [key]: mockHandler };
      setup({ global: true, keyDownHandlers });
      const div = document.createElement("div");
      div.contentEditable = "true";
      document.body.appendChild(div);

      // When
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      div.dispatchEvent(event);

      // Then
      expect(mockHandler).not.toHaveBeenCalled();
      div.remove();
    });

    it("should ignore events from monaco-editor elements", () => {
      // Given
      const key = BasicBuilder.string();
      const keyDownHandlers = { [key]: mockHandler };
      setup({ global: true, keyDownHandlers });
      const monacoEditor = document.createElement("div");
      monacoEditor.className = "monaco-editor";
      const innerElement = document.createElement("div");
      monacoEditor.appendChild(innerElement);
      document.body.appendChild(monacoEditor);

      // When
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      innerElement.dispatchEvent(event);

      // Then
      expect(mockHandler).not.toHaveBeenCalled();
      monacoEditor.remove();
    });
  });

  describe("global vs local mode", () => {
    it("should listen on document when global is true", () => {
      // Given
      const key = "a";
      const keyDownHandlers = { [key]: mockHandler };
      setup({ global: true, keyDownHandlers });

      // When
      const event = new KeyboardEvent("keydown", { key });
      document.dispatchEvent(event);

      // Then
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it("should listen on parent element when global is false", () => {
      // Given
      const key = "a";
      const keyDownHandlers = { [key]: mockHandler };
      const container = document.createElement("div");
      document.body.appendChild(container);
      render(<KeyListener keyDownHandlers={keyDownHandlers} />, { container });

      // When
      const event = new KeyboardEvent("keydown", { key, bubbles: true });
      container.dispatchEvent(event);

      // Then
      expect(mockHandler).toHaveBeenCalledTimes(1);
      container.remove();
    });
  });

  describe("multiple handlers", () => {
    it("should support multiple key handlers", () => {
      // Given
      const key1 = "a";
      const key2 = "b";
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const keyDownHandlers = { [key1]: handler1, [key2]: handler2 };
      setup({ global: true, keyDownHandlers });

      // When
      const event1 = new KeyboardEvent("keydown", { key: key1 });
      document.dispatchEvent(event1);
      const event2 = new KeyboardEvent("keydown", { key: key2 });
      document.dispatchEvent(event2);

      // Then
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should handle keydown and keyup handlers separately", () => {
      // Given
      const key = "a";
      const keyDownHandler = jest.fn();
      const keyUpHandler = jest.fn();
      setup({
        global: true,
        keyDownHandlers: { [key]: keyDownHandler },
        keyUpHandlers: { [key]: keyUpHandler },
      });

      // When
      const downEvent = new KeyboardEvent("keydown", { key });
      document.dispatchEvent(downEvent);
      const upEvent = new KeyboardEvent("keyup", { key });
      document.dispatchEvent(upEvent);

      // Then
      expect(keyDownHandler).toHaveBeenCalledTimes(1);
      expect(keyUpHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup", () => {
    it("should remove event listeners on unmount", () => {
      // Given
      const key = "a";
      const keyDownHandlers = { [key]: mockHandler };
      const { unmount } = setup({ global: true, keyDownHandlers });

      // When
      unmount();
      const event = new KeyboardEvent("keydown", { key });
      document.dispatchEvent(event);

      // Then
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});
