/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import MockMessagePipelineProvider from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import PlaybackSpeedControls from "@lichtblick/suite-base/components/PlaybackSpeedControls";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import MockCurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";

describe("Given PlaybackSpeedControls", () => {
  const renderWithProviders = (activeData?: { speed?: number }) => {
    return render(
      <MockCurrentLayoutProvider>
        <MockMessagePipelineProvider
          activeData={activeData}
          capabilities={[PLAYER_CAPABILITIES.setSpeed]}
        >
          <PlaybackSpeedControls />
        </MockMessagePipelineProvider>
      </MockCurrentLayoutProvider>,
    );
  };

  it("When speed is set to 1 Then correctly displays the speed value", () => {
    renderWithProviders({ speed: 1 });

    expect(screen.getByText("1×")).toBeInTheDocument();
  });

  it("When speed is set to 0.05 Then correctly displays the speed value", () => {
    renderWithProviders({ speed: 0.05 });

    expect(screen.getByText("0.05×")).toBeInTheDocument();
  });

  it("When hovered Then displays tooltip", () => {
    renderWithProviders({ speed: 1 });

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Playback speed");
  });

  it("When clicked Then opens menu", () => {
    renderWithProviders({ speed: 1 });

    const button = screen.getByTestId("PlaybackSpeedControls-Dropdown");
    fireEvent.click(button);

    // Menu should be open and show speed options
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("0.01×")).toBeInTheDocument();
    expect(screen.getByText("0.5×")).toBeInTheDocument();
    expect(screen.getByText("2×")).toBeInTheDocument();
    expect(screen.getByText("5×")).toBeInTheDocument();
  });
});
