/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen, act } from "@testing-library/react";

import { PanelExtensionContext, RenderState } from "@lichtblick/suite";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import { AudioPanel } from "./Audio";
import AudioPanelContextBuilder from "./builders/AudioPanelContextBuilder";

// ---------------------------------------------------------------------------
// AudioContext mock
// ---------------------------------------------------------------------------
class MockAudioContext {
  public state = "running";
  public currentTime = 0;
  public destination = {};

  public createGain = jest.fn(() => ({
    gain: { value: 1 },
    connect: jest.fn(),
  }));

  public createBufferSource = jest.fn(() => ({
    buffer: undefined as AudioBuffer | undefined,
    connect: jest.fn(),
    start: jest.fn(),
    onended: undefined as (() => void) | undefined,
  }));

  public createBuffer = jest.fn(
    (numChannels: number, length: number, sampleRate: number): AudioBuffer => {
      const channels = Array.from({ length: numChannels }, () => new Float32Array(length));
      return {
        numberOfChannels: numChannels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: (ch: number) => channels[ch] ?? new Float32Array(),
        copyFromChannel: jest.fn(),
        copyToChannel: jest.fn(),
      } as unknown as AudioBuffer;
    },
  );

  public decodeAudioData = jest.fn(async (): Promise<AudioBuffer> => {
    return this.createBuffer(1, 1024, 44100);
  });

  public resume = jest.fn(async () => {});
  public close = jest.fn(async () => {});
}

const originalAudioContext = globalThis.AudioContext;
beforeAll(() => {
  Object.defineProperty(globalThis, "AudioContext", {
    value: MockAudioContext,
    writable: true,
    configurable: true,
  });
});
afterAll(() => {
  Object.defineProperty(globalThis, "AudioContext", {
    value: originalAudioContext,
    writable: true,
    configurable: true,
  });
});

function renderPanel(context: PanelExtensionContext) {
  return render(
    <ThemeProvider isDark>
      <AudioPanel context={context} />
    </ThemeProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("AudioPanel", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows a prompt to select a topic when no topic is configured", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "" });
    renderPanel(ctx);
    expect(screen.getByText("No topic selected")).toBeTruthy();
  });

  it("shows the topic name and waiting state when a topic is configured", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "wav" });
    renderPanel(ctx);
    expect(screen.getByText("/audio/data")).toBeTruthy();
    expect(screen.getByText("Waiting for data…")).toBeTruthy();
  });

  it("subscribes to the configured topic", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "wav" });
    renderPanel(ctx);
    expect(ctx.subscribeMock).toHaveBeenCalledWith([{ topic: "/audio/data", preload: false }]);
  });

  it("does not subscribe when no topic is configured", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "" });
    renderPanel(ctx);
    expect(ctx.subscribeMock).not.toHaveBeenCalled();
  });

  it("calls context.watch for required render state fields", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "wav" });
    renderPanel(ctx);
    expect(ctx.watch).toHaveBeenCalledWith("currentFrame");
    expect(ctx.watch).toHaveBeenCalledWith("didSeek");
    expect(ctx.watch).toHaveBeenCalledWith("topics");
  });

  it("populates available topics from render state", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "" });
    renderPanel(ctx);

    const renderState: Partial<RenderState> = {
      topics: [{ name: "/audio/data", schemaName: "audio_common_msgs/AudioData" }],
      currentFrame: [],
    };

    act(() => {
      ctx.onRender?.(renderState as RenderState, () => {});
    });

    expect(ctx.updatePanelSettingsEditor).toHaveBeenCalled();
  });

  it("resets playback state on seek", async () => {
    // given... audio is playing from a PCM message
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "pcm-int16le" });
    renderPanel(ctx);

    await act(async () => {
      ctx.onRender?.(
        {
          currentFrame: [
            {
              topic: "/audio/data",
              message: {
                data: new Uint8Array([0, 0, 0, 0]),
              },
            },
          ],
        } as unknown as RenderState,
        () => {},
      );
    });
    expect(screen.getByText("Playing")).toBeTruthy();

    // when... a seek occurs
    act(() => {
      ctx.onRender?.({ didSeek: true, currentFrame: [] } as unknown as RenderState, () => {});
    });

    // then... playback state is reset
    expect(screen.queryByText("Playing")).toBeNull();
  });
});
