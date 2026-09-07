/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import { SidebarHeader } from "./SidebarHeader";

function renderSidebarHeader(props: Partial<React.ComponentProps<typeof SidebarHeader>> = {}) {
  const onClose = props.onClose ?? jest.fn();
  const title = props.title ?? BasicBuilder.string();

  render(
    <ThemeProvider isDark={false}>
      <SidebarHeader title={title} subheader={props.subheader} onClose={onClose} />
    </ThemeProvider>,
  );

  return { onClose, title };
}

describe("SidebarHeader", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("should render the title", () => {
    // Given
    const title = BasicBuilder.string();

    // When
    renderSidebarHeader({ title });

    // Then
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("should render the subheader when provided", () => {
    // Given
    const subheader = BasicBuilder.string();

    // When
    renderSidebarHeader({ subheader });

    // Then
    expect(screen.getByText(subheader)).toBeInTheDocument();
  });

  it("should call onClose when the collapse button is clicked", () => {
    // Given
    const { onClose } = renderSidebarHeader();

    // When
    fireEvent.click(screen.getByTitle("Collapse"));

    // Then
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
