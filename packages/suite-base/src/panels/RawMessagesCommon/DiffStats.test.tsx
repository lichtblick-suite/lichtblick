/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { diffLabels, DiffObject } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import DiffStats from "./DiffStats";

jest.mock("./index.style", () => ({
  useStylesDiffStats: () => ({
    classes: {
      diff: "mock-diff-class",
      badge: "mock-badge-class",
      changeIndicator: "mock-change-indicator-class",
    },
  }),
}));

jest.mock("./utils", () => ({
  getChangeCounts: jest.fn(),
}));

const mockGetChangeCounts = jest.requireMock("./utils").getChangeCounts;

describe("DiffStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("without ID label", () => {
    it("renders added count when items are added", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.ADDED.labelText]: { field1: BasicBuilder.string() },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 1,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      render(<DiffStats data={data} itemType="Item" />);

      // THEN
      expect(screen.getByText("+1")).toBeInTheDocument();
    });

    it("renders deleted count when items are deleted", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.DELETED.labelText]: { field1: "value1" },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 1,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      render(<DiffStats data={data} itemType="Item" />);

      // THEN
      expect(screen.getByText("-1")).toBeInTheDocument();
    });

    it("renders both added and deleted counts", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.ADDED.labelText]: { field1: BasicBuilder.string() },
        [diffLabels.DELETED.labelText]: { field2: BasicBuilder.string() },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 2,
        [diffLabels.DELETED.labelText]: 3,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      render(<DiffStats data={data} itemType="Item" />);

      // THEN
      expect(screen.getByText("+2")).toBeInTheDocument();
      expect(screen.getByText("-3")).toBeInTheDocument();
    });

    it("renders change indicator when items are changed", () => {
      // GIVEN
      const oldText = BasicBuilder.string();
      const newText = BasicBuilder.string();
      const data: DiffObject = {
        [diffLabels.CHANGED.labelText]: `${oldText} => ${newText}`,
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 1,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Item" />);

      // THEN
      const changeIndicator = container.querySelector(".mock-change-indicator-class");
      expect(changeIndicator).toBeInTheDocument();
    });

    it("does not render badge when no additions or deletions", () => {
      // GIVEN
      const data: DiffObject = {};
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 1,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Item" />);

      // THEN
      const badge = container.querySelector(".mock-badge-class");
      expect(badge).not.toBeInTheDocument();
    });

    it("does not render change indicator when no changes", () => {
      // GIVEN
      const data: DiffObject = {};
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Item" />);

      // THEN
      const changeIndicator = container.querySelector(".mock-change-indicator-class");
      expect(changeIndicator).not.toBeInTheDocument();
    });
  });

  describe("with ID label", () => {
    const idValue = BasicBuilder.number();
    const nameValue = BasicBuilder.string();
    it("renders item type and id label when ID is present", () => {
      // GIVEN

      const data: DiffObject = {
        [diffLabels.ID.labelText]: { id: idValue },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Message" />);

      // THEN
      expect(container.textContent).toContain("Message");
      expect(container.textContent).toContain(`id: ${idValue}`);
    });

    it("renders multiple ID fields correctly", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.ID.labelText]: { id: idValue, name: nameValue },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Record" />);

      // THEN
      expect(container.textContent).toContain("Record");
      expect(container.textContent).toContain(`id: ${idValue}`);
      expect(container.textContent).toContain(`name: ${nameValue}`);
    });

    it("does not render item type when ID is not present", () => {
      // GIVEN
      const data: DiffObject = {};
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      render(<DiffStats data={data} itemType="Message" />);

      // THEN
      expect(screen.queryByText("Message")).not.toBeInTheDocument();
    });
  });

  describe("combined scenarios", () => {
    const uuidValue = BasicBuilder.string();
    const newFieldValue = BasicBuilder.string();
    const oldFieldValue = BasicBuilder.string();
    it("renders all diff types together", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.ID.labelText]: { uuid: uuidValue },
        [diffLabels.ADDED.labelText]: { newField: newFieldValue },
        [diffLabels.DELETED.labelText]: { oldField: oldFieldValue },
        [diffLabels.CHANGED.labelText]: `${oldFieldValue} => ${newFieldValue}`,
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 5,
        [diffLabels.DELETED.labelText]: 3,
        [diffLabels.CHANGED.labelText]: 2,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Object" />);

      // THEN
      expect(container.textContent).toContain("Object");
      expect(container.textContent).toContain(`uuid: ${uuidValue}`);
      expect(screen.getByText("+5")).toBeInTheDocument();
      expect(screen.getByText("-3")).toBeInTheDocument();
      const changeIndicator = container.querySelector(".mock-change-indicator-class");
      expect(changeIndicator).toBeInTheDocument();
    });

    it("handles itemType as ReactNode", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.ID.labelText]: { id: uuidValue },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });
      const CustomItemType = <span data-testid="custom-item">Custom Type</span>;

      // WHEN
      render(<DiffStats data={data} itemType={CustomItemType} />);

      // THEN
      expect(screen.getByTestId("custom-item")).toBeInTheDocument();
      expect(screen.getByText("Custom Type")).toBeInTheDocument();
    });

    it("only renders added count when deletions are zero", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.ADDED.labelText]: { field1: newFieldValue },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 4,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      render(<DiffStats data={data} itemType="Item" />);

      // THEN
      expect(screen.getByText("+4")).toBeInTheDocument();
      expect(screen.queryByText(/-\d+/)).not.toBeInTheDocument();
    });

    it("only renders deleted count when additions are zero", () => {
      // GIVEN
      const data: DiffObject = {
        [diffLabels.DELETED.labelText]: { field1: newFieldValue },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 7,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      render(<DiffStats data={data} itemType="Item" />);

      // THEN
      expect(screen.getByText("-7")).toBeInTheDocument();
      expect(screen.queryByText(/\+\d+/)).not.toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("handles empty data object", () => {
      // GIVEN
      const data: DiffObject = {};
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Empty" />);

      // THEN
      const diffDiv = container.querySelector(".mock-diff-class");
      expect(diffDiv).toBeInTheDocument();
      expect(diffDiv).toBeEmptyDOMElement();
    });

    it("handles ID with complex object value", () => {
      // GIVEN
      const timestampValue = BasicBuilder.bigInt();
      const sourceValue = BasicBuilder.string();
      const sequenceValue = BasicBuilder.number();
      const data: DiffObject = {
        [diffLabels.ID.labelText]: {
          timestamp: timestampValue,
          source: sourceValue,
          sequence: sequenceValue,
        },
      };
      mockGetChangeCounts.mockReturnValue({
        [diffLabels.ADDED.labelText]: 0,
        [diffLabels.DELETED.labelText]: 0,
        [diffLabels.CHANGED.labelText]: 0,
      });

      // WHEN
      const { container } = render(<DiffStats data={data} itemType="Event" />);

      // THEN
      expect(container.textContent).toContain("Event");
      expect(container.textContent).toContain(`timestamp: ${timestampValue}`);
      expect(container.textContent).toContain(`source: ${sourceValue}`);
      expect(container.textContent).toContain(`sequence: ${sequenceValue}`);
    });
  });
});
