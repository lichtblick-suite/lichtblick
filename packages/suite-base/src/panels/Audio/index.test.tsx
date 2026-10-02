/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";

import AudioPanel from "./index";

describe("Audio panel adapter", () => {
  it("exports the expected panel metadata", () => {
    // given... the Audio panel module
    // when... reading panel metadata
    const panelType = AudioPanel.panelType;
    const defaultConfig = AudioPanel.defaultConfig;

    // then... metadata matches the Audio panel contract
    expect(panelType).toBe("Audio");
    expect(defaultConfig).toEqual({
      topic: "",
      encoding: "auto",
      sampleRate: 44100,
      numChannels: 1,
      volume: 1,
    });
  });

  it("exports a wrapped panel component", () => {
    // given... the Audio panel module
    // when... checking the default export
    const panel = AudioPanel;

    // then... panel registration metadata is available
    expect(panel).toBeDefined();
    expect(panel.panelType).toBeDefined();
    expect(panel.defaultConfig).toBeDefined();
  });
});
