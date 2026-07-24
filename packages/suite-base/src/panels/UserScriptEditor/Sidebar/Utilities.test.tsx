/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { getUserScriptProjectConfig } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/projectConfig";
import ScriptBuilder from "@lichtblick/suite-base/testing/builders/ScriptBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import { Utilities } from "./Utilities";

const GENERATED_TYPES_PATH = "/studio_script/generatedTypes.ts";

jest.mock(
  "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/projectConfig",
  () => ({
    getUserScriptProjectConfig: () => ({
      utilityFiles: [
        { fileName: "pointClouds.ts", filePath: "/studio_script/pointClouds.ts" },
        { fileName: "time.ts", filePath: "/studio_script/time.ts" },
      ],
    }),
  }),
);

const { utilityFiles } = getUserScriptProjectConfig();

function renderUtilities(props: Partial<React.ComponentProps<typeof Utilities>> = {}) {
  const onClose = props.onClose ?? jest.fn();
  const gotoUtils = props.gotoUtils ?? jest.fn();

  render(
    <ThemeProvider isDark={false}>
      <Utilities onClose={onClose} gotoUtils={gotoUtils} script={props.script} />
    </ThemeProvider>,
  );

  return { onClose, gotoUtils };
}

describe("Utilities", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should render each utility file name and the generated types entry", () => {
    // Given

    // When
    renderUtilities();

    // Then
    utilityFiles.forEach((utility) => {
      expect(screen.getByText(utility.fileName)).toBeInTheDocument();
    });
    expect(screen.getByText("generatedTypes.ts")).toBeInTheDocument();
  });

  it("should call gotoUtils with the file path when a utility is clicked", () => {
    // Given
    const { gotoUtils } = renderUtilities();

    // When
    fireEvent.click(screen.getByText(utilityFiles[0]!.fileName));

    // Then
    expect(gotoUtils).toHaveBeenCalledWith(utilityFiles[0]!.filePath, expect.anything());
  });

  it("should call gotoUtils with the generated types path when it is clicked", () => {
    // Given
    const { gotoUtils } = renderUtilities();

    // When
    fireEvent.click(screen.getByText("generatedTypes.ts"));

    // Then
    expect(gotoUtils).toHaveBeenCalledWith(GENERATED_TYPES_PATH, expect.anything());
  });

  it("should mark the utility as selected when it matches the current script", () => {
    // Given
    const script = ScriptBuilder.script({ filePath: utilityFiles[0]!.filePath });

    // When
    renderUtilities({ script });

    // Then
    expect(
      screen.getByText(utilityFiles[0]!.fileName).closest(".MuiListItemButton-root"),
    ).toHaveClass("Mui-selected");
  });

  it("should mark the generated types entry as selected when the script matches it", () => {
    // Given
    const script = ScriptBuilder.script({ filePath: GENERATED_TYPES_PATH });

    // When
    renderUtilities({ script });

    // Then
    expect(screen.getByText("generatedTypes.ts").closest(".MuiListItemButton-root")).toHaveClass(
      "Mui-selected",
    );
  });

  it("should call onClose when the collapse button is clicked", () => {
    // Given
    const { onClose } = renderUtilities();

    // When
    fireEvent.click(screen.getByTitle("Collapse"));

    // Then
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
