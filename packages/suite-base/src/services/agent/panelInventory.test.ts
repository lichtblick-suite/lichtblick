// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { PanelInfo } from "@lichtblick/suite-base/context/PanelCatalogContext";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";

import { buildPanelInventory } from "./panelInventory";

function panel(
  info: Pick<PanelInfo, "description" | "title" | "type">,
): PanelInfo {
  return {
    ...info,
    module: jest.fn() as PanelInfo["module"],
  };
}

describe("buildPanelInventory", () => {
  it("merges built-in and extension panels with their source and schemas", () => {
    const extension = ExtensionBuilder.extensionInfo({
      description: "Extension fallback",
      qualifiedName: "Acme.Tools",
      panelsMeta: {
        Camera: {
          description: "Shows the robot camera feed.",
          schemas: ["sensor_msgs/Image", "sensor_msgs/CompressedImage"],
        },
      },
    });

    expect(
      buildPanelInventory(
        [
          panel({
            type: "Plot",
            title: "Plot",
            description: "Plots numeric values.",
          }),
          panel({
            type: "Acme.Tools.Camera",
            title: "Camera",
            description: "Catalog description",
          }),
        ],
        [extension],
      ),
    ).toEqual([
      {
        type: "Plot",
        title: "Plot",
        description: "Plots numeric values.",
        source: "builtin",
      },
      {
        type: "Acme.Tools.Camera",
        title: "Camera",
        description: "Shows the robot camera feed.",
        source: "extension",
        schemas: ["sensor_msgs/Image", "sensor_msgs/CompressedImage"],
      },
    ]);
  });

  it("falls back through catalog, extension, and generated descriptions", () => {
    const extension = ExtensionBuilder.extensionInfo({
      description: "Tools from Acme.",
      qualifiedName: "Acme.Tools",
    });

    expect(
      buildPanelInventory(
        [
          panel({
            type: "Acme.Tools.Status",
            title: "Status",
            description: "Shows status from the catalog.",
          }),
          panel({
            type: "Acme.Tools.Logs",
            title: "Logs",
            description: undefined,
          }),
          panel({ type: "Unknown", title: "Unknown", description: undefined }),
        ],
        [extension],
      ).map((entry) => entry.description),
    ).toEqual([
      "Shows status from the catalog.",
      "Tools from Acme.",
      "Unknown panel.",
    ]);
  });

  it("ignores malformed runtime metadata without throwing", () => {
    const extension = ExtensionBuilder.extensionInfo({
      description: "Safe extension fallback.",
      qualifiedName: "Acme.Tools",
      panelsMeta: {
        Broken: {
          description: 42,
          schemas: ["sensor_msgs/Image", 7],
        },
      } as never,
    });

    expect(
      buildPanelInventory(
        [
          panel({
            type: "Acme.Tools.Broken",
            title: "Broken",
            description: undefined,
          }),
        ],
        [extension],
      ),
    ).toEqual([
      {
        type: "Acme.Tools.Broken",
        title: "Broken",
        description: "Safe extension fallback.",
        source: "extension",
      },
    ]);
  });
});
