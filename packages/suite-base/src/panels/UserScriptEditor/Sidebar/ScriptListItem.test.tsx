/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent, { UserEvent } from "@testing-library/user-event";

import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import { ScriptListItem } from "./ScriptListItem";

type Props = React.ComponentProps<typeof ScriptListItem>;

function renderScriptListItem(props: Partial<Props> = {}) {
  const onClick = props.onClick ?? jest.fn();
  const onDelete = props.onDelete ?? jest.fn();
  const onRename = props.onRename ?? jest.fn();
  const title = props.title ?? BasicBuilder.string();

  render(
    <ThemeProvider isDark={false}>
      <ScriptListItem
        onClick={onClick}
        onDelete={onDelete}
        onRename={onRename}
        title={title}
        selected={props.selected}
        readOnly={props.readOnly}
      />
    </ThemeProvider>,
  );

  return { onClick, onDelete, onRename, title };
}

describe("ScriptListItem", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should render the title", () => {
    // Given
    const title = BasicBuilder.string();

    // When
    renderScriptListItem({ title });

    // Then
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("should call onClick when the item is clicked", () => {
    // Given
    const { onClick, title } = renderScriptListItem();

    // When
    fireEvent.click(screen.getByText(title));

    // Then
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should call onDelete when the delete button is clicked", () => {
    // Given
    const { onDelete } = renderScriptListItem();

    // When
    fireEvent.click(screen.getByTitle("Delete"));

    // Then
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("should enter edit mode when the rename button is clicked", () => {
    // Given
    renderScriptListItem();

    // When
    fireEvent.click(screen.getByTitle("Rename"));

    // Then
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("should enter edit mode when the item is double clicked", () => {
    // Given
    const { title } = renderScriptListItem();

    // When
    fireEvent.doubleClick(screen.getByText(title));

    // Then
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("should enter edit mode when Enter is pressed on the item button", () => {
    // Given
    const { title } = renderScriptListItem();

    // When
    fireEvent.keyDown(screen.getByText(title), { key: "Enter" });

    // Then
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("should call onRename with the new value when Enter is pressed in edit mode", () => {
    // Given
    const newName = BasicBuilder.string();
    const { onRename } = renderScriptListItem();
    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByRole("textbox");

    // When
    fireEvent.change(input, { target: { value: newName } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Then
    expect(onRename).toHaveBeenCalledWith(newName);
  });

  it("should reset the label and exit edit mode without renaming when Escape is pressed", () => {
    // Given
    const { onRename, title } = renderScriptListItem();
    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByRole("textbox");

    // When
    fireEvent.change(input, { target: { value: BasicBuilder.string() } });
    fireEvent.keyDown(input, { key: "Escape" });

    // Then
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("should not rename when Enter is pressed while the label is empty", () => {
    // Given
    const { onRename } = renderScriptListItem();
    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByRole("textbox");

    // When
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Then
    expect(onRename).not.toHaveBeenCalled();
  });

  it("should keep edit mode and not rename when a non-action key is pressed", () => {
    // Given
    const newName = BasicBuilder.string();
    const { onRename } = renderScriptListItem();
    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByRole("textbox");

    // When
    fireEvent.change(input, { target: { value: newName } });
    fireEvent.keyDown(input, { key: "a" });

    // Then
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("should not enter edit mode when a non-Enter key is pressed on the item button", () => {
    // Given
    const { title } = renderScriptListItem();

    // When
    fireEvent.keyDown(screen.getByText(title), { key: "ArrowDown" });

    // Then
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("should call onRename when the input loses focus", () => {
    // Given
    const newName = BasicBuilder.string();
    const { onRename } = renderScriptListItem();
    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByRole("textbox");

    // When
    fireEvent.change(input, { target: { value: newName } });
    fireEvent.blur(input);

    // Then
    expect(onRename).toHaveBeenCalledWith(newName);
  });

  it("should not rename on blur when the label is empty", () => {
    // Given
    const { onRename } = renderScriptListItem();
    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByRole("textbox");

    // When
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    // Then
    expect(onRename).not.toHaveBeenCalled();
  });

  it("should select the input content when it gains focus", () => {
    // Given
    renderScriptListItem();
    fireEvent.click(screen.getByTitle("Rename"));
    const input = screen.getByRole<HTMLInputElement>("textbox");
    const selectSpy = jest.spyOn(input, "select");

    // When
    fireEvent.focus(input);

    // Then
    expect(selectSpy).toHaveBeenCalled();
  });

  it("should show the delete button", () => {
    // Given
    renderScriptListItem();

    // Then
    expect(screen.getByTitle("Delete")).toBeEnabled();
  });

  it("should show the rename button", () => {
    // Given
    renderScriptListItem();

    // Then
    expect(screen.getByTitle("Rename")).toBeEnabled();
  });

  it("should not show the lock icon", () => {
    // Given
    renderScriptListItem();

    // Then
    expect(screen.queryByTestId("lock-icon")).not.toBeInTheDocument();
  });


  describe("readOnly=true", () => {
    it("should show the lock icon", () => {
      // Given
      renderScriptListItem({ readOnly: true });

      // Then
      expect(screen.getByTestId("lock-icon")).toBeVisible();
    });

    it("should render the script title", () => {
      // Given
      const title = BasicBuilder.string();

      // When
      renderScriptListItem({ readOnly: true, title });

      // Then
      expect(screen.getByText(title)).toBeEnabled();
    });

    it("should not show the delete button", () => {
      // Given
      renderScriptListItem({ readOnly: true });

      // Then
      expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
    });

    it("should not show the rename button", () => {
      // Given
      renderScriptListItem({ readOnly: true });

      // Then
      expect(screen.queryByTitle("Rename")).not.toBeInTheDocument();
    });

    it("should not enter edit mode on double-click", async () => {
      // Given
      const { title } = renderScriptListItem({ readOnly: true });

      // When
      fireEvent.doubleClick(screen.getByText(title));

      // Then
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should not enter edit mode when Enter key is pressed", async () => {
      // Given
      const { title } = renderScriptListItem({ readOnly: true });

      // When
      fireEvent.keyDown(screen.getByText(title), { key: "Enter" });

      // Then
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should still call onClick when the list item is clicked", async () => {
      // Given
      const { onClick, title } = renderScriptListItem({ readOnly: true });

      // When
      fireEvent.click(screen.getByText(title));

      // Then
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
