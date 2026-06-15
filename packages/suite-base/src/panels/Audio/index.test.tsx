/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import { useCrash } from "@lichtblick/hooks";

import AudioPanel from "./index";
import { AudioConfig } from "./types";

jest.mock("@lichtblick/hooks", () => ({
  useCrash: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/Panel", () => ({
  __esModule: true,
  default: (Component: React.ComponentType) => Component,
}));

jest.mock("@lichtblick/suite-base/components/PanelExtensionAdapter", () => ({
  PanelExtensionAdapter: ({
    config,
    highestSupportedConfigVersion,
  }: {
    config: AudioConfig;
    highestSupportedConfigVersion: number;
  }) => (
    <div
      data-testid="panel-extension-adapter"
      data-config={JSON.stringify(config)}
      data-highest-supported-config-version={highestSupportedConfigVersion}
    />
  ),
}));

jest.mock("@lichtblick/suite-base/components/CaptureErrorBoundary", () => ({
  CaptureErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="capture-error-boundary">{children}</div>
  ),
}));

jest.mock("@lichtblick/suite-base/panels/createSyncRoot", () => ({
  createSyncRoot: (element: React.ReactNode) => <div data-testid="sync-root">{element}</div>,
}));

jest.mock("./Audio", () => ({
  AudioPanel: () => <div data-testid="audio-panel" />,
}));

const mockUseCrash = useCrash as jest.MockedFunction<typeof useCrash>;

describe("Audio panel adapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCrash.mockReturnValue(jest.fn());
  });

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

  it("renders the panel extension adapter", () => {
    // given... a saved panel config
    const saveConfig = jest.fn();
    const config: AudioConfig = {
      topic: "/audio/data",
      encoding: "wav",
      sampleRate: 44100,
      numChannels: 1,
      volume: 0.8,
    };

    // when... rendering the panel adapter
    const { getByTestId } = render(<AudioPanel config={config} saveConfig={saveConfig} />);

    // then... the adapter receives the config
    expect(getByTestId("panel-extension-adapter")).toBeInTheDocument();
    expect(getByTestId("panel-extension-adapter")).toHaveAttribute(
      "data-config",
      JSON.stringify(config),
    );
  });
});
