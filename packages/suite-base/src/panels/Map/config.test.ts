// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SettingsTreeField } from "@lichtblick/suite";
import { buildSettingsTree, Config } from "@lichtblick/suite-base/panels/Map/config";

// Not PlayerBuilder.topic: that returns the player-facing Topic, whose schemaName is
// optional, while buildSettingsTree takes the extension-facing Topic where it is required.
const TOPICS = [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }];

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    customTileUrl: "",
    disabledTopics: [],
    followTopic: "",
    layer: "map",
    topicColors: {},
    ...overrides,
  };
}

function generalField(config: Config, field: string): SettingsTreeField | undefined {
  return buildSettingsTree(config, TOPICS).general?.fields?.[field];
}

describe("buildSettingsTree marker settings", () => {
  it("always offers a position marker, defaulting to a dot", () => {
    const field = generalField(makeConfig(), "markerStyle");

    expect(field?.label).toBe("Position marker");
    expect(field?.input).toBe("select");
    expect(field?.value).toBe("dot");
  });

  it("offers every marker style", () => {
    const field = generalField(makeConfig(), "markerStyle");

    expect(field?.input === "select" ? field.options.map((o) => o.value) : []).toEqual([
      "dot",
      "arrow",
      "vehicle",
    ]);
  });

  it.each(["arrow", "vehicle"] as const)("offers colouring for the %s style", (markerStyle) => {
    expect(generalField(makeConfig({ markerStyle }), "markerColoring")).toBeDefined();
  });

  it("hides colouring for a dot, which is drawn in the topic colour", () => {
    // A control that silently does nothing would be worse than no control at all.
    expect(generalField(makeConfig({ markerStyle: "dot" }), "markerColoring")).toBeUndefined();
  });

  it("reports automatic colouring while no colour is stored", () => {
    const config = makeConfig({ markerStyle: "arrow" });

    expect(generalField(config, "markerColoring")?.value).toBe("Automatic");
    expect(generalField(config, "markerColor")).toBeUndefined();
  });

  it("reports custom colouring once a colour is stored, and reveals the picker", () => {
    const config = makeConfig({ markerStyle: "arrow", markerColor: "#00ff00" });

    expect(generalField(config, "markerColoring")?.value).toBe("Custom");
    expect(generalField(config, "markerColor")?.value).toBe("#00ff00");
  });
});

describe("buildSettingsTree rotation setting", () => {
  it("hides the rotation toggle while no topic is followed", () => {
    // Rotation needs a fix to take its bearing from.
    expect(generalField(makeConfig({ followTopic: "" }), "rotateWithHeading")).toBeUndefined();
  });

  it("offers the rotation toggle once a topic is followed", () => {
    const field = generalField(makeConfig({ followTopic: "/gps" }), "rotateWithHeading");

    expect(field?.label).toBe("Rotate with heading");
    expect(field?.input).toBe("boolean");
    expect(field?.value).toBe(false);
  });

  it("reflects the stored rotation state", () => {
    const config = makeConfig({ followTopic: "/gps", rotateWithHeading: true });

    expect(generalField(config, "rotateWithHeading")?.value).toBe(true);
  });
});
