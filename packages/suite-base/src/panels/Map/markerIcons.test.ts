/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ORIENTED_MARKER_SIZE } from "@lichtblick/suite-base/panels/Map/constants";
import {
  createOrientedIcon,
  orientedMarkerSvg,
} from "@lichtblick/suite-base/panels/Map/markerIcons";

describe("orientedMarkerSvg", () => {
  it.each(["arrow", "vehicle"] as const)("renders the %s shape", (style) => {
    const svg = orientedMarkerSvg(style, "#ff0000", 0);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
    expect(svg).toContain('fill="#ff0000"');
  });

  it("rotates by the given heading", () => {
    expect(orientedMarkerSvg("arrow", "#000000", 90)).toContain("rotate(90 12 12)");
  });

  it("draws the vehicle with glazing, so its facing is readable", () => {
    const svg = orientedMarkerSvg("vehicle", "#ff0000", 0);
    // Body, plus one path carrying both windows.
    expect(svg.match(/<path/g)).toHaveLength(2);
    // The windows are not tinted with the body colour, or they would vanish into it.
    expect(svg.match(/fill="#ff0000"/g)).toHaveLength(1);
  });

  it("outlines only the body, leaving the glazing flat", () => {
    const svg = orientedMarkerSvg("vehicle", "#ff0000", 0);
    expect(svg.match(/stroke=/g)).toHaveLength(1);
  });

  it("draws the arrow as a single shape", () => {
    expect(orientedMarkerSvg("arrow", "#ff0000", 0).match(/<path/g)).toHaveLength(1);
  });

  it("produces different geometry for each style", () => {
    const arrow = orientedMarkerSvg("arrow", "#000000", 0);
    const vehicle = orientedMarkerSvg("vehicle", "#000000", 0);
    expect(arrow).not.toEqual(vehicle);
  });

  it("falls back to no rotation for a non-finite heading", () => {
    expect(orientedMarkerSvg("arrow", "#000000", NaN)).toContain("rotate(0 12 12)");
  });

  it("is hidden from assistive technology, since the marker conveys no text", () => {
    expect(orientedMarkerSvg("arrow", "#000000", 0)).toContain('aria-hidden="true"');
  });
});

describe("createOrientedIcon", () => {
  it("anchors the icon at its centre so it sits on the fix", () => {
    const icon = createOrientedIcon("vehicle", "#00ff00", 45);
    const half = ORIENTED_MARKER_SIZE / 2;
    expect(icon.options.iconSize).toEqual([ORIENTED_MARKER_SIZE, ORIENTED_MARKER_SIZE]);
    expect(icon.options.iconAnchor).toEqual([half, half]);
  });

  it("clears the default class so Leaflet draws no box around the shape", () => {
    expect(createOrientedIcon("arrow", "#00ff00", 0).options.className).toBe("");
  });

  it("carries the rotated markup", () => {
    const { html } = createOrientedIcon("arrow", "#00ff00", 135).options;
    expect(html).toContain("rotate(135 12 12)");
  });
});
