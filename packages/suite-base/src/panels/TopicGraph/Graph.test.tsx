/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import GraphBuilder from "@lichtblick/suite-base/testing/builders/GraphBuilder";

import Graph from "./Graph";

// Variables starting with "mock" can be used inside jest.mock factory due to babel-jest hoisting rules
const mockRun = jest.fn();
const mockMakeLayout = jest.fn(() => ({ run: mockRun }));
const mockElementsObj = {
  remove: jest.fn(),
  makeLayout: mockMakeLayout,
};
const mockOn = jest.fn();
const mockBatch = jest.fn((fn: () => void) => {
  fn();
});
const mockElementsFn = jest.fn(() => mockElementsObj);
const mockAdd = jest.fn();
const mockSetStyle = jest.fn();
const mockFit = jest.fn();
const mockDestroy = jest.fn();
const mockCyInstance = {
  on: mockOn,
  batch: mockBatch,
  elements: mockElementsFn,
  add: mockAdd,
  style: mockSetStyle,
  fit: mockFit,
  destroy: mockDestroy,
};

jest.mock("cytoscape", () =>
  Object.assign(
    jest.fn(() => mockCyInstance),
    {
      use: jest.fn(),
      warnings: jest.fn(),
    },
  ),
);

jest.mock("cytoscape-dagre", () => ({}));

describe("Graph", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch.mockImplementation((fn: () => void) => {
      fn();
    });
    mockElementsFn.mockReturnValue(mockElementsObj);
    mockMakeLayout.mockReturnValue({ run: mockRun });
  });

  describe("when rendered", () => {
    it("renders a full-size container div", () => {
      // Given
      const props = GraphBuilder.props();

      // When
      const { container } = render(<Graph {...props} />);

      // Then
      expect(container.firstChild).toHaveStyle({ width: "100%", height: "100%" });
    });
  });

  describe("when mounted", () => {
    it("populates graphRef with fit and resetUserPanZoom functions", () => {
      // Given
      const props = GraphBuilder.props();

      // When
      render(<Graph {...props} />);

      // Then
      expect(props.graphRef.current?.fit).toBeInstanceOf(Function);
      expect(props.graphRef.current?.resetUserPanZoom).toBeInstanceOf(Function);
    });
  });

  describe("when elements are provided", () => {
    it("runs the dagre layout with the given elements", () => {
      // Given
      const elements = GraphBuilder.elements();
      const props = GraphBuilder.props({ elements });

      // When
      render(<Graph {...props} />);

      // Then
      expect(mockBatch).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("when style is provided", () => {
    it("applies the style to the cytoscape instance", () => {
      // Given
      const style = GraphBuilder.stylesheetStyles();
      const props = GraphBuilder.props({ style });

      // When
      render(<Graph {...props} />);

      // Then
      expect(mockSetStyle).toHaveBeenCalledWith(style);
    });
  });
});
