// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  extractInputTopics,
  extractOutputTopic,
  summarizeUserScripts,
} from "./userScriptSummary";

const validSource = `
export const inputs = ["/imu/data", "/gps/fix"];
export const output = "/studio_script/speed";
export default function (event) { return event; }
`;

describe("extractInputTopics", () => {
  it("extracts string literals from the inputs export", () => {
    expect(extractInputTopics(validSource)).toEqual(["/imu/data", "/gps/fix"]);
  });

  it("supports single-quoted literals", () => {
    expect(extractInputTopics(`export const inputs = ['/a', '/b'];`)).toEqual(["/a", "/b"]);
  });

  it("returns an empty array for an empty inputs export", () => {
    expect(extractInputTopics(`export const inputs = [];`)).toEqual([]);
  });

  it("returns undefined when the inputs export is missing or malformed", () => {
    expect(extractInputTopics("export default () => {}")).toBeUndefined();
    expect(extractInputTopics(`export const inputs = "/not-an-array";`)).toBeUndefined();
  });
});

describe("extractOutputTopic", () => {
  it("extracts the output topic string", () => {
    expect(extractOutputTopic(validSource)).toBe("/studio_script/speed");
  });

  it("supports single-quoted output", () => {
    expect(extractOutputTopic(`export const output = '/studio_script/x';`)).toBe(
      "/studio_script/x",
    );
  });

  it("returns undefined when the output export is missing or malformed", () => {
    expect(extractOutputTopic("export default () => {}")).toBeUndefined();
    expect(extractOutputTopic(`export const output = 42;`)).toBeUndefined();
  });
});

describe("summarizeUserScripts", () => {
  it("returns an empty list when userNodes is undefined or empty", () => {
    expect(summarizeUserScripts(undefined)).toEqual([]);
    expect(summarizeUserScripts({})).toEqual([]);
  });

  it("summarizes each script with name, id, inputs, output, and source", () => {
    const summaries = summarizeUserScripts({
      "script-b": { name: "Speed km/h", sourceCode: validSource },
      "script-a": {
        name: "GPS",
        sourceCode: `export const inputs = ["/gps"]; export const output = "/studio_script/gps";`,
      },
    });

    expect(summaries.map((summary) => summary.id)).toEqual(["script-a", "script-b"]);
    expect(summaries[0]).toMatchObject({
      id: "script-a",
      name: "GPS",
      inputTopics: ["/gps"],
      outputTopic: "/studio_script/gps",
    });
    expect(summaries[1]).toMatchObject({
      id: "script-b",
      name: "Speed km/h",
      inputTopics: ["/imu/data", "/gps/fix"],
      outputTopic: "/studio_script/speed",
    });
  });

  it("falls back to the id as the name and reports unparseable topics", () => {
    const summaries = summarizeUserScripts({
      "script-c": { name: "", sourceCode: "export default () => {}" },
    });

    expect(summaries[0]).toEqual({
      id: "script-c",
      name: "script-c",
      sourceCode: "export default () => {}",
      inputTopics: undefined,
      outputTopic: undefined,
    });
  });

  it("survives malformed entries without crashing", () => {
    const summaries = summarizeUserScripts({
      "script-d": { name: "Broken" },
    });

    expect(summaries[0]).toMatchObject({
      id: "script-d",
      name: "Broken",
      inputTopics: undefined,
      outputTopic: undefined,
    });
  });
});
