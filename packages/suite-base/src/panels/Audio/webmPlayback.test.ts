/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import WebMPlaybackMocksBuilder from "./builders/WebMPlaybackMocksBuilder";
import { getSupportedWebmMimeType, WebMStreamPlayer } from "./webmPlayback";

describe("getSupportedWebmMimeType", () => {
  const originalMediaSource = globalThis.MediaSource;

  afterEach(() => {
    Object.defineProperty(globalThis, "MediaSource", {
      value: originalMediaSource,
      writable: true,
      configurable: true,
    });
  });

  it("returns undefined when MediaSource is unavailable", () => {
    // given... MediaSource is not available
    Object.defineProperty(globalThis, "MediaSource", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    // when... resolving a supported mime type
    const mimeType = getSupportedWebmMimeType();

    // then... no mime type is returned
    expect(mimeType).toBeUndefined();
  });

  it("returns the first supported WebM mime type", () => {
    // given... MediaSource reports opus support
    WebMPlaybackMocksBuilder.installMockMediaSource();
    Object.defineProperty(globalThis.MediaSource, "isTypeSupported", {
      value: (type: string) => type === 'audio/webm; codecs="opus"',
      writable: true,
      configurable: true,
    });

    // when... resolving a supported mime type
    const mimeType = getSupportedWebmMimeType();

    // then... the opus WebM mime type is returned
    expect(mimeType).toBe('audio/webm; codecs="opus"');
  });
});

describe("WebMStreamPlayer", () => {
  const originalMediaSource = globalThis.MediaSource;

  afterEach(() => {
    Object.defineProperty(globalThis, "MediaSource", {
      value: originalMediaSource,
      writable: true,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  it("ignores stale SourceBuffer callbacks after reset", async () => {
    // given... a player with a SourceBuffer that fires updateend after reset
    const { sourceBuffer, updateEndListeners } = WebMPlaybackMocksBuilder.sourceBuffer();
    WebMPlaybackMocksBuilder.installMockMediaSource({ sourceBuffer });

    const audio = {
      paused: true,
      src: "",
      pause: jest.fn(),
      load: jest.fn(),
      removeAttribute: jest.fn(),
      play: jest.fn(async () => undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const originalCreateElement = document.createElement.bind(document);
    jest
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === "audio") {
          return audio as unknown as HTMLAudioElement;
        }
        return originalCreateElement(tagName, options);
      });

    const audioContext = {
      state: "running",
      resume: jest.fn(async () => undefined),
      createMediaElementSource: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
    } as unknown as AudioContext;
    const gainNode = { connect: jest.fn() } as unknown as GainNode;
    const player = new WebMStreamPlayer(audioContext, gainNode);

    // when... appending a chunk, waiting for initialization, then resetting
    player.append(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]));
    await Promise.resolve();
    const staleListeners = [...updateEndListeners];
    Object.defineProperty(sourceBuffer, "buffered", {
      get() {
        throw new DOMException(
          "Failed to read the 'buffered' property from 'SourceBuffer': This SourceBuffer has been removed from the parent media source.",
          "InvalidStateError",
        );
      },
    });
    player.reset();

    // then... a delayed updateend callback does not throw
    expect(() => {
      for (const listener of staleListeners) {
        listener();
      }
    }).not.toThrow();
    expect(sourceBuffer.removeEventListener).toHaveBeenCalledWith(
      "updateend",
      expect.any(Function),
    );
  });

  it("throws when WebM playback is not supported", () => {
    // given... MediaSource is unavailable
    Object.defineProperty(globalThis, "MediaSource", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const audioContext = {
      createMediaElementSource: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
    } as unknown as AudioContext;
    const gainNode = { connect: jest.fn() } as unknown as GainNode;
    const player = new WebMStreamPlayer(audioContext, gainNode);

    // when... appending a WebM chunk
    const append = () => {
      player.append(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]));
    };

    // then... initialization fails with a clear error
    expect(append).toThrow("WebM playback is not supported in this browser");
  });

  it("initializes only once when multiple chunks arrive before sourceopen", async () => {
    // given... a player receiving chunks before MediaSource opens
    const { mediaSource, sourceOpenListeners } = WebMPlaybackMocksBuilder.installMockMediaSource({
      deferSourceOpen: true,
      sourceBufferOptions: { bufferedLength: 0 },
    });

    const createMediaElementSource = jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() }));
    const audioContext = {
      state: "running",
      resume: jest.fn(async () => undefined),
      createMediaElementSource,
    } as unknown as AudioContext;
    const gainNode = { connect: jest.fn() } as unknown as GainNode;
    const player = new WebMStreamPlayer(audioContext, gainNode);

    // when... appending multiple chunks before sourceopen fires
    player.append(new Uint8Array([0x1a]));
    player.append(new Uint8Array([0x45]));

    // then... only one MediaElementSource is created
    expect(createMediaElementSource).toHaveBeenCalledTimes(1);

    for (const listener of sourceOpenListeners) {
      listener();
    }
    await Promise.resolve();
    expect(mediaSource.addSourceBuffer).toHaveBeenCalledTimes(1);
  });

  it("reports playing state from the underlying audio element", () => {
    // given... a player with a paused audio element
    WebMPlaybackMocksBuilder.installMockMediaSource();
    const audio = {
      paused: true,
      src: "",
      pause: jest.fn(),
      load: jest.fn(),
      removeAttribute: jest.fn(),
      play: jest.fn(async () => undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const originalCreateElement = document.createElement.bind(document);
    jest
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === "audio") {
          return audio as unknown as HTMLAudioElement;
        }
        return originalCreateElement(tagName, options);
      });

    const audioContext = {
      state: "running",
      resume: jest.fn(async () => undefined),
      createMediaElementSource: jest.fn(() => ({ connect: jest.fn(), disconnect: jest.fn() })),
    } as unknown as AudioContext;
    const gainNode = { connect: jest.fn() } as unknown as GainNode;
    const player = new WebMStreamPlayer(audioContext, gainNode);

    // when... checking playback state
    const playing = player.isPlaying();

    // then... playback reflects the audio element
    expect(playing).toBe(false);
  });
});
