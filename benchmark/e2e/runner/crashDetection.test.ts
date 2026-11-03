// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ElectronApplication, Page } from "@playwright/test";
import { EventEmitter } from "node:events";

import { PROCESS_GONE_BUFFER_KEY } from "./constants";
import {
  filterRunnerEvents,
  formatRunnerEventsFailure,
  isUnexpectedReload,
  mapProcessGoneRecord,
  startCrashDetection,
} from "./crashDetection";
import type { ProcessGoneRecord } from "./types";
import type { RunnerEvent } from "../result/schemaV1";

class ProcessGoneRecordBuilder {
  #source: ProcessGoneRecord["source"] = "child-process-gone";
  #reason = "crashed";
  #exitCode = 11;
  #type = "GPU";
  #url: string | undefined;
  #monotonicTs = 1_000;

  public renderer(url?: string): this {
    this.#source = "render-process-gone";
    this.#url = url;
    return this;
  }

  public withReason(reason: string): this {
    this.#reason = reason;
    return this;
  }

  public withType(type: string): this {
    this.#type = type;
    return this;
  }

  public build(): ProcessGoneRecord {
    const base = { monotonicTs: this.#monotonicTs, reason: this.#reason, exitCode: this.#exitCode };
    return this.#source === "render-process-gone"
      ? { source: "render-process-gone", ...base, url: this.#url }
      : { source: "child-process-gone", ...base, type: this.#type };
  }
}

function runnerEvent(overrides: Partial<RunnerEvent> = {}): RunnerEvent {
  return { type: "renderer.crash", monotonicTs: 1_000, ...overrides };
}

describe("mapProcessGoneRecord", () => {
  it("should ignore a clean exit", () => {
    // Given
    const record = new ProcessGoneRecordBuilder().withReason("clean-exit").build();

    // When
    const event = mapProcessGoneRecord(record);

    // Then
    expect(event).toBeUndefined();
  });

  it("should map render-process-gone to process.gone with processType renderer", () => {
    // Given
    const record = new ProcessGoneRecordBuilder()
      .renderer("file:///index.html?scenario=sinewave")
      .withReason("oom")
      .build();

    // When
    const event = mapProcessGoneRecord(record);

    // Then
    expect(event).toEqual({
      type: "process.gone",
      monotonicTs: 1_000,
      reason: "oom",
      processType: "renderer",
      exitCode: 11,
      url: "file:///index.html?scenario=sinewave",
    });
  });

  it("should map child-process-gone to process.gone with the Electron details.type", () => {
    // Given
    const record = new ProcessGoneRecordBuilder().withType("Utility").withReason("killed").build();

    // When
    const event = mapProcessGoneRecord(record);

    // Then
    expect(event).toEqual({
      type: "process.gone",
      monotonicTs: 1_000,
      reason: "killed",
      processType: "Utility",
      exitCode: 11,
    });
  });
});

describe("isUnexpectedReload", () => {
  const reload = { armed: true, closing: false, isMainFrame: true, newDocument: true };

  it("should report a new main-frame document once armed", () => {
    // Given / When / Then
    expect(isUnexpectedReload(reload)).toBe(true);
  });

  it("should not report navigations before arming (the runner's own navigation)", () => {
    // Given / When / Then
    expect(isUnexpectedReload({ ...reload, armed: false })).toBe(false);
  });

  it("should not report same-document navigations, sub frames or navigations while closing", () => {
    // Given / When / Then
    expect(isUnexpectedReload({ ...reload, newDocument: false })).toBe(false);
    expect(isUnexpectedReload({ ...reload, isMainFrame: false })).toBe(false);
    expect(isUnexpectedReload({ ...reload, closing: true })).toBe(false);
  });
});

describe("filterRunnerEvents", () => {
  it("should drop events in the runner's shutdown window and sort the rest", () => {
    // Given
    const events = [
      runnerEvent({ monotonicTs: 3_000, type: "process.gone" }),
      runnerEvent({ monotonicTs: 1_000 }),
      runnerEvent({ monotonicTs: 5_000, type: "process.gone", reason: "killed" }),
      runnerEvent({ monotonicTs: 4_000, type: "renderer.reload" }),
    ];

    // When
    const kept = filterRunnerEvents(events, { closingStartedAt: 4_000 });

    // Then
    expect(kept.map((event) => event.monotonicTs)).toEqual([1_000, 3_000]);
  });

  it("should keep all events when the runner is not closing", () => {
    // Given
    const events = [runnerEvent({ monotonicTs: 2 }), runnerEvent({ monotonicTs: 1 })];

    // When
    const kept = filterRunnerEvents(events, { closingStartedAt: undefined });

    // Then
    expect(kept.map((event) => event.monotonicTs)).toEqual([1, 2]);
  });
});

describe("formatRunnerEventsFailure", () => {
  it("should return undefined without events", () => {
    // Given / When / Then
    expect(formatRunnerEventsFailure({ label: "web/sinewave", events: [] })).toBeUndefined();
  });

  it("should list every event with its details and the result path", () => {
    // Given
    const events = [
      runnerEvent({ processType: "renderer", url: "http://x/" }),
      runnerEvent({ type: "process.gone", processType: "GPU", reason: "crashed", exitCode: 9 }),
    ];

    // When
    const message = formatRunnerEventsFailure({
      label: "electron/pointcloud",
      events,
      resultPath: "/tmp/r.json",
    });

    // Then
    expect(message).toBe(
      [
        "electron/pointcloud: 2 runner events (crash/process gone/reload), the run did not measure the scenario:",
        "  - renderer.crash (renderer, http://x/)",
        "  - process.gone (GPU, reason=crashed, exitCode=9)",
        "  result: /tmp/r.json",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// startCrashDetection with fake Playwright objects
// ---------------------------------------------------------------------------------------------

type PageFunction = (arg: unknown) => unknown;
type MainFunction = (electron: { app: EventEmitter }, arg: unknown) => unknown;

/**
 * Fake Playwright page: `evaluate` runs the function against `globalThis.window`, which a test
 * replaces to simulate a new document.
 */
class FakePage extends EventEmitter {
  public readonly frame = {
    url: () => "http://localhost/?scenario=sinewave",
    evaluate: async (fn: PageFunction, arg: unknown) => fn(arg),
  };

  public mainFrame() {
    return this.frame;
  }

  public url(): string {
    return this.frame.url();
  }

  public async evaluate(fn: PageFunction, arg: unknown): Promise<unknown> {
    return fn(arg);
  }

  public asPage(): Page {
    return this as unknown as Page;
  }
}

/** Fake Electron app: `evaluate` runs main-process functions against a fake `app` emitter. */
class FakeElectronApp {
  public readonly app = new EventEmitter();

  public async evaluate(fn: MainFunction, arg: unknown): Promise<unknown> {
    return fn({ app: this.app }, arg);
  }

  public asElectronApp(): ElectronApplication {
    return this as unknown as ElectronApplication;
  }
}

describe("startCrashDetection", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  // `markDocument` reads `window` (Node has none): each fresh object is a new document.
  const WINDOW_KEY = "window";

  /** Simulates loading a new document (fresh `window`). */
  function newDocument(): void {
    globals[WINDOW_KEY] = {};
  }

  beforeEach(() => {
    newDocument();
  });

  afterEach(() => {
    delete globals[WINDOW_KEY];
    delete globals[PROCESS_GONE_BUFFER_KEY];
  });

  it("should report a reload only after arming and ignore same-document navigations", async () => {
    // Given detection attached before the runner's own navigation
    const page = new FakePage();
    const detection = await startCrashDetection({ page: page.asPage() });
    newDocument();
    page.emit("framenavigated", page.frame);

    // When the app is ready and armed, the URL is synced in place, then the page reloads
    await detection.arm();
    page.emit("framenavigated", page.frame);
    newDocument();
    page.emit("framenavigated", page.frame);
    const events = await detection.stop();

    // Then only the reload after arming is reported
    expect(events).toEqual([
      expect.objectContaining({
        type: "renderer.reload",
        url: "http://localhost/?scenario=sinewave",
      }),
    ]);
  });

  it("should report a renderer crash", async () => {
    // Given
    const page = new FakePage();
    const detection = await startCrashDetection({ page: page.asPage() });

    // When
    page.emit("crash", page);
    const events = await detection.stop();

    // Then
    expect(events).toEqual([
      expect.objectContaining({ type: "renderer.crash", processType: "renderer" }),
    ]);
  });

  it("should drain Electron process-gone records, ignore clean exits and the shutdown window", async () => {
    // Given
    const page = new FakePage();
    const electron = new FakeElectronApp();
    const detection = await startCrashDetection({
      page: page.asPage(),
      electronApp: electron.asElectronApp(),
    });

    // When a GPU crash and a clean utility exit happen during the run
    electron.app.emit("child-process-gone", {}, { type: "GPU", reason: "crashed", exitCode: 9 });
    electron.app.emit(
      "child-process-gone",
      {},
      { type: "Utility", reason: "clean-exit", exitCode: 0 },
    );
    // And a renderer is killed after the runner started closing
    const stopping = detection.stop();
    electron.app.emit(
      "render-process-gone",
      {},
      { getURL: () => "http://localhost/" },
      { reason: "killed", exitCode: 15 },
    );
    page.emit("crash", page);
    const events = await stopping;

    // Then only the GPU crash is reported
    expect(events).toEqual([
      expect.objectContaining({
        type: "process.gone",
        processType: "GPU",
        reason: "crashed",
        exitCode: 9,
      }),
    ]);
  });
});
