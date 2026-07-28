/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { UserScript, UserScripts } from "@lichtblick/suite-base/types/panels";
import { BasicBuilder } from "@lichtblick/test-builders";

import { ScriptsList } from "./ScriptsList";

type ScriptListItemProps = {
  title: string;
  selected?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
};

let mockRenameValue = "";

jest.mock("./ScriptListItem", () => ({
  ScriptListItem: ({ title, selected, onClick, onDelete, onRename }: ScriptListItemProps) => (
    <div data-testid="script-list-item" data-selected={String(selected)}>
      <span>{title}</span>
      <button data-testid={`select-${title}`} onClick={onClick} />
      <button data-testid={`delete-${title}`} onClick={onDelete} />
      <button
        data-testid={`rename-${title}`}
        onClick={() => {
          onRename(mockRenameValue);
        }}
      />
    </div>
  ),
}));

type Props = React.ComponentProps<typeof ScriptsList>;

function renderScriptsList(props: Partial<Props> = {}) {
  const scripts = props.scripts ?? LayoutBuilder.userScripts();
  const addNewScript = props.addNewScript ?? jest.fn();
  const selectScript = props.selectScript ?? jest.fn();
  const deleteScript = props.deleteScript ?? jest.fn();
  const onClose = props.onClose ?? jest.fn();
  const setUserScripts = props.setUserScripts ?? jest.fn();

  render(
    <ThemeProvider isDark={false}>
      <ScriptsList
        scripts={scripts}
        addNewScript={addNewScript}
        selectScript={selectScript}
        deleteScript={deleteScript}
        onClose={onClose}
        selectedScriptId={props.selectedScriptId}
        selectedScript={props.selectedScript}
        setUserScripts={setUserScripts}
      />
    </ThemeProvider>,
  );

  return { scripts, addNewScript, selectScript, deleteScript, onClose, setUserScripts };
}

describe("ScriptsList", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should render one item per script", () => {
    // Given
    const scripts = LayoutBuilder.userScripts(4);

    // When
    renderScriptsList({ scripts });

    // Then
    expect(screen.getAllByTestId("script-list-item")).toHaveLength(Object.keys(scripts).length);
  });

  it("should render the fallback title when a script has no name", () => {
    // Given
    const scriptId = BasicBuilder.string();
    const scripts = { [scriptId]: { sourceCode: BasicBuilder.string() } } as unknown as UserScripts;

    // When
    renderScriptsList({ scripts });

    // Then
    expect(screen.getByText("Untitled script")).toBeInTheDocument();
  });

  it("should call addNewScript when the New script button is clicked", () => {
    // Given
    const { addNewScript } = renderScriptsList();

    // When
    fireEvent.click(screen.getByRole("button", { name: "New script" }));

    // Then
    expect(addNewScript).toHaveBeenCalledTimes(1);
  });

  it("should call selectScript with the script id when an item is selected", () => {
    // Given
    const scriptId = BasicBuilder.string();
    const script = LayoutBuilder.userScript();
    const { selectScript } = renderScriptsList({ scripts: { [scriptId]: script } });

    // When
    fireEvent.click(screen.getByTestId(`select-${script.name}`));

    // Then
    expect(selectScript).toHaveBeenCalledWith(scriptId);
  });

  it("should call deleteScript with the script id when an item is deleted", () => {
    // Given
    const scriptId = BasicBuilder.string();
    const script = LayoutBuilder.userScript();
    const { deleteScript } = renderScriptsList({ scripts: { [scriptId]: script } });

    // When
    fireEvent.click(screen.getByTestId(`delete-${script.name}`));

    // Then
    expect(deleteScript).toHaveBeenCalledWith(scriptId);
  });

  it("should update the selected script when renaming with a selected script", () => {
    // Given
    const scriptId = BasicBuilder.string();
    const newName = BasicBuilder.string();
    const selectedScript: UserScript = LayoutBuilder.userScript();
    const scripts: UserScripts = { [scriptId]: selectedScript };
    mockRenameValue = newName;
    const { setUserScripts } = renderScriptsList({
      scripts,
      selectedScriptId: scriptId,
      selectedScript,
    });

    // When
    fireEvent.click(screen.getByTestId(`rename-${selectedScript.name}`));

    // Then
    expect(setUserScripts).toHaveBeenCalledWith({
      ...scripts,
      [scriptId]: { ...selectedScript, name: newName },
    });
  });

  it("should not update scripts when renaming without a selected script", () => {
    // Given
    const script = LayoutBuilder.userScript();
    const { setUserScripts } = renderScriptsList({
      scripts: { [BasicBuilder.string()]: script },
      selectedScriptId: undefined,
      selectedScript: undefined,
    });

    // When
    fireEvent.click(screen.getByTestId(`rename-${script.name}`));

    // Then
    expect(setUserScripts).not.toHaveBeenCalled();
  });
});
