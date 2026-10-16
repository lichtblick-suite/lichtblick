/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MapRotationOverlay } from "@lichtblick/suite-base/panels/Map/MapRotationOverlay";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

function renderCompass(heading: number) {
  render(
    <ThemeProvider isDark={false}>
      <MapRotationOverlay heading={heading} />
    </ThemeProvider>,
  );
  return screen.getByTitle(/^Heading /);
}

describe("MapRotationOverlay", () => {
  it("reports the heading it was given", () => {
    expect(renderCompass(261)).toHaveAttribute("title", "Heading 261 degrees");
  });

  it("rounds the heading for display, since a bearing carries more precision than is useful", () => {
    expect(renderCompass(261.1666)).toHaveAttribute("title", "Heading 261 degrees");
  });

  it("passes the heading to the stylesheet as a variable", () => {
    // The rotation itself lives in the style file; only the angle comes from props.
    expect(renderCompass(90).style.getPropertyValue("--map-heading")).toBe("90deg");
  });

  it("is hidden from assistive technology, since it conveys no text", () => {
    renderCompass(0);
    expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
