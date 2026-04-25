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

  function createFrame(timestamp: number): VideoFrame {
    return {
      timestamp,
      codedWidth: 640,
      codedHeight: 480,
      close: jest.fn(),
      clone: jest.fn().mockImplementation(function () {
        return this;
      }),
    } as unknown as VideoFrame;
  }

  it("should return the target frame when it arrives before timeout", async () => {
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
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    const decodePromise = player.decodeFrames([{ data: new Uint8Array([1]), timestampMicros: 1000, type: "key" }]);
    await Promise.resolve();

    const targetFrame = createFrame(1000);
    outputFrames.get(1000)?.(targetFrame);

    await expect(decodePromise).resolves.toEqual<DecodeFramesResult>({
      type: "target",
      frame: targetFrame,
    });
  });

  it("should return an intermediate frame when target is late", async () => {
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

    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 0, type: "key" },
      { data: new Uint8Array([2]), timestampMicros: 33333, type: "delta" },
    ]);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(10);

    const intermediateFrame = createFrame(0);
    outputFrames.get(0)?.(intermediateFrame);

    await expect(decodePromise).resolves.toEqual<DecodeFramesResult>({
      type: "intermediate",
      frame: intermediateFrame,
    });
  });

  it("should not return an intermediate HEVC frame before decode queue drain", async () => {
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
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 0, type: "key" },
      { data: new Uint8Array([2]), timestampMicros: 33333, type: "delta" },
    ]);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(30);

    outputFrames.get(0)?.(createFrame(0));
    await expect(Promise.race([decodePromise, Promise.resolve("pending")])).resolves.toBe("pending");

    const targetFrame = createFrame(33333);
    outputFrames.get(33333)?.(targetFrame);
    await jest.advanceTimersByTimeAsync(2000);

    await expect(decodePromise).resolves.toEqual<DecodeFramesResult>({
      type: "target",
      frame: targetFrame,
    });
  });

  it("should return timeout when no frame is produced", async () => {
    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";

      public constructor(_: VideoDecoderInit) {}

      public configure(): void {
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
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    const decodePromise = player.decodeFrames([{ data: new Uint8Array([1]), timestampMicros: 0, type: "key" }]);
    await jest.advanceTimersByTimeAsync(2000);

    await expect(decodePromise).resolves.toEqual({ type: "timeout" });
  });

  it("should return aborted on resetForSeek", async () => {
    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";

      public constructor(_: VideoDecoderInit) {}

      public configure(): void {
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
    await player.init({ codec: "hvc1.1.6.L93.B0" });

    const decodePromise = player.decodeFrames([{ data: new Uint8Array([1]), timestampMicros: 0, type: "key" }]);
    await Promise.resolve();
    player.resetForSeek();

    await expect(decodePromise).resolves.toEqual({ type: "aborted", frame: undefined });
    expect(player.decoderConfig()).toEqual(
      expect.objectContaining({ codec: "hvc1.1.6.L93.B0" }),
    );
  });

  it("should clear decoder config on close", async () => {
    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";

      public constructor(_: VideoDecoderInit) {}

      public configure(): void {
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
    await player.init({ codec: "hvc1.1.6.L93.B0" });
    player.close();

    expect(player.decoderConfig()).toBeUndefined();
  });

  it("should wait for decode queue drain", async () => {
    let decoder: MockVideoDecoder | undefined;

    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";
      public decodeQueueSize = 0;
      public ondequeue: ((event: Event) => void) | null = null;
      readonly #init: VideoDecoderInit;

      public constructor(init: VideoDecoderInit) {
        this.#init = init;
        decoder = this;
      }

      public configure(): void {
        this.state = "configured";
      }

      public decode(chunk: MockEncodedVideoChunk): void {
        this.decodeQueueSize++;
        setTimeout(() => {
          this.#init.output(createFrame(chunk.timestamp));
          this.decodeQueueSize--;
          this.ondequeue?.(new Event("dequeue"));
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

    const decodePromise = player.decodeFrames([
      { data: new Uint8Array([1]), timestampMicros: 1000, type: "key" },
    ]);
    await Promise.resolve();

    expect(decoder?.ondequeue).toBeDefined();
    await jest.advanceTimersByTimeAsync(40);

    await expect(decodePromise).resolves.toMatchObject({ type: "target" });
    expect(decoder?.ondequeue).toBeNull();
  });

  it("should reject non-increasing timestamps until reset", async () => {
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

    await expect(
      player.decodeFrames([{ data: new Uint8Array([1]), timestampMicros: 1000, type: "key" }]),
    ).resolves.toMatchObject({ type: "target" });
    await expect(
      player.decodeFrames([{ data: new Uint8Array([2]), timestampMicros: 1000, type: "delta" }]),
    ).resolves.toEqual({ type: "timeout" });
    expect(errors.at(-1)?.message).toContain("timestamp must increase");

    player.resetForSeek();
    await expect(
      player.decodeFrames([{ data: new Uint8Array([3]), timestampMicros: 1000, type: "key" }]),
    ).resolves.toMatchObject({ type: "target" });
  });

  it("should abort pending decode on decoder error", async () => {
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

    await expect(
      player.decodeFrames([{ data: new Uint8Array([1]), timestampMicros: 1000, type: "key" }]),
    ).resolves.toEqual({ type: "aborted", frame: undefined });
    expect(errors.at(-1)?.message).toBe("Decoding error @ frame timestamp: 0.001s");
  });

  it("should retry configure with no-preference when default config fails", async () => {
    const configure = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Unsupported configuration");
      })
      .mockImplementationOnce(() => undefined);

    class MockVideoDecoder {
      public state: "configured" | "closed" | "unconfigured" = "unconfigured";

      public constructor(_: VideoDecoderInit) {}

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
    await player.init({ codec: "hvc1.1.6.L93.B0" });

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
});
