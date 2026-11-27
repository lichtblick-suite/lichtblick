// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ScenarioScreenshotter,
  loadedEventName,
  resolveScreenshotMode,
  screenshotFileName,
  waitUntil,
} from "./screenshots";
import type { ScenarioScreenshotterOptions, ScreenshotAttacher, ScreenshotPage } from "./types";

/** Fake page writing a 1-byte "PNG" to the requested path (or failing on demand). */
class FakePageBuilder {
  #fail = false;
  public readonly calls: string[] = [];

  public failing(): this {
    this.#fail = true;
    return this;
  }

  public build(): ScreenshotPage {
    return {
      screenshot: async ({ path: filePath }) => {
        this.calls.push(filePath);
        if (this.#fail) {
          throw new Error("screenshot failed");
        }
        await fs.promises.writeFile(filePath, "png");
      },
    };
  }
}

/**
 * Fake page whose `screenshot()` takes `durationMs` on the (fake) clock and does no I/O, so the
 * fake timers fully drive a run. Records when each capture started and the peak concurrency.
 */
class TimedPageBuilder {
  #durationMs = 0;
  #active = 0;
  public maxActive = 0;
  public readonly starts: { path: string; atMs: number }[] = [];

  public taking(durationMs: number): this {
    this.#durationMs = durationMs;
    return this;
  }

  public build(): ScreenshotPage {
    return {
      screenshot: async ({ path: filePath }) => {
        this.starts.push({ path: filePath, atMs: Date.now() });
        this.#active++;
        this.maxActive = Math.max(this.maxActive, this.#active);
        await new Promise((resolve) => setTimeout(resolve, this.#durationMs));
        this.#active--;
      },
    };
  }
}

function attacher({ fail = false }: { fail?: boolean } = {}): ScreenshotAttacher & {
  names: string[];
} {
  const names: string[] = [];
  return {
    names,
    attach: async (name) => {
      names.push(name);
      if (fail) {
        throw new Error("attach failed");
      }
    },
  };
}

describe("resolveScreenshotMode", () => {
  it.each([undefined, false])("is none when the run doesn't opt in (requested=%s)", (requested) => {
    // Given: even an env asking for all checkpoints
    const env = { BENCHMARK_SCREENSHOTS: "all" };

    // When
    const mode = resolveScreenshotMode({ requested, env });

    // Then
    expect(mode).toBe("none");
  });

  it("defaults to end only when BENCHMARK_SCREENSHOTS is unset", () => {
    // Given / When
    const mode = resolveScreenshotMode({ requested: true, env: {} });

    // Then: no capture inside the sampling window
    expect(mode).toBe("end");
  });

  it.each([
    "",
    "1",
    "true",
    "yes",
  ])("defaults to end only for BENCHMARK_SCREENSHOTS=%p", (value) => {
    // Given
    const env = { BENCHMARK_SCREENSHOTS: value };

    // When
    const mode = resolveScreenshotMode({ requested: true, env });

    // Then
    expect(mode).toBe("end");
  });

  it.each(["0", "false", "OFF", " no "])("is none for BENCHMARK_SCREENSHOTS=%p", (value) => {
    // Given
    const env = { BENCHMARK_SCREENSHOTS: value };

    // When
    const mode = resolveScreenshotMode({ requested: true, env });

    // Then
    expect(mode).toBe("none");
  });

  it.each(["all", " ALL "])("captures all checkpoints for BENCHMARK_SCREENSHOTS=%p", (value) => {
    // Given
    const env = { BENCHMARK_SCREENSHOTS: value };

    // When
    const mode = resolveScreenshotMode({ requested: true, env });

    // Then
    expect(mode).toBe("all");
  });
});

describe("screenshotFileName", () => {
  it("builds <scenarioId>-<platform>-<ts>-<checkpoint>.png", () => {
    // Given / When
    const name = screenshotFileName({
      scenarioId: "sinewave",
      platform: "web",
      telemetryEnabled: true,
      timestamp: 123,
      checkpoint: "mid",
    });

    // Then
    expect(name).toBe("sinewave-web-123-mid.png");
  });

  it("adds -telemetry-off for baseline runs", () => {
    // Given / When
    const name = screenshotFileName({
      scenarioId: "mcap-multi-ingest",
      platform: "electron",
      telemetryEnabled: false,
      timestamp: 7,
      checkpoint: "loaded",
    });

    // Then
    expect(name).toBe("mcap-multi-ingest-electron-telemetry-off-7-loaded.png");
  });
});

describe("loadedEventName", () => {
  it("uses datasource.firstMessage for real pipelines and app.ready for synthetic ones", () => {
    // Given / When / Then
    expect(loadedEventName("real")).toBe("datasource.firstMessage");
    expect(loadedEventName("synthetic")).toBe("app.ready");
  });
});

describe("waitUntil", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves true once the predicate holds", async () => {
    // Given
    let calls = 0;

    // When
    const pending = waitUntil(() => ++calls >= 3, Date.now() + 1_000, 1);
    await jest.advanceTimersByTimeAsync(2);

    // Then
    await expect(pending).resolves.toBe(true);
    expect(calls).toBe(3);
  });

  it("resolves false after the deadline", async () => {
    // Given
    const start = Date.now();

    // When
    const pending = waitUntil(() => false, start + 20, 5);
    await jest.advanceTimersByTimeAsync(20);

    // Then
    await expect(pending).resolves.toBe(false);
    expect(Date.now() - start).toBe(20);
  });
});

describe("ScenarioScreenshotter", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "benchmark-screenshots-"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function screenshotter(overrides: Partial<ScenarioScreenshotterOptions>): ScenarioScreenshotter {
    return new ScenarioScreenshotter({
      page: new FakePageBuilder().build(),
      dir: path.join(dir, "screenshots"),
      scenarioId: "sinewave",
      platform: "web",
      telemetryEnabled: true,
      timestamp: 42,
      timings: {
        loadedFallbackMs: 50,
        paintDelayMs: 5,
        pollIntervalMs: 2,
        timeoutMs: 1_000,
      },
      ...overrides,
    });
  }

  it("writes the screenshot into the (created) dir and attaches it", async () => {
    // Given
    const report = attacher();
    const subject = screenshotter({ attacher: report });

    // When
    const artifact = await subject.capture("end");

    // Then
    const expectedPath = path.join(dir, "screenshots", "sinewave-web-42-end.png");
    expect(artifact).toEqual({ checkpoint: "end", path: expectedPath });
    expect(fs.existsSync(expectedPath)).toBe(true);
    expect(report.names).toEqual(["sinewave-web-42-end.png"]);
    expect(subject.captured()).toEqual([artifact]);
  });

  it("never rejects when the screenshot fails", async () => {
    // Given
    const page = new FakePageBuilder().failing();
    const report = attacher();
    const subject = screenshotter({ page: page.build(), attacher: report });

    // When
    const artifact = await subject.capture("loaded");

    // Then
    expect(artifact).toBeUndefined();
    expect(page.calls).toHaveLength(1);
    expect(report.names).toEqual([]);
    expect(subject.captured()).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("keeps the screenshot when attaching it fails", async () => {
    // Given
    const subject = screenshotter({ attacher: attacher({ fail: true }) });

    // When
    const artifact = await subject.capture("mid");

    // Then
    expect(artifact?.checkpoint).toBe("mid");
    expect(subject.captured()).toHaveLength(1);
    expect(console.warn).toHaveBeenCalled();
  });

  it("skips a capture that would start after its deadline", async () => {
    // Given
    const page = new FakePageBuilder();
    const subject = screenshotter({ page: page.build() });

    // When
    const artifact = await subject.capture("mid", { notAfterMs: Date.now() - 1 });

    // Then
    expect(artifact).toBeUndefined();
    expect(page.calls).toEqual([]);
    expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('skipping "mid"'));
  });

  describe("with a fake clock", () => {
    // The window checkpoints race wall-clock deadlines: fake timers (and a no-I/O page, with the
    // dir creation stubbed) make every capture start at a deterministic time.
    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(fs.promises, "mkdir").mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /** Runs every pending timer (including the ones scheduled meanwhile), then the background tasks. */
    async function runToCompletion(subject: ScenarioScreenshotter): Promise<void> {
      await jest.runAllTimersAsync();
      await subject.settle();
    }

    it("captures loaded once the event is observed, then mid at half the window", async () => {
      // Given: the loaded event arrives 10 ms into a 200 ms window
      let loaded = false;
      const page = new TimedPageBuilder();
      const subject = screenshotter({ page: page.build() });
      const windowStartMs = Date.now();
      setTimeout(() => {
        loaded = true;
      }, 10);

      // When
      subject.startWindowCheckpoints({
        windowStartMs,
        durationMs: 200,
        isLoaded: () => loaded,
      });
      await runToCompletion(subject);

      // Then: loaded is captured before the 50 ms fallback, mid at half the window
      expect(subject.captured().map((shot) => shot.checkpoint)).toEqual(["loaded", "mid"]);
      expect(page.starts[0]!.atMs - windowStartMs).toBeLessThan(50);
      expect(page.starts[1]!.atMs - windowStartMs).toBe(100);
      expect(console.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("loaded event not observed"),
      );
    });

    it("captures loaded after the fallback when the event never arrives", async () => {
      // Given
      const page = new TimedPageBuilder();
      const subject = screenshotter({ page: page.build() });
      const windowStartMs = Date.now();

      // When
      subject.startWindowCheckpoints({
        windowStartMs,
        durationMs: 400,
        isLoaded: () => false,
      });
      await runToCompletion(subject);

      // Then: fallback (50 ms) + paint delay (5 ms) land before mid (200 ms)
      expect(subject.captured().map((shot) => shot.checkpoint)).toEqual(["loaded", "mid"]);
      expect(page.starts.map((start) => start.atMs - windowStartMs)).toEqual([55, 200]);
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining("loaded event not observed"),
      );
    });

    it("skips window captures queued behind a slow capture past the window deadline", async () => {
      // Given: each capture takes longer than the whole window
      const page = new TimedPageBuilder().taking(150);
      const subject = screenshotter({ page: page.build() });

      // When
      subject.startWindowCheckpoints({
        windowStartMs: Date.now(),
        durationMs: 100,
        isLoaded: () => true,
      });
      await runToCompletion(subject);

      // Then: `loaded` (scheduled first) completes, `mid` would start after the deadline
      expect(subject.captured().map((shot) => shot.checkpoint)).toEqual(["loaded"]);
      expect(page.starts).toHaveLength(1);
      expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('skipping "mid"'));
    });

    it("serializes concurrent captures", async () => {
      // Given
      const page = new TimedPageBuilder().taking(5);
      const subject = screenshotter({ page: page.build() });

      // When
      const captures = Promise.all([
        subject.capture("loaded"),
        subject.capture("mid"),
        subject.capture("end"),
      ]);
      await jest.runAllTimersAsync();
      await captures;

      // Then
      expect(page.maxActive).toBe(1);
      expect(subject.captured().map((shot) => shot.checkpoint)).toEqual(["loaded", "mid", "end"]);
    });
  });
});
