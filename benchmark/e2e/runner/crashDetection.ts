// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Runner-side crash / OOM / reload detection. A run whose renderer crashed, whose (Electron) child
// process died or whose page reloaded measured something else than the scenario, so `runScenario`
// fails it, after writing the v1 result with the `runnerEvents` as evidence.
//
// - `page.on("crash")` (web and Electron)                  → `renderer.crash`
// - Electron main `app.on("render-process-gone")`          → `process.gone` (processType "renderer")
// - Electron main `app.on("child-process-gone")`           → `process.gone` (processType details.type)
//   (`reason === "clean-exit"` is ignored)
// - main-frame `framenavigated` to a new document, armed   → `renderer.reload`
//
// Clock: the page clock (`lichtblickTelemetry.now()`) is unavailable exactly when these events
// happen (crashed or reloading page), so events are stamped with `performance.timeOrigin +
// performance.now()` of the observing process: the runner (Node) for page events, the Electron main
// process for `*-process-gone`. That is the same formula as the page clock and all three are
// anchored to the Unix epoch, so they share the host samples' timeline up to the processes'
// time-origin skew (typically well below 1 ms, never more than a few ms).
//
// Shutdown: `stop()` marks the start of the runner's own closing. Page listeners are removed and
// main-process events stamped at or after that instant are dropped. The runner must call `stop()`
// before it closes the app: anything later (app/browser close) is never collected.

import type { ElectronApplication, Frame, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { DOCUMENT_MARKER_KEY, PROCESS_GONE_BUFFER_KEY } from "./constants";
import type { CrashDetection, ProcessGoneRecord } from "./types";
import type { RunnerEvent } from "../result/schemaV1";

/** Runner (Node) clock, see the module comment. */
export function runnerNow(): number {
  return performance.timeOrigin + performance.now();
}

/**
 * Maps a main-process `*-process-gone` record to a `process.gone` runner event, or undefined for a
 * normal exit (`reason === "clean-exit"`).
 */
export function mapProcessGoneRecord(record: ProcessGoneRecord): RunnerEvent | undefined {
  if (record.reason === "clean-exit") {
    return undefined;
  }
  const event: RunnerEvent = {
    type: "process.gone",
    monotonicTs: record.monotonicTs,
    reason: record.reason,
    processType: record.source === "render-process-gone" ? "renderer" : record.type,
    exitCode: record.exitCode,
  };
  if (record.source === "render-process-gone" && record.url != undefined && record.url !== "") {
    event.url = record.url;
  }
  return event;
}

/**
 * Whether a main-frame navigation is an unexpected reload: only once armed (initial runner
 * navigation done and app ready), before the runner starts closing, and only for a new document
 * (`history.replaceState` URL syncing also fires `framenavigated`).
 */
export function isUnexpectedReload({
  armed,
  closing,
  isMainFrame,
  newDocument,
}: {
  armed: boolean;
  closing: boolean;
  isMainFrame: boolean;
  newDocument: boolean;
}): boolean {
  return armed && !closing && isMainFrame && newDocument;
}

/**
 * Drops events at or after the start of the runner's own shutdown (`closingStartedAt`, undefined →
 * keep all) and sorts the rest by `monotonicTs`.
 */
export function filterRunnerEvents(
  events: readonly RunnerEvent[],
  { closingStartedAt }: { closingStartedAt: number | undefined },
): RunnerEvent[] {
  return events
    .filter((event) => closingStartedAt == undefined || event.monotonicTs < closingStartedAt)
    .sort((a, b) => a.monotonicTs - b.monotonicTs);
}

/** Failure message for the runner events, or undefined if there are none. */
export function formatRunnerEventsFailure({
  label,
  events,
  resultPath,
}: {
  label: string;
  events: readonly RunnerEvent[];
  resultPath?: string;
}): string | undefined {
  if (events.length === 0) {
    return undefined;
  }
  const lines = events.map((event) => {
    const details = [
      event.processType,
      event.reason == undefined ? undefined : `reason=${event.reason}`,
      event.exitCode == undefined ? undefined : `exitCode=${event.exitCode}`,
      event.url,
    ].filter((part) => part != undefined);
    const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
    return `  - ${event.type}${suffix}`;
  });
  const noun = events.length === 1 ? "runner event" : "runner events";
  return [
    `${label}: ${events.length} ${noun} (crash/process gone/reload), the run did not measure the scenario:`,
    ...lines,
    ...(resultPath == undefined ? [] : [`  result: ${resultPath}`]),
  ].join("\n");
}

/**
 * Installs the Electron main-process listeners (once per app; a re-install clears the buffer so
 * a run never sees an earlier run's records). Serialized into the main process: self-contained.
 */
async function installProcessGoneListeners(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ app }, key) => {
    const store = globalThis as unknown as Record<string, ProcessGoneRecord[] | undefined>;
    const existing = store[key];
    if (existing != undefined) {
      existing.length = 0;
      return;
    }
    const buffer: ProcessGoneRecord[] = [];
    store[key] = buffer;
    // Main-process clock: same formula as the page clock and the runner (see `crashDetection.ts`).
    const now = () => performance.timeOrigin + performance.now();
    app.on("render-process-gone", (_event, webContents, details) => {
      let url: string | undefined;
      try {
        url = webContents.getURL();
      } catch {
        url = undefined;
      }
      buffer.push({
        source: "render-process-gone",
        monotonicTs: now(),
        reason: details.reason,
        exitCode: details.exitCode,
        url,
      });
    });
    app.on("child-process-gone", (_event, details) => {
      buffer.push({
        source: "child-process-gone",
        monotonicTs: now(),
        reason: details.reason,
        exitCode: details.exitCode,
        type: details.type,
      });
    });
  }, PROCESS_GONE_BUFFER_KEY);
}

/** Takes (and clears) the main-process buffer. */
async function takeProcessGoneRecords(
  electronApp: ElectronApplication,
): Promise<ProcessGoneRecord[]> {
  return await electronApp.evaluate((_electron, key) => {
    const buffer = (globalThis as unknown as Record<string, ProcessGoneRecord[] | undefined>)[key];
    return buffer == undefined ? [] : buffer.splice(0, buffer.length);
  }, PROCESS_GONE_BUFFER_KEY);
}

/**
 * Marks the document with `token` and returns whether it already carried it (same document).
 * Runs in the page: self-contained.
 */
function markDocument({ key, token }: { key: string; token: string }): boolean {
  const store = window as unknown as Record<string, unknown>;
  const sameDocument = store[key] === token;
  store[key] = token;
  return sameDocument;
}

/**
 * Attaches the crash/reload listeners (and on Electron the main-process listeners). Call before
 * the runner's first navigation; reload detection stays off until `arm()`.
 */
export async function startCrashDetection({
  page,
  electronApp,
}: {
  page: Page;
  electronApp?: ElectronApplication;
}): Promise<CrashDetection> {
  const events: RunnerEvent[] = [];
  const pending = new Set<Promise<void>>();
  const token = randomUUID();
  let armed = false;
  let closingStartedAt: number | undefined;
  let stopped: Promise<RunnerEvent[]> | undefined;

  const track = (task: Promise<void>) => {
    pending.add(task);
    void task.finally(() => pending.delete(task));
  };

  const drainProcessGone = async (): Promise<void> => {
    if (electronApp == undefined) {
      return;
    }
    try {
      for (const record of await takeProcessGoneRecords(electronApp)) {
        const event = mapProcessGoneRecord(record);
        if (event != undefined) {
          events.push(event);
        }
      }
    } catch (error) {
      console.warn("[crashDetection] could not drain Electron process-gone records", error);
    }
  };

  const onCrash = () => {
    if (closingStartedAt != undefined) {
      return;
    }
    events.push({
      type: "renderer.crash",
      monotonicTs: runnerNow(),
      processType: "renderer",
      url: page.url(),
    });
    // Best effort: the main process outlives the renderer, pick up `render-process-gone` early.
    track(drainProcessGone());
  };

  const onFrameNavigated = (frame: Frame) => {
    // State at navigation time: `stop()` may disarm before the new-document check below resolves.
    const armedAtNavigation = armed;
    const isMainFrame = frame === page.mainFrame();
    const closing = closingStartedAt != undefined;
    // Cheap pre-check (no page call) for everything but an armed main-frame navigation.
    if (
      !isUnexpectedReload({ armed: armedAtNavigation, closing, isMainFrame, newDocument: true })
    ) {
      return;
    }
    const monotonicTs = runnerNow();
    const url = frame.url();
    track(
      (async () => {
        let newDocument: boolean;
        try {
          newDocument = !(await frame.evaluate(markDocument, { key: DOCUMENT_MARKER_KEY, token }));
        } catch {
          // Crashed/closed page (reported elsewhere) or a document already replaced again (its own
          // `framenavigated` follows): nothing to report from this navigation.
          return;
        }
        if (
          isUnexpectedReload({
            armed: armedAtNavigation,
            closing: closingStartedAt != undefined && monotonicTs >= closingStartedAt,
            isMainFrame,
            newDocument,
          })
        ) {
          events.push({ type: "renderer.reload", monotonicTs, url });
        }
      })(),
    );
  };

  page.on("crash", onCrash);
  page.on("framenavigated", onFrameNavigated);
  if (electronApp != undefined) {
    try {
      await installProcessGoneListeners(electronApp);
    } catch (error) {
      console.warn("[crashDetection] could not install Electron process-gone listeners", error);
    }
  }

  return {
    arm: async () => {
      await page.evaluate(markDocument, { key: DOCUMENT_MARKER_KEY, token });
      armed = true;
    },
    stop: async () => {
      stopped ??= (async () => {
        closingStartedAt = runnerNow();
        armed = false;
        page.off("crash", onCrash);
        page.off("framenavigated", onFrameNavigated);
        await Promise.all(pending);
        await drainProcessGone();
        return filterRunnerEvents(events, { closingStartedAt });
      })();
      return await stopped;
    },
  };
}
