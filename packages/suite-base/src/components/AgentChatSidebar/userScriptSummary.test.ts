// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { summarizeUserScripts } from "./userScriptSummary";

const validSource = `
export const inputs = ["/imu/data", "/gps/fix"];
export const output = "/studio_script/speed";
export default function (event) { return event; }
`;

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
    expect(summaries[0]).toEqual({
      id: "script-a",
      name: "GPS",
      sourceCode: `export const inputs = ["/gps"]; export const output = "/studio_script/gps";`,
      inputTopics: ["/gps"],
      outputTopic: "/studio_script/gps",
    });
    expect(summaries[1]).toEqual({
      id: "script-b",
      name: "Speed km/h",
      sourceCode: validSource,
      inputTopics: ["/imu/data", "/gps/fix"],
      outputTopic: "/studio_script/speed",
    });
  });

  it("keeps scripts without source code with a parse placeholder", () => {
    const summaries = summarizeUserScripts({
      "script-a": { name: "Empty script" },
    });

    expect(summaries).toEqual([
      {
        id: "script-a",
        name: "Empty script",
        sourceCode: "",
        inputTopics: undefined,
        outputTopic: undefined,
      },
    ]);
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

  it("reports an empty inputs export as an empty list", () => {
    const [summary] = summarizeUserScripts({
      "script-empty-inputs": {
        sourceCode: `export const inputs = []; export const output = "/studio_script/x";`,
      },
    });

    expect(summary?.inputTopics).toEqual([]);
    expect(summary?.outputTopic).toBe("/studio_script/x");
  });

  it("reports explicitly malformed inputs/output as undefined placeholders", () => {
    const summaries = summarizeUserScripts({
      "script-malformed": {
        sourceCode: `export const inputs = "/not-an-array"; export const output = 42;`,
      },
      "script-missing": { sourceCode: "export default () => {}" },
    });

    expect(summaries[0]).toMatchObject({
      id: "script-malformed",
      inputTopics: undefined,
      outputTopic: undefined,
    });
    expect(summaries[1]).toMatchObject({
      id: "script-missing",
      inputTopics: undefined,
      outputTopic: undefined,
    });
  });

  it("parses input/output through the public summary API for the card", () => {
    const [summary] = summarizeUserScripts({
      "script-1": {
        sourceCode: `export const inputs = ['/a', '/b']; export const output = '/studio_script/x';`,
      },
    });

    expect(summary?.inputTopics).toEqual(["/a", "/b"]);
    expect(summary?.outputTopic).toBe("/studio_script/x");
  });
});
