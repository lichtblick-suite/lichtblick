/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, fireEvent } from "@testing-library/react";

import DirectionalPad from "@lichtblick/suite-base/panels/Teleop/DirectionalPad";
import { DirectionalPadAction } from "@lichtblick/suite-base/panels/Teleop/types";

describe("DirectionalPad", () => {
  it("should call onAction and update state when UP button is clicked", () => {
    // given
    const onAction = jest.fn();
    const { container } = render(<DirectionalPad onAction={onAction} />);
    const upButton = container.querySelector('g[role="button"]');

    // when
    fireEvent.mouseDown(upButton!);

    // then
    expect(onAction).toHaveBeenCalledWith(DirectionalPadAction.UP);
    expect(upButton?.parentElement?.querySelector(".active")).toBeTruthy();
  });

  it("should not call onAction when disabled", () => {
    // given
    const onAction = jest.fn();
    const { container } = render(<DirectionalPad onAction={onAction} disabled={true} />);
    const upButton = container.querySelector('g[role="button"]');

    // when
    fireEvent.mouseDown(upButton!);

    // then
    expect(onAction).not.toHaveBeenCalled();
    expect(upButton?.parentElement?.querySelector(".active")).toBeFalsy();
  });

  it("should handle case when onAction is not provided", () => {
    // given
    const { container } = render(<DirectionalPad />);
    const upButton = container.querySelector('g[role="button"]');

    // when
    fireEvent.mouseDown(upButton!);

    // then
    expect(upButton?.parentElement?.querySelector(".active")).toBeTruthy();
    // No error should be thrown
  });

  it("should update state for different directional actions", () => {
    // given
    const onAction = jest.fn();
    const { container } = render(<DirectionalPad onAction={onAction} />);
    const buttons = container.querySelectorAll('g[role="button"]');

    // when/then
    const actions = [
      DirectionalPadAction.UP,
      DirectionalPadAction.DOWN,
      DirectionalPadAction.LEFT,
      DirectionalPadAction.RIGHT,
    ];

    buttons.forEach((button, index) => {
      fireEvent.mouseDown(button);
      expect(onAction).toHaveBeenCalledWith(actions[index]);
      expect(button.parentElement?.querySelector(".active")).toBeTruthy();
      fireEvent.mouseUp(button);
    });
  });
});
