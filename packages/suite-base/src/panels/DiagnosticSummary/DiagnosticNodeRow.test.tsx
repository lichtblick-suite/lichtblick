/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import DiagnosticNodeRow from "@lichtblick/suite-base/panels/DiagnosticSummary/DiagnosticNodeRow";
import { NodeRowProps } from "@lichtblick/suite-base/panels/DiagnosticSummary/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import DiagnosticsBuilder from "@lichtblick/suite-base/testing/builders/DiagnosticsBuilder";

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

describe("DiagnosticNodeRow", () => {
  let info: ReturnType<typeof DiagnosticsBuilder.info>;
  let isPinned: boolean;
  let onClick: jest.Mock;
  let onClickPin: jest.Mock;
  let mockProps: NodeRowProps;

  beforeEach(() => {
    info = DiagnosticsBuilder.info();
    isPinned = BasicBuilder.boolean();
    onClick = jest.fn();
    onClickPin = jest.fn();

    mockProps = { info, isPinned, onClick, onClickPin };
  });

  it("renders diagnostic node row and triggers onClick", () => {
    const displayName = info.displayName;

    render(<DiagnosticNodeRow {...mockProps} />);
    const rowButton = screen.getByTestId("diagnostic-row-button");
    fireEvent.click(rowButton);

    expect(screen.getByText(displayName)).toBeInTheDocument();
    expect(onClick).toHaveBeenCalledWith(info);
  });

  it("triggers onClickPin when pin button is clicked", () => {
    render(<DiagnosticNodeRow {...mockProps} />);

    const pinButton = screen.getByTestId("diagnostic-row-icon");
    fireEvent.click(pinButton);

    expect(onClickPin).toHaveBeenCalledWith(info);
  });
});
