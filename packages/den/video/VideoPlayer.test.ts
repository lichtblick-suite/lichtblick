// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** @jest-environment jsdom */

import { DecodeFramesResult, VideoPlayer } from "./VideoPlayer";

class MockEncodedVideoChunk {
  public readonly type: "key" | "delta";
  public readonly data: Uint8Array;
  public readonly timestamp: number;

  public constructor(init: { type: "key" | "delta"; data: Uint8Array; timestamp: number }) {
    this.type = init.type;
    this.data = init.data;
    this.timestamp = init.timestamp;
  }
}

type MockDecoderHandle = {
  outputFrames: Map<number, (frame: VideoFrame) => void>;
  decoders: MockDecoderInstance[];
};

type MockDecoderInstance = {
  state: "configured" | "closed" | "unconfigured";
  decodeQueueSize: number;
  ondequeue: ((event: Event) => void) | null;
};

type SetupOptions = {
  // If true, each `decode()` call increments `decodeQueueSize` and stores its output callback in
  // `outputFrames` for the test to drive. When false the decoder is a no-op (used when the test
  // only cares about timeouts or reset/error paths).
  trackDecodes?: boolean;
};

/**
 * Installs a mock `globalThis.VideoDecoder` plus `EncodedVideoChunk` and creates a fresh
 * `VideoPlayer`. Returns the handle the test uses to drive decoded frames and inspect decoder
 * state without re-declaring the entire mock class in every test.
 */
function setup(options: SetupOptions = {}): MockDecoderHandle & {
  player: VideoPlayer;
} {
  const handle: MockDecoderHandle = {
    outputFrames: new Map(),
    decoders: [],
  };

  class MockVideoDecoder implements MockDecoderInstance {
    public state: MockDecoderInstance["state"] = "unconfigured";
    public decodeQueueSize = 0;
    public ondequeue: MockDecoderInstance["ondequeue"] = null;
    readonly #init: VideoDecoderInit;

    public constructor(init: VideoDecoderInit) {
      this.#init = init;
      handle.decoders.push(this);
    }

    public configure(): void {
      this.state = "configured";
    }

    public decode(chunk: MockEncodedVideoChunk): void {
      if (options.trackDecodes !== true) {
        return;
      }
      this.decodeQueueSize++;
      handle.outputFrames.set(chunk.timestamp, (frame) => {
        this.#init.output(frame);
        this.decodeQueueSize--;
        this.ondequeue?.(new Event("dequeue"));
      });
    }

    public reset(): void {
      this.decodeQueueSize = 0;
      handle.outputFrames.clear();
    }

    public close(): void {
      this.state = "closed";
      this.decodeQueueSize = 0;
      handle.outputFrames.clear();
    }
  }

  globalThis.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder;
  globalThis.EncodedVideoChunk = MockEncodedVideoChunk as unknown as typeof EncodedVideoChunk;

  const player = new VideoPlayer();
  return { ...handle, player };
}

function createFrame(timestamp: number): VideoFrame {
  return {
    timestamp,
    codedWidth: 640,
    codedHeight: 480,
    close: jest.fn(),
    clone: jest.fn().mockImplementation(function (this: VideoFrame) {
      return this;
    }),
  } as unknown as VideoFrame;
}

describe("VideoPlayer", () => {
  const originalVideoDecoder = globalThis.VideoDecoder;
  const originalEncodedVideoChunk = globalThis.EncodedVideoChunk;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.VideoDecoder = originalVideoDecoder;
    globalThis.EncodedVideoChunk = originalEncodedVideoChunk;
    jest.restoreAllMocks();
  });

  it("should return the target frame when it arrives before timeout", async () => {
    // Given an HEVC-configured player with a tracking mock decoder
    const { player, outputFrames } = setup({ trackDecodes: true });
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // When the decode is submitted and the matching frame is produced
    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 1000, type: "key" },
    ]);
    await Promise.resolve();
    const targetFrame = createFrame(1000);
    outputFrames.get(1000)?.(targetFrame);

    // Then decodeFrames resolves with the target frame
    await expect(decodePromise).resolves.toEqual<DecodeFramesResult>({
      type: "target",
      frame: targetFrame,
    });
  });

  it("should return an intermediate frame when target is late", async () => {
    // Given an H.264-configured player and a slow mock decoder (no ondequeue wiring)
    const outputFrames = new Map<number, (frame: VideoFrame) => void>();

    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";
      readonly #init: VideoDecoderInit;

      public constructor(init: VideoDecoderInit) {
        this.#init = init;
      }

      public configure(): void {
        this.state = "configured";
      }

      public decode(chunk: MockEncodedVideoChunk): void {
        outputFrames.set(chunk.timestamp, this.#init.output);
      }

      public reset(): void {
        outputFrames.clear();
      }

      public close(): void {
        this.state = "closed";
        outputFrames.clear();
      }
    }

    globalThis.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder;
    globalThis.EncodedVideoChunk = MockEncodedVideoChunk as unknown as typeof EncodedVideoChunk;

    const player = new VideoPlayer();
    await player.init({ codec: "avc1.64001f" });

    // When the H.264 target-frame deadline elapses with only the earlier frame produced
    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 0, type: "key" },
      { data: new Uint8Array([2]), timestampMicros: 33333, type: "delta" },
    ]);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10);
    const intermediateFrame = createFrame(0);
    outputFrames.get(0)?.(intermediateFrame);

    // Then decodeFrames resolves with the intermediate frame
    await expect(decodePromise).resolves.toEqual<DecodeFramesResult>({
      type: "intermediate",
      frame: intermediateFrame,
    });
  });

  it("should not return an intermediate HEVC frame before decode queue drain", async () => {
    // Given an HEVC-configured player with a tracking decoder
    const { player, outputFrames } = setup({ trackDecodes: true });
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // When the target deadline passes but the queue is not yet drained,
    // and only the earlier frame has been produced
    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 0, type: "key" },
      { data: new Uint8Array([2]), timestampMicros: 33333, type: "delta" },
    ]);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(30);
    outputFrames.get(0)?.(createFrame(0));

    // Then decodeFrames is still pending — HEVC waits for queue drain before returning intermediate
    await expect(Promise.race([decodePromise, Promise.resolve("pending")])).resolves.toBe(
      "pending",
    );

    // And once the target arrives and the overall timeout elapses, the target frame is returned
    const targetFrame = createFrame(33333);
    outputFrames.get(33333)?.(targetFrame);
    await jest.advanceTimersByTimeAsync(2000);

    await expect(decodePromise).resolves.toEqual<DecodeFramesResult>({
      type: "target",
      frame: targetFrame,
    });
  });

  it("should return timeout when no frame is produced", async () => {
    // Given an HEVC-configured player with a no-op decoder (decode never produces output)
    const { player } = setup();
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // When the full HEVC timeout elapses with no frames decoded
    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 0, type: "key" },
    ]);
    await jest.advanceTimersByTimeAsync(2000);

    // Then decodeFrames resolves with the timeout result
    await expect(decodePromise).resolves.toEqual({ type: "timeout" });
  });

  it("should return aborted on resetForSeek", async () => {
    // Given an HEVC-configured player with an in-flight decode
    const { player } = setup();
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 0, type: "key" },
    ]);
    await Promise.resolve();

    // When resetForSeek is called mid-decode
    player.resetForSeek();

    // Then the pending decode resolves with `aborted` and the decoder config is preserved
    await expect(decodePromise).resolves.toEqual({ type: "aborted", frame: undefined });
    expect(player.decoderConfig()).toEqual(expect.objectContaining({ codec: "hvc1.1.6.L93.B0" }));
  });

  it("should clear decoder config on close", async () => {
    // Given an initialized player
    const { player } = setup();
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // When close() is called
    player.close();

    // Then the cached decoder config is cleared
    expect(player.decoderConfig()).toBeUndefined();
  });

  it("should wait for decode queue drain", async () => {
    // Given an HEVC-configured player whose mock decoder emits its frame after a 40 ms delay
    const decoders: MockVideoDecoder[] = [];
    let output: VideoDecoderInit["output"] | undefined;

    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";
      public decodeQueueSize = 0;
      public ondequeue: ((event: Event) => void) | null = null;

      public constructor(init: VideoDecoderInit) {
        output = init.output;
        decoders.push(this);
      }

      public configure(): void {
        this.state = "configured";
      }

      public decode(chunk: MockEncodedVideoChunk): void {
        this.decodeQueueSize++;
        setTimeout(() => {
          output?.(createFrame(chunk.timestamp));
          const decoder = decoders[0];
          if (decoder) {
            decoder.decodeQueueSize--;
            decoder.ondequeue?.(new Event("dequeue"));
          }
        }, 40);
      }

      public reset(): void {
        this.decodeQueueSize = 0;
      }

      public close(): void {
        this.state = "closed";
        this.decodeQueueSize = 0;
      }
    }

    globalThis.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder;
    globalThis.EncodedVideoChunk = MockEncodedVideoChunk as unknown as typeof EncodedVideoChunk;

    const player = new VideoPlayer();
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // When decodeFrames is called and the queue starts to drain
    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 1000, type: "key" },
    ]);
    await Promise.resolve();
    expect(decoders[0]?.ondequeue).toBeDefined();
    await jest.advanceTimersByTimeAsync(40);

    // Then decodeFrames resolves with the target frame and the ondequeue handler is detached
    await expect(decodePromise).resolves.toMatchObject({ type: "target" });
    expect(decoders[0]?.ondequeue).toBeNull();
  });

  it("should reject non-increasing timestamps until reset", async () => {
    // Given an HEVC-configured player whose decoder echoes each chunk back as a frame
    const errors: Error[] = [];

    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";
      public decodeQueueSize = 0;
      public ondequeue: ((event: Event) => void) | null = null;
      readonly #init: VideoDecoderInit;

      public constructor(init: VideoDecoderInit) {
        this.#init = init;
      }

      public configure(): void {
        this.state = "configured";
      }

      public decode(chunk: MockEncodedVideoChunk): void {
        this.#init.output(createFrame(chunk.timestamp));
      }

      public reset(): void {}
      public close(): void {
        this.state = "closed";
      }
    }

    globalThis.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder;
    globalThis.EncodedVideoChunk = MockEncodedVideoChunk as unknown as typeof EncodedVideoChunk;

    const player = new VideoPlayer();
    player.on("error", (error) => errors.push(error));
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // When a second decode is submitted with a non-increasing timestamp
    await expect(
      player.decodeFrames([{ data: new Uint8Array([1]), timestampMicros: 1000, type: "key" }]),
    ).resolves.toMatchObject({ type: "target" });
    await expect(
      player.decodeFrames([{ data: new Uint8Array([2]), timestampMicros: 1000, type: "delta" }]),
    ).resolves.toEqual({ type: "timeout" });

    // Then the player emits an error about the timestamp constraint
    expect(errors.at(-1)?.message).toContain("timestamp must increase");

    // And after resetForSeek the same timestamp is accepted again (treated as a new run)
    player.resetForSeek();
    await expect(
      player.decodeFrames([{ data: new Uint8Array([3]), timestampMicros: 1000, type: "key" }]),
    ).resolves.toMatchObject({ type: "target" });
  });

  it("should abort pending decode on decoder error", async () => {
    // Given a decoder that immediately raises an EncodingError on decode()
    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";
      public decodeQueueSize = 1;
      public ondequeue: ((event: Event) => void) | null = null;
      readonly #init: VideoDecoderInit;

      public constructor(init: VideoDecoderInit) {
        this.#init = init;
      }

      public configure(): void {
        this.state = "configured";
      }

      public decode(): void {
        this.#init.error(new DOMException("Decoding error", "EncodingError"));
      }

      public reset(): void {}
      public close(): void {
        this.state = "closed";
      }
    }

    globalThis.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder;
    globalThis.EncodedVideoChunk = MockEncodedVideoChunk as unknown as typeof EncodedVideoChunk;

    const errors: Error[] = [];
    const player = new VideoPlayer();
    player.on("error", (error) => errors.push(error));
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // When decodeFrames is called
    // Then it resolves with `aborted` and the emitted error includes the current frame timestamp
    await expect(
      player.decodeFrames([{ data: new Uint8Array([1]), timestampMicros: 1000, type: "key" }]),
    ).resolves.toEqual({ type: "aborted", frame: undefined });
    expect(errors.at(-1)?.message).toBe("Decoding error @ frame timestamp: 0.001s");
  });

  it("should retry configure with no-preference when default config fails", async () => {
    // Given a mock decoder whose first configure() throws and second succeeds
    const configure = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Unsupported configuration");
      })
      .mockImplementationOnce(() => undefined);

    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";

      public configure(config: VideoDecoderConfig): void {
        configure(config);
        this.state = "configured";
      }

      public decode(): void {}
      public reset(): void {}
      public close(): void {
        this.state = "closed";
      }
    }

    globalThis.VideoDecoder = MockVideoDecoder as unknown as typeof VideoDecoder;
    globalThis.EncodedVideoChunk = MockEncodedVideoChunk as unknown as typeof EncodedVideoChunk;

    const player = new VideoPlayer();

    // When init is called
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    // Then the first configure attempt omits hardwareAcceleration, and the retry adds
    // hardwareAcceleration: "no-preference"
    expect(configure).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        codec: "hvc1.1.6.L93.B0",
        optimizeForLatency: true,
      }),
    );
    expect(configure.mock.calls[0]![0]).not.toHaveProperty("hardwareAcceleration");
    expect(configure).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        codec: "hvc1.1.6.L93.B0",
        hardwareAcceleration: "no-preference",
        optimizeForLatency: true,
      }),
    );
  });

  it("should reconfigure the decoder after resetForSeek", async () => {
    // Given a tracking decoder so we can observe configure() calls
    const { player, decoders } = setup({ trackDecodes: true });
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    const decoder = decoders[0]!;
    const configureSpy = jest.spyOn(decoder as unknown as VideoDecoder, "configure");

    // When resetForSeek is invoked on a configured decoder
    player.resetForSeek();

    // Then the decoder is reconfigured so the next decodeFrames() will not bail out on
    // state === "unconfigured" (WebCodecs reset() leaves the decoder unconfigured)
    expect(configureSpy).toHaveBeenCalledWith(
      expect.objectContaining({ codec: "hvc1.1.6.L93.B0" }),
    );
  });
});
