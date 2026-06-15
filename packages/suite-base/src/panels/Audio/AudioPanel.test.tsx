/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, act } from "@testing-library/react";

import { PanelExtensionContext, RenderState } from "@lichtblick/suite";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import { AudioPanel } from "./Audio";
import AudioPanelContextBuilder from "./builders/AudioPanelContextBuilder";
import WebMPlaybackMocksBuilder from "./builders/WebMPlaybackMocksBuilder";

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

  public createMediaElementSource = jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  }));

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

    // eslint-disable-next-line @typescript-eslint/unbound-method
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

  it("shows auto-detect waiting text before format metadata arrives", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "auto" });
    renderPanel(ctx);
    expect(screen.getByText("Auto-detect — waiting for format…")).toBeTruthy();
  });

  it("shows detected encoding after auto-detect parses a message", async () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "auto" });
    renderPanel(ctx);

    await act(async () => {
      ctx.onRender?.(
        {
          currentFrame: [
            {
              topic: "/audio/data",
              message: {
                data: new Uint8Array([0, 0, 0, 0]),
                format: "pcm-s16",
                sample_rate: 48000,
                number_of_channels: 2,
              },
            },
          ],
        } as unknown as RenderState,
        () => {},
      );
    });

    expect(screen.getByText("Auto-detect: PCM Int16 LE @ 48,000 Hz, 2 ch")).toBeTruthy();
  });

  it("shows an error when auto-detect cannot determine encoding", async () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "auto" });
    renderPanel(ctx);

    await act(async () => {
      ctx.onRender?.(
        {
          currentFrame: [
            {
              topic: "/audio/data",
              message: { data: new Uint8Array([1, 2, 3]) },
            },
          ],
        } as unknown as RenderState,
        () => {},
      );
    });

    expect(screen.getByText(/Auto-detect could not determine encoding/)).toBeTruthy();
  });

  it("plays WebM audio when manual WebM encoding is selected", async () => {
    WebMPlaybackMocksBuilder.installMockMediaSource();
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "webm" });
    renderPanel(ctx);

    await act(async () => {
      ctx.onRender?.(
        {
          currentFrame: [
            {
              topic: "/audio/data",
              message: { data: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]) },
            },
          ],
        } as unknown as RenderState,
        () => {},
      );
    });

    expect(screen.getByText("Playing")).toBeTruthy();
  });

  it("decodes compressed audio via decodeAudioData", async () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "wav" });
    renderPanel(ctx);

    await act(async () => {
      ctx.onRender?.(
        {
          currentFrame: [
            {
              topic: "/audio/data",
              message: { data: new Uint8Array([0x52, 0x49, 0x46, 0x46]) },
            },
          ],
        } as unknown as RenderState,
        () => {},
      );
    });

    expect(screen.getByText("Playing")).toBeTruthy();
  });

  it("updates panel config from settings actions", () => {
    const ctx = AudioPanelContextBuilder.context({ topic: "/audio/data", encoding: "wav" });
    renderPanel(ctx);

    const settingsCall = ctx.updatePanelSettingsEditor.mock.calls.at(-1)?.[0];
    act(() => {
      settingsCall?.actionHandler({
        action: "update",
        payload: { path: ["general", "volume"], value: 0.5 },
      });
    });

    expect(ctx.saveState).toHaveBeenCalledWith(expect.objectContaining({ volume: 0.5 }));
  });
});
