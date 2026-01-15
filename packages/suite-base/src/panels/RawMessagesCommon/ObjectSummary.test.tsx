/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import AppConfigurationContext from "@lichtblick/suite-base/context/AppConfigurationContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import ObjectSummary from "./ObjectSummary";

function renderComponent(value: unknown) {
  const mockAppConfiguration = {
    get: (key: string) => {
      if (key === AppSetting.TIMEZONE) {
        return "UTC";
      }
      return undefined;
    },
    set: jest.fn(),
    addChangeListener: jest.fn(),
    removeChangeListener: jest.fn(),
  };

  return render(
    <AppConfigurationContext.Provider value={mockAppConfiguration}>
      <ObjectSummary value={value} />
    </AppConfigurationContext.Provider>,
  );
}

describe("Given ObjectSummary", () => {
  describe("When value is an array", () => {
    it("Then displays array summary with item count", () => {
      // Given
      const array = [BasicBuilder.string(), BasicBuilder.number(), BasicBuilder.string()];

      // When
      const { container } = renderComponent(array);

      // Then
      expect(container.textContent).toContain("items");
      expect(container.textContent).toContain(array.length.toString());
    });
  });

  describe("When value is an object", () => {
    it("Then displays object summary with key count", () => {
      // Given
      const object = {
        key1: BasicBuilder.string(),
        key2: BasicBuilder.number(),
        key3: BasicBuilder.string(),
      };

      // When
      const { container } = renderComponent(object);

      // Then
      expect(container.textContent).toContain("keys");
      expect(container.textContent).toContain(Object.keys(object).length.toString());
    });
  });

  describe("When value is a timestamp object", () => {
    it("Then displays formatted timestamp", () => {
      // Given
      const timestamp = { sec: 1234567890, nsec: 123456789 };

      // When
      const { container } = renderComponent(timestamp);

      // Then
      expect(container.textContent).toContain("2009");
    });
  });

  describe("When value is a 2D vector", () => {
    it("Then displays vector norm", () => {
      // Given
      const vector = { x: 3, y: 4 };

      // When
      const { container } = renderComponent(vector);

      // Then
      expect(container.textContent).toContain("norm");
      expect(container.textContent).toContain("5.00");
    });
  });

  describe("When value is not an object", () => {
    it("Then returns null for string", () => {
      // Given
      const value = BasicBuilder.string();

      // When
      const { container } = renderComponent(value);

      // Then
      expect(container).toBeEmptyDOMElement();
    });

    it("Then returns null for number", () => {
      // Given
      const value = BasicBuilder.number();

      // When
      const { container } = renderComponent(value);

      // Then
      expect(container).toBeEmptyDOMElement();
    });

    it("Then returns null for undefined", () => {
      // Given
      const value = undefined;

      // When
      const { container } = renderComponent(value);

      // Then
      expect(container).toBeEmptyDOMElement();
    });
  });
});
