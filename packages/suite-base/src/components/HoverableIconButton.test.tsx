/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import HoverableIconButton from "@lichtblick/suite-base/components/HoverableIconButton";

describe("Given HoverableIconButton", () => {
  it("When rendered with icon only Then displays the icon", () => {
    render(
      <HoverableIconButton icon={<span data-testid="test-icon">Icon</span>} title="Test Button" />,
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("When rendered with icon and children Then displays both", () => {
    render(
      <HoverableIconButton icon={<span data-testid="test-icon">Icon</span>} title="Test Button">
        <span data-testid="test-text">Text</span>
      </HoverableIconButton>,
    );

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.getByTestId("test-text")).toBeInTheDocument();
  });

  it("When iconPosition is 'start' Then icon appears first", () => {
    const { container } = render(
      <HoverableIconButton
        icon={<span data-testid="test-icon">Icon</span>}
        iconPosition="start"
        title="Test Button"
      >
        <span data-testid="test-text">Text</span>
      </HoverableIconButton>,
    );

    const button = container.querySelector("button");
    const firstChild = button?.firstChild;
    expect(firstChild).toHaveAttribute("data-testid", "test-icon");
  });

  it("When iconPosition is 'end' Then icon appears last", () => {
    const { container } = render(
      <HoverableIconButton
        icon={<span data-testid="test-icon">Icon</span>}
        iconPosition="end"
        title="Test Button"
      >
        <span data-testid="test-text">Text</span>
      </HoverableIconButton>,
    );

    const button = container.querySelector("button");
    const lastChild = button?.lastChild;
    expect(lastChild).toHaveAttribute("data-testid", "test-icon");
  });

  it("When hovered Then shows activeIcon", () => {
    render(
      <HoverableIconButton
        icon={<span data-testid="normal-icon">Normal</span>}
        activeIcon={<span data-testid="active-icon">Active</span>}
        title="Test Button"
      />,
    );

    expect(screen.getByTestId("normal-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("active-icon")).not.toBeInTheDocument();

    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);

    expect(screen.queryByTestId("normal-icon")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-icon")).toBeInTheDocument();
  });

  it("When mouse leaves Then reverts to normal icon", () => {
    render(
      <HoverableIconButton
        icon={<span data-testid="normal-icon">Normal</span>}
        activeIcon={<span data-testid="active-icon">Active</span>}
        title="Test Button"
      />,
    );

    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);
    expect(screen.getByTestId("active-icon")).toBeInTheDocument();

    fireEvent.mouseLeave(button);
    expect(screen.getByTestId("normal-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("active-icon")).not.toBeInTheDocument();
  });

  it("When disabled and hovered Then does not show activeIcon", () => {
    render(
      <HoverableIconButton
        icon={<span data-testid="normal-icon">Normal</span>}
        activeIcon={<span data-testid="active-icon">Active</span>}
        disabled
        title="Test Button"
      />,
    );

    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);

    expect(screen.getByTestId("normal-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("active-icon")).not.toBeInTheDocument();
  });

  it("When clicked Then calls onClick handler", () => {
    const handleClick = jest.fn();
    render(
      <HoverableIconButton
        icon={<span data-testid="test-icon">Icon</span>}
        onClick={handleClick}
        title="Test Button"
      />,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
