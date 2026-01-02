/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import HoverableIconButton, {
  HoverableIconButtonProps,
} from "@lichtblick/suite-base/components/HoverableIconButton";
import { BasicBuilder } from "@lichtblick/test-builders";

function renderComponent(propsOverride: Partial<HoverableIconButtonProps> = {}) {
  const props: Partial<HoverableIconButtonProps> = {
    icon: <span data-testid="test-icon">{BasicBuilder.string()}</span>,
    title: BasicBuilder.string(),
    ...propsOverride,
  };
  return {
    ...render(
      <HoverableIconButton icon={props.icon} {...props}>
        {props.children}
      </HoverableIconButton>,
    ),
    props,
  };
}

describe("Given HoverableIconButton", () => {
  it("When rendered with icon only Then displays the icon", () => {
    renderComponent();

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  it("When rendered with icon and children Then displays both", () => {
    // Given
    const props: Partial<HoverableIconButtonProps> = {
      children: <span data-testid="test-text">{BasicBuilder.string()}</span>,
    };

    // When
    renderComponent(props);

    // Then
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.getByTestId("test-text")).toBeInTheDocument();
  });

  it("When iconPosition is 'start' Then icon appears first", () => {
    // Given
    const props: Partial<HoverableIconButtonProps> = {
      iconPosition: "start",
      children: <span data-testid="test-text">{BasicBuilder.string()}</span>,
    };

    // When
    const { container } = renderComponent(props);

    // Then
    const button = container.querySelector("button");
    const firstChild = button?.firstChild;
    expect(firstChild).toHaveAttribute("data-testid", "test-icon");
  });

  it("When iconPosition is 'end' Then icon appears last", () => {
    // Given
    const props: Partial<HoverableIconButtonProps> = {
      iconPosition: "end",
      children: <span data-testid="test-text">{BasicBuilder.string()}</span>,
    };
    // When
    const { container } = renderComponent(props);

    // Then
    const button = container.querySelector("button");
    const lastChild = button?.lastChild;
    expect(lastChild).toHaveAttribute("data-testid", "test-icon");
  });

  it("When hovered Then shows activeIcon", () => {
    // Given
    const props: Partial<HoverableIconButtonProps> = {
      activeIcon: <span data-testid="active-icon">{BasicBuilder.string()}</span>,
    };

    // When
    renderComponent(props);

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("active-icon")).not.toBeInTheDocument();

    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);

    // Then
    expect(screen.queryByTestId("test-icon")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-icon")).toBeInTheDocument();
  });

  it("When mouse leaves Then reverts to normal icon", () => {
    // Given
    const props: Partial<HoverableIconButtonProps> = {
      activeIcon: <span data-testid="active-icon">{BasicBuilder.string()}</span>,
    };

    // When
    renderComponent(props);

    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);
    expect(screen.getByTestId("active-icon")).toBeInTheDocument();

    // Then
    fireEvent.mouseLeave(button);
    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("active-icon")).not.toBeInTheDocument();
  });

  it("When disabled and hovered Then does not show activeIcon", () => {
    // Given
    const props: Partial<HoverableIconButtonProps> = {
      activeIcon: <span data-testid="active-icon">{BasicBuilder.string()}</span>,
      disabled: true,
    };

    // When
    renderComponent(props);

    // Then
    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("active-icon")).not.toBeInTheDocument();
  });

  it("When clicked Then calls onClick handler", () => {
    // Given
    const handleClick = jest.fn();

    const props: Partial<HoverableIconButtonProps> = {
      onClick: handleClick,
    };

    // When
    renderComponent(props);

    // Then
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
