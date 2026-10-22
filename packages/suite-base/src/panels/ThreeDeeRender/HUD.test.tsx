/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";

import { render, screen } from "@testing-library/react";

import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import { HUD } from "./HUD";
import { HUDItem } from "./HUDItemManager";
import { IRenderer } from "./IRenderer";

function renderHUD(hudItems: HUDItem[]) {
  const renderer = {
    hudItems,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  } as unknown as IRenderer;
  return render(
    <ThemeProvider isDark={false}>
      <HUD renderer={renderer} />
    </ThemeProvider>,
  );
}

const notice: HUDItem = {
  id: "waiting",
  group: "map",
  displayType: "notice",
  getMessage: () => "Waiting for location",
};

describe("HUD attribution", () => {
  it("renders notices without an empty attribution container", () => {
    const { container } = renderHUD([notice]);
    expect(screen.getByText("Waiting for location")).toBeVisible();
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toContainElement(screen.getByText("Waiting for location"));
  });

  it("preserves linked and plain attribution alongside notices", () => {
    const { container } = renderHUD([
      notice,
      {
        id: "osm",
        group: "map",
        displayType: "attribution",
        getMessage: () => "OpenStreetMap contributors",
        href: "https://www.openstreetmap.org/copyright",
      },
      {
        id: "custom",
        group: "map",
        displayType: "attribution",
        getMessage: () => "Custom map credit",
      },
    ]);
    expect(container.children).toHaveLength(2);
    const link = screen.getByRole("link", { name: "OpenStreetMap contributors" });
    expect(link).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.lastElementChild).toContainElement(link);
    expect(container.lastElementChild).toContainElement(screen.getByText("Custom map credit"));
  });
});
