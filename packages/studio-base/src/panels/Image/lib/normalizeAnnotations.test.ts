// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ImageAnnotations as FoxgloveImageAnnotations,
  PointsAnnotationType,
} from "@foxglove/schemas";

import { normalizeAnnotations } from "./normalizeAnnotations";

describe("normalizeAnnotations", () => {
  it("handles circle", () => {
    const input: Partial<FoxgloveImageAnnotations> = {
      circles: [
        {
          timestamp: { sec: 0, nsec: 1 },
          position: { x: 1, y: 2 },
          diameter: 3,
          thickness: 4,
          fill_color: { r: 0.5, g: 0.6, b: 0.7, a: 0.8 },
          outline_color: { r: 0.7, g: 0.8, b: 0.9, a: 1.0 },
        },
      ],
    };
    expect(normalizeAnnotations(input, "foxglove.ImageAnnotations")).toMatchInlineSnapshot(`
      [
        {
          "fillColor": {
            "a": 0.8,
            "b": 0.7,
            "g": 0.6,
            "r": 0.5,
          },
          "outlineColor": {
            "a": 1,
            "b": 0.9,
            "g": 0.8,
            "r": 0.7,
          },
          "position": {
            "x": 1,
            "y": 2,
          },
          "radius": 1.5,
          "stamp": {
            "nsec": 1,
            "sec": 0,
          },
          "thickness": 4,
          "type": "circle",
        },
      ]
    `);
  });

  it("handles points", () => {
    const input: Partial<FoxgloveImageAnnotations> = {
      points: [
        {
          timestamp: { sec: 0, nsec: 1 },
          type: PointsAnnotationType.LINE_STRIP,
          points: [
            { x: 0, y: 1 },
            { x: 2, y: 3 },
          ],
          outline_color: { r: 0.7, g: 0.8, b: 0.9, a: 1.0 },
          outline_colors: [{ r: 0.1, g: 0.2, b: 0.3, a: 0.4 }],
          fill_color: { r: 0.1, g: 0.2, b: 0.3, a: 0.4 },
          thickness: 9,
        },
      ],
    };
    expect(normalizeAnnotations(input, "foxglove.ImageAnnotations")).toMatchInlineSnapshot(`
      [
        {
          "fillColor": {
            "a": 0.4,
            "b": 0.3,
            "g": 0.2,
            "r": 0.1,
          },
          "outlineColor": {
            "a": 1,
            "b": 0.9,
            "g": 0.8,
            "r": 0.7,
          },
          "outlineColors": [
            {
              "a": 0.4,
              "b": 0.3,
              "g": 0.2,
              "r": 0.1,
            },
          ],
          "points": [
            {
              "x": 0,
              "y": 1,
            },
            {
              "x": 2,
              "y": 3,
            },
          ],
          "stamp": {
            "nsec": 1,
            "sec": 0,
          },
          "style": "line_strip",
          "thickness": 9,
          "type": "points",
        },
      ]
    `);
  });

  it("handles text", () => {
    const input: Partial<FoxgloveImageAnnotations> = {
      texts: [
        {
          timestamp: { sec: 0, nsec: 1 },
          position: { x: 1, y: 2 },
          text: "abc",
          font_size: 3,
          text_color: { r: 0.5, g: 0.6, b: 0.7, a: 0.8 },
          background_color: { r: 0.7, g: 0.8, b: 0.9, a: 1.0 },
        },
      ],
    };
    expect(normalizeAnnotations(input, "foxglove.ImageAnnotations")).toMatchInlineSnapshot(`
      [
        {
          "backgroundColor": {
            "a": 1,
            "b": 0.9,
            "g": 0.8,
            "r": 0.7,
          },
          "fontSize": 3,
          "padding": 1,
          "position": {
            "x": 1,
            "y": 2,
          },
          "stamp": {
            "nsec": 1,
            "sec": 0,
          },
          "text": "abc",
          "textColor": {
            "a": 0.8,
            "b": 0.7,
            "g": 0.6,
            "r": 0.5,
          },
          "type": "text",
        },
      ]
    `);
  });
});
