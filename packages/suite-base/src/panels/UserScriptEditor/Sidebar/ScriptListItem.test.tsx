/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent, { UserEvent } from "@testing-library/user-event";

import { ScriptListItem } from "./ScriptListItem";

describe("ScriptListItem", () => {
  let user: UserEvent;

  const defaultProps = {
    onClick: jest.fn(),
    onDelete: jest.fn(),
    onRename: jest.fn(),
    title: "myScript",
  };

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  describe("default (readOnly=false)", () => {
    it("should render the script title", () => {
      render(<ScriptListItem {...defaultProps} />);
      expect(screen.getByText("myScript")).toBeEnabled();
    });

    it("should show the delete button", () => {
      render(<ScriptListItem {...defaultProps} />);
      expect(screen.getByTitle("Delete")).toBeEnabled();
    });

    it("should show the rename button", () => {
      render(<ScriptListItem {...defaultProps} />);
      expect(screen.getByTitle("Rename")).toBeEnabled();
    });

    it("should not show the lock icon", () => {
      render(<ScriptListItem {...defaultProps} />);
      expect(screen.queryByTestId("lock-icon")).not.toBeInTheDocument();
    });

    it("should enter edit mode on double-click", async () => {
      render(<ScriptListItem {...defaultProps} />);
      const button = screen.getByRole("button", { name: /myScript/i });

      await user.dblClick(button);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe("myScript");
    });

    it("should enter edit mode when Enter key is pressed on the list item button", async () => {
      render(<ScriptListItem {...defaultProps} />);
      const button = screen.getByRole("button", { name: /myScript/i });

      await user.click(button);
      await user.keyboard("{Enter}");

      expect(screen.getByRole("textbox")).toBeEnabled();
    });

    it("should call onClick when the list item is clicked", async () => {
      render(<ScriptListItem {...defaultProps} />);
      const button = screen.getByRole("button", { name: /myScript/i });

      await user.click(button);

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
    });

    it("should call onDelete when the delete button is clicked", async () => {
      render(<ScriptListItem {...defaultProps} />);
      const deleteButton = screen.getByTitle("Delete");

      await user.click(deleteButton);

      expect(defaultProps.onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("readOnly=true", () => {
    const readOnlyProps = { ...defaultProps, readOnly: true };

    it("should show the lock icon", () => {
      render(<ScriptListItem {...readOnlyProps} />);
      expect(screen.getByTestId("lock-icon")).toBeVisible();
    });

    it("should render the script title", () => {
      render(<ScriptListItem {...readOnlyProps} />);
      expect(screen.getByText("myScript")).toBeEnabled();
    });

    it("should not show the delete button", () => {
      render(<ScriptListItem {...readOnlyProps} />);
      expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
    });

    it("should not show the rename button", () => {
      render(<ScriptListItem {...readOnlyProps} />);
      expect(screen.queryByTitle("Rename")).not.toBeInTheDocument();
    });

    it("should not enter edit mode on double-click", async () => {
      render(<ScriptListItem {...readOnlyProps} />);
      const button = screen.getByRole("button", { name: /myScript/i });

      await user.dblClick(button);

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should not enter edit mode when Enter key is pressed", async () => {
      render(<ScriptListItem {...readOnlyProps} />);
      const button = screen.getByRole("button", { name: /myScript/i });

      await user.click(button);
      await user.keyboard("{Enter}");

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should still call onClick when the list item is clicked", async () => {
      render(<ScriptListItem {...readOnlyProps} />);
      const button = screen.getByRole("button", { name: /myScript/i });

      await user.click(button);

      expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
    });
  });
});
