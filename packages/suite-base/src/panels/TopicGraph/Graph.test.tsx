// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";

import GraphBuilder from "@lichtblick/suite-base/testing/builders/GraphBuilder";

import Graph from "./Graph";

// Variables starting with "mock" can be used inside vi.mock factory due to babel-vi hoisting rules
const mockRun = vi.fn();
const mockMakeLayout = vi.fn(() => ({ run: mockRun }));
const mockElementsObj = {
  remove: vi.fn(),
  makeLayout: mockMakeLayout,
};
const mockOn = vi.fn();
const mockBatch = vi.fn((fn: () => void) => {
  fn();
});
const mockElementsFn = vi.fn(() => mockElementsObj);
const mockAdd = vi.fn();
const mockSetStyle = vi.fn();
const mockFit = vi.fn();
const mockDestroy = vi.fn();
const mockCyInstance = {
  on: mockOn,
  batch: mockBatch,
  elements: mockElementsFn,
  add: mockAdd,
  style: mockSetStyle,
  fit: mockFit,
  destroy: mockDestroy,
};

vi.mock("cytoscape", async () => ({
  default: Object.assign(
    vi.fn(() => mockCyInstance),
    {
      use: vi.fn(),
      warnings: vi.fn(),
    },
  ),
}));

vi.mock("cytoscape-dagre", async () => ({ default: {} }));

describe("Graph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
