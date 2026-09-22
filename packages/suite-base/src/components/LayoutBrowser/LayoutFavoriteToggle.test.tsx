/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import LayoutFavoriteToggle from "./LayoutFavoriteToggle";

describe("LayoutFavoriteToggle", () => {
  it("Given favorite=false, when rendered, then shows the outlined star and 'Add to favorites' label", () => {
    // GIVEN / WHEN
    render(<LayoutFavoriteToggle favorite={false} onToggle={jest.fn()} />);

    // THEN
    expect(screen.getByTestId("StarOutlineIcon")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-favorite-layout")).toHaveAttribute(
      "aria-label",
      "Add to favorites",
    );
    expect(screen.getByTestId("toggle-favorite-layout")).toHaveAttribute("aria-pressed", "false");
  });

  it("Given favorite=true, when rendered, then shows the filled star and 'Remove from favorites' label", () => {
    // GIVEN / WHEN
    render(<LayoutFavoriteToggle favorite={true} onToggle={jest.fn()} />);

    // THEN
    expect(screen.getByTestId("StarIcon")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-favorite-layout")).toHaveAttribute(
      "aria-label",
      "Remove from favorites",
    );
    expect(screen.getByTestId("toggle-favorite-layout")).toHaveAttribute("aria-pressed", "true");
  });

  it("Given the toggle, when clicked, then onToggle is called", () => {
    // GIVEN
    const onToggle = jest.fn();
    render(<LayoutFavoriteToggle favorite={false} onToggle={onToggle} />);

    // WHEN
    fireEvent.click(screen.getByTestId("toggle-favorite-layout"));

    // THEN
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
