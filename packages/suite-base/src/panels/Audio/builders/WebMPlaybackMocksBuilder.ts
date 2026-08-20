// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-extraneous-class */

export type SourceBufferMock = {
  mode: string;
  updating: boolean;
  buffered: { length: number };
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  appendBuffer: jest.Mock;
};

export type MediaSourceMock = {
  readyState: string;
  addSourceBuffer: jest.Mock;
  addEventListener: jest.Mock;
  endOfStream: jest.Mock;
};

type SourceBufferMockOptions = {
  bufferedLength?: number;
};

type SourceBufferMockResult = {
  sourceBuffer: SourceBufferMock;
  updateEndListeners: Array<() => void>;
};

type MediaSourceMockOptions = {
  sourceBuffer?: SourceBufferMock;
  deferSourceOpen?: boolean;
  sourceBufferOptions?: SourceBufferMockOptions;
};

type MediaSourceMockResult = {
  mediaSource: MediaSourceMock;
  sourceOpenListeners: Array<() => void>;
  MockMediaSource: new () => MediaSourceMock;
};

export default class WebMPlaybackMocksBuilder {
  public static sourceBuffer(options: SourceBufferMockOptions = {}): SourceBufferMockResult {
    const bufferedLength = options.bufferedLength ?? 1;
    const updateEndListeners: Array<() => void> = [];
    const sourceBuffer: SourceBufferMock = {
      mode: "sequence",
      updating: false,
      buffered: { length: bufferedLength },
      addEventListener: jest.fn((event: string, listener: () => void) => {
        if (event === "updateend") {
          updateEndListeners.push(listener);
        }
      }),
      removeEventListener: jest.fn((event: string, listener: () => void) => {
        if (event === "updateend") {
          const index = updateEndListeners.indexOf(listener);
          if (index >= 0) {
            updateEndListeners.splice(index, 1);
          }
        }
      }),
      appendBuffer: jest.fn(() => {
        sourceBuffer.updating = true;
        queueMicrotask(() => {
          sourceBuffer.updating = false;
          for (const listener of updateEndListeners) {
            listener();
          }
        });
      }),
    };

    return { sourceBuffer, updateEndListeners };
  }

  public static mediaSource(options: MediaSourceMockOptions = {}): MediaSourceMockResult {
    const sourceOpenListeners: Array<() => void> = [];
    const {
      sourceBuffer: providedSourceBuffer,
      deferSourceOpen = false,
      sourceBufferOptions,
    } = options;
    const { sourceBuffer: defaultSourceBuffer } =
      WebMPlaybackMocksBuilder.sourceBuffer(sourceBufferOptions);
    const sourceBuffer = providedSourceBuffer ?? defaultSourceBuffer;

    const mediaSource: MediaSourceMock = {
      readyState: "open",
      addSourceBuffer: jest.fn(() => sourceBuffer),
      addEventListener: jest.fn((event: string, listener: () => void) => {
        if (event === "sourceopen") {
          sourceOpenListeners.push(listener);
          if (!deferSourceOpen) {
            queueMicrotask(listener);
          }
        }
      }),
      endOfStream: jest.fn(),
    };

    class MockMediaSource {
      public static isTypeSupported(): boolean {
        return true;
      }
      public readyState = mediaSource.readyState;
      public addSourceBuffer = mediaSource.addSourceBuffer;
      public addEventListener = mediaSource.addEventListener;
      public endOfStream = mediaSource.endOfStream;
    }

    return {
      mediaSource,
      sourceOpenListeners,
      MockMediaSource,
    };
  }

  public static installMockMediaSource(
    options: MediaSourceMockOptions = {},
  ): MediaSourceMockResult {
    const mocks = WebMPlaybackMocksBuilder.mediaSource(options);
    Object.defineProperty(globalThis, "MediaSource", {
      value: mocks.MockMediaSource,
      writable: true,
      configurable: true,
    });
    return mocks;
  }
}
