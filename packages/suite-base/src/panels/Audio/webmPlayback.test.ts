/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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
    class MockMediaSource {
      public static isTypeSupported(type: string): boolean {
        return type === 'audio/webm; codecs="opus"';
      }
    }
    Object.defineProperty(globalThis, "MediaSource", {
      value: MockMediaSource,
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
  it("throws when WebM playback is not supported", () => {
    // given... MediaSource is unavailable
    const originalMediaSource = globalThis.MediaSource;
    Object.defineProperty(globalThis, "MediaSource", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const audioContext = {
      createMediaElementSource: jest.fn(() => ({ connect: jest.fn() })),
    } as unknown as AudioContext;
    const gainNode = { connect: jest.fn() } as unknown as GainNode;
    const player = new WebMStreamPlayer(audioContext, gainNode);

    // when... appending a WebM chunk
    const append = () => player.append(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]));

    // then... initialization fails with a clear error
    expect(append).toThrow("WebM playback is not supported in this browser");

    Object.defineProperty(globalThis, "MediaSource", {
      value: originalMediaSource,
      writable: true,
      configurable: true,
    });
  });
});
