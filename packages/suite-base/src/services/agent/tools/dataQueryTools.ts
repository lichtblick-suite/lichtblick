// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { compare, fromNanoSec, toNanoSec } from "@lichtblick/rostime";
import { MessageEvent, Time } from "@lichtblick/suite";
import { LOG_DATATYPES, normalizedLogMessage } from "@lichtblick/suite-base/panels/Log/conversion";
import type { LogMessageEvent } from "@lichtblick/suite-base/panels/Log/types";
import { LogLevel } from "@lichtblick/suite-base/panels/Log/types";
import { IteratorResult as BatchIteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import {
  optionalDecimalString,
  optionalEnum,
  optionalPositiveInteger,
  requireRecord,
  requireString,
  runDependency,
  type ToolRuntimeDeps,
} from "@lichtblick/suite-base/services/agent/tools/toolRuntime";

/** Hard scan cap shared by read_messages and search_messages. */
export const DATA_QUERY_MAX_SCAN_MESSAGES = 50_000;
/** A single message serializing larger than this is replaced by a field summary. */
export const DATA_QUERY_MAX_SINGLE_MESSAGE_BYTES = 32 * 1024;
/** Stop collecting and mark truncated once collected entries exceed this budget. */
export const DATA_QUERY_MAX_TOTAL_BYTES = 192 * 1024;
/** Nesting depth cap for the controlled serializer. */
const MAX_SERIALIZE_DEPTH = 12;
/** Per-container item/key cap for the controlled serializer. */
const MAX_SERIALIZE_ITEMS = 128;
/** Per-string cap (characters) for the controlled serializer. */
const MAX_SERIALIZE_STRING_CHARS = 4096;
/** Global node cap for one controlled traversal (second line of defense). */
const MAX_SERIALIZE_NODES = 10_000;
/** Global output byte cap (UTF-8) for one controlled traversal. */
const MAX_SERIALIZE_OUTPUT_BYTES = 64 * 1024;
/**
 * Content budget: the byte cap minus a fixed reserve for container closers. Pre-checks use this
 * stricter bound so the 1-byte `}`/`]` closers of up to MAX_SERIALIZE_DEPTH nested containers
 * always fit and the final result never exceeds MAX_SERIALIZE_OUTPUT_BYTES.
 */
const CONTENT_BUDGET = MAX_SERIALIZE_OUTPUT_BYTES - 64;

const TRUNCATED_MARKER = "\"<truncated>\"";

const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal", "unknown"] as const;
type LogLevelName = (typeof LOG_LEVELS)[number];

const LOG_LEVEL_TO_VALUE: Record<LogLevelName, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.FATAL,
  unknown: LogLevel.UNKNOWN,
};

function serializeString(value: string): string {
  if (value.length > MAX_SERIALIZE_STRING_CHARS) {
    return JSON.stringify(`${value.slice(0, MAX_SERIALIZE_STRING_CHARS)}…<truncated>`) ?? "null";
  }
  return JSON.stringify(value) ?? "null";
}

/** Shared traversal budget so a pathological payload cannot blow the node or output caps. */
type SerializeBudget = { bytes: number; nodes: number };

/**
 * Controlled traversal serializer for message payloads. Unlike JSON.stringify with a replacer,
 * the traversal itself is bounded: nesting depth, per-container item/key counts, string lengths,
 * and the global node/UTF-8 byte budgets are capped. Every emitted fragment — punctuation, key
 * names, values — is accounted incrementally, so a container full of huge keys cannot blow the
 * budget before it is measured. Reaching a hard budget stops emission immediately and the result
 * falls back to a legal JSON truncation marker. Property getters are read under try/catch, and
 * undefined/function/symbol values are mapped to explicit markers. The output is always bounded
 * JSON text and never throws.
 */
export function safeSerializeMessage(value: unknown): string {
  return (
    serializeControlled(value, 0, new WeakSet<object>(), { bytes: 0, nodes: 0 }) ??
    TRUNCATED_MARKER
  );
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Pre-checked fragment accounting: returns the fragment when it fits in the remaining byte
 * budget (accounting it), the truncation marker when the fragment does not fit but the marker
 * does, or undefined when nothing more fits — callers stop emitting and close the container, so
 * the final result never exceeds the hard byte budget.
 */
function fitFragment(budget: SerializeBudget, fragment: string): string | undefined {
  const bytes = utf8Length(fragment);
  if (budget.bytes + bytes < CONTENT_BUDGET) {
    budget.bytes += bytes;
    return fragment;
  }
  if (budget.bytes + utf8Length(TRUNCATED_MARKER) < CONTENT_BUDGET) {
    budget.bytes += utf8Length(TRUNCATED_MARKER);
    return TRUNCATED_MARKER;
  }
  return undefined;
}

/** Atom fragments (values, markers): the fragment when it fits, else the truncation marker when
 * it fits, else undefined — callers drop or roll back so nothing unaccounted is ever emitted. */
function emitFragment(budget: SerializeBudget, fragment: string): string | undefined {
  return fitFragment(budget, fragment);
}

/**
 * All-or-nothing append for composite fragments (e.g. truncation count entries that carry their
 * own delimiters): the whole fragment must fit, otherwise nothing is written — a bare truncation
 * marker can never stand in for a composite structure.
 */
function compositeFragment(
  budget: SerializeBudget,
  fragment: string,
): string | undefined {
  if (budget.bytes + utf8Length(fragment) < CONTENT_BUDGET) {
    budget.bytes += utf8Length(fragment);
    return fragment;
  }
  return undefined;
}

function serializeControlled(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  budget: SerializeBudget,
): string | undefined {
  if (depth > MAX_SERIALIZE_DEPTH) {
    return emitFragment(budget, `"<depth-limited>"`);
  }
  if (budget.nodes >= MAX_SERIALIZE_NODES || budget.bytes >= CONTENT_BUDGET) {
    // Hard budgets reached: nothing more may be emitted; the caller drops or rolls back.
    return undefined;
  }
  budget.nodes++;
  if (value == null) {
    return emitFragment(budget, "null");
  }
  switch (typeof value) {
    case "string":
      return emitFragment(budget, serializeString(value));
    case "number":
    case "boolean":
      return emitFragment(budget, JSON.stringify(value) ?? "null");
    case "bigint":
      return emitFragment(budget, JSON.stringify(String(value)) ?? "null");
    case "undefined":
      return emitFragment(budget, "null");
    case "function":
      return emitFragment(budget, `"<function>"`);
    case "symbol":
      return emitFragment(budget, `"<symbol>"`);
    case "object": {
      if (value instanceof ArrayBuffer) {
        return emitFragment(budget, JSON.stringify(`<binary ${value.byteLength} bytes>`) ?? "null");
      }
      if (ArrayBuffer.isView(value)) {
        return emitFragment(budget, JSON.stringify(`<binary ${value.byteLength} bytes>`) ?? "null");
      }
      if (seen.has(value)) {
        return emitFragment(budget, `"<circular>"`);
      }
      seen.add(value);
      let result: string;
      if (value instanceof Map) {
        // Lazy iteration: entries are consumed one at a time and never expanded into an array.
        // The loop breaks at the per-container cap or when the budget refuses the next fragment;
        // the remainder is counted from the size instead of being iterated.
        result = "{";
        budget.bytes += 1;
        let kept = 0;
        for (const [key, entry] of value) {
          if (kept >= MAX_SERIALIZE_ITEMS) {
            break;
          }
          const keyFragment = `${kept > 0 ? "," : ""}${serializeString(String(key))}:`;
          const fittedKey = emitFragment(budget, keyFragment);
          if (fittedKey == undefined || fittedKey === TRUNCATED_MARKER) {
            // A marker cannot stand in for a key; stop writing entries.
            break;
          }
          result += fittedKey;
          const entryText = serializeControlled(entry, depth + 1, seen, budget);
          if (entryText == undefined) {
            // The value could not be emitted: undo the key so the container stays valid.
            result = result.slice(0, -keyFragment.length);
            budget.bytes -= utf8Length(keyFragment);
            break;
          }
          result += entryText;
          kept++;
        }
        const dropped = value.size - kept;
        if (dropped > 0) {
          const fitted = compositeFragment(
            budget,
            `${kept > 0 ? "," : ""}"<truncated>":${dropped}`,
          );
          if (fitted != undefined) {
            result += fitted;
          }
        }
        result += "}";
        budget.bytes += 1;
      } else if (value instanceof Set) {
        result = "[";
        budget.bytes += 1;
        let kept = 0;
        for (const entry of value) {
          if (kept >= MAX_SERIALIZE_ITEMS) {
            break;
          }
          // Recurse first: the comma is only written once the element itself fits, so a failed
          // first element leaves a valid empty container (the open bracket is never undone).
          const entryText = serializeControlled(entry, depth + 1, seen, budget);
          if (entryText == undefined) {
            break;
          }
          if (kept > 0) {
            result += ",";
            budget.bytes += 1;
          }
          result += entryText;
          kept++;
        }
        const dropped = value.size - kept;
        if (dropped > 0) {
          const fitted = compositeFragment(
            budget,
            `${kept > 0 ? "," : ""}{"<truncated>":${dropped}}`,
          );
          if (fitted != undefined) {
            result += fitted;
          }
        }
        result += "]";
        budget.bytes += 1;
      } else if (Array.isArray(value)) {
        const keptItems = value.slice(0, MAX_SERIALIZE_ITEMS);
        const dropped = value.length - keptItems.length;
        const body: string[] = [];
        for (const entry of keptItems) {
          if (budget.bytes >= CONTENT_BUDGET) {
            break;
          }
          if (body.length > 0) {
            body.push(",");
            budget.bytes += 1;
          }
          const entryText = serializeControlled(entry, depth + 1, seen, budget);
          if (entryText == undefined) {
            if (body.length > 0) {
              body.pop();
              budget.bytes -= 1;
            }
            break;
          }
          body.push(entryText);
        }
        result = `[${body.join("")}`;
        if (dropped > 0) {
          const fitted = compositeFragment(
            budget,
            `${body.length > 0 ? "," : ""}{"<truncated>":${dropped}}`,
          );
          if (fitted != undefined) {
            result += fitted;
          }
        }
        result += "]";
        budget.bytes += 1;
      } else {
        const allKeys = Object.keys(value);
        const keys = allKeys.slice(0, MAX_SERIALIZE_ITEMS);
        result = "{";
        budget.bytes += 1;
        let written = 0;
        for (const key of keys) {
          const keyFragment = `${written > 0 ? "," : ""}${serializeString(key)}:`;
          const fittedKey = emitFragment(budget, keyFragment);
          if (fittedKey == undefined || fittedKey === TRUNCATED_MARKER) {
            // A marker cannot stand in for a key; stop writing entries.
            break;
          }
          result += fittedKey;
          let entry: unknown;
          try {
            entry = (value as Record<string, unknown>)[key];
          } catch {
            const fittedError = emitFragment(budget, `"<getter-error>"`);
            if (fittedError == undefined) {
              result = result.slice(0, -keyFragment.length);
              budget.bytes -= utf8Length(keyFragment);
              break;
            }
            result += fittedError;
            written++;
            continue;
          }
          const entryText = serializeControlled(entry, depth + 1, seen, budget);
          if (entryText == undefined) {
            // The value could not be emitted: undo the key so the container stays valid.
            result = result.slice(0, -keyFragment.length);
            budget.bytes -= utf8Length(keyFragment);
            break;
          }
          result += entryText;
          written++;
        }
        const dropped = allKeys.length - written;
        if (dropped > 0) {
          const fitted = compositeFragment(
            budget,
            `${written > 0 ? "," : ""}"<truncated>":${dropped}`,
          );
          if (fitted != undefined) {
            result += fitted;
          }
        }
        result += "}";
        budget.bytes += 1;
      }
      // Note: `seen` is deliberately NOT cleared after a container. Repeated references to the
      // same object are emitted as "<circular>" markers instead of being re-traversed, which
      // keeps pathological shared structures from exploding the traversal.
      return result;
    }
    default:
      return emitFragment(budget, "null");
  }
}
function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isLogDatatype(schemaName: string): boolean {
  return (LOG_DATATYPES as readonly string[]).includes(schemaName);
}

/**
 * Iterates a batch iterator with honest interruption semantics: `getBatchIterator` does not
 * accept a signal, so a blocked `next()` cannot be interrupted. Aborts are checked before and
 * after each `next()`; when aborted while a `next()` is still pending, the main flow is already
 * rejected by runDependency, and a detached cleanup chain releases the iterator once that
 * `next()` settles. `iterator.return()` is idempotent and always called.
 */
async function iterateMessages(
  iterator: AsyncIterableIterator<Readonly<BatchIteratorResult>>,
  signal: AbortSignal | undefined,
  onMessage: (msgEvent: MessageEvent) => boolean,
): Promise<{ scanned: number; limitHit: boolean; stoppedEarly: boolean }> {
  let scanned = 0;
  let inFlight: Promise<IteratorResult<unknown>> | undefined;
  let cleanedUp = false;
  const cleanup = async (): Promise<void> => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    try {
      await iterator.return?.();
    } catch {
      // A rejected return() must not surface as an unhandled rejection in either the main flow
      // or the detached cleanup chain; the scan result is already decided.
    }
  };

  // Detached cleanup: when aborted while a next() is pending, runDependency rejects the caller's
  // promise immediately, but the iterator chain keeps running in the background. Wait for the
  // in-flight next() to settle, then release the iterator — even if the caller no longer awaits us.
  signal?.addEventListener(
    "abort",
    () => {
      void (async () => {
        try {
          await inFlight;
        } catch {
          // A rejected next() must not break the detached cleanup.
        }
        await cleanup();
      })();
    },
    { once: true },
  );

  try {
    for (;;) {
      // Abort already surfaced to the caller via runDependency; exit quietly so the background
      // chain settles and releases the iterator.
      if (isAborted(signal)) {
        break;
      }
      signal?.throwIfAborted();
      // A blocked next() cannot be interrupted; the lib IteratorResult shape carries done/value.
      inFlight = iterator.next();
      const next: IteratorResult<unknown> = await inFlight;
      inFlight = undefined;
      // Re-read after the awaited next(): the abort may have landed while it was pending.
      if (isAborted(signal)) {
        break;
      }
      // done is `false | undefined` for yield results and `true` for returns; treat anything
      // that is not explicitly a yield as the end of the iteration.
      if (next.done !== false) {
        break;
      }
      // Every yielded item counts toward the scan cap, including alerts and non-message events.
      scanned++;
      const item = next.value as Readonly<BatchIteratorResult>;
      // The item at the cap boundary still participates in matching/collection; only the items
      // after it are refused.
      if (item.type === "message-event") {
        if (!onMessage(item.msgEvent)) {
          return { scanned, limitHit: false, stoppedEarly: true };
        }
      }
      if (scanned >= DATA_QUERY_MAX_SCAN_MESSAGES) {
        return { scanned, limitHit: true, stoppedEarly: false };
      }
      if (item.type !== "message-event") {
        continue;
      }
    }
  } finally {
    await cleanup();
  }
  return { scanned, limitHit: false, stoppedEarly: false };
}

function serializeMessageEntry(msgEvent: MessageEvent): {
  topic: string;
  schemaName: string;
  receiveTimeNs: string;
  message: unknown;
  entryBytes: number;
} {
  const receiveTimeNs = toNanoSec(msgEvent.receiveTime).toString();
  const serialized = safeSerializeMessage(msgEvent.message);
  const messageBytes = utf8ByteLength(serialized);
  if (messageBytes > DATA_QUERY_MAX_SINGLE_MESSAGE_BYTES) {
    const summary = {
      bytes: messageBytes,
      note: "message too large to serialize",
    };
    // The field summary is what actually enters the result; the budget counts the summary, not
    // the raw payload size.
    return {
      topic: msgEvent.topic,
      schemaName: msgEvent.schemaName,
      receiveTimeNs,
      message: summary,
      entryBytes: utf8ByteLength(JSON.stringify(summary) ?? ""),
    };
  }
  return {
    topic: msgEvent.topic,
    schemaName: msgEvent.schemaName,
    receiveTimeNs,
    message: JSON.parse(serialized) as unknown,
    entryBytes: messageBytes,
  };
}

function requireDataQuery(deps: ToolRuntimeDeps): NonNullable<ToolRuntimeDeps["dataQuery"]> {
  if (deps.dataQuery == undefined) {
    throw new Error(
      "No data source is loaded or the workspace does not expose its message pipeline; cannot read messages",
    );
  }
  return deps.dataQuery;
}

function parseTimeRange(
  input: Record<string, unknown>,
  toolName: string,
): { start?: Time; end?: Time } {
  const startNs = optionalDecimalString(input, "start", toolName);
  const endNs = optionalDecimalString(input, "end", toolName);
  return {
    start: startNs == undefined ? undefined : fromNanoSec(BigInt(startNs)),
    end: endNs == undefined ? undefined : fromNanoSec(BigInt(endNs)),
  };
}

/**
 * read_messages: iterates the loaded messages of one topic (optionally bounded by time) and
 * returns their safe serialized contents, subject to the scan and byte budgets.
 */
export async function runReadMessagesTool(
  value: unknown,
  deps: Parameters<typeof requireDataQuery>[0],
  context?: { signal?: AbortSignal },
): Promise<unknown> {
  const toolName = "read_messages";
  const input = requireRecord(value, toolName);
  const topic = requireString(input, "topic", toolName);
  const limit = optionalPositiveInteger(input, "limit", toolName, 100) ?? 100;
  const dataQuery = requireDataQuery(deps);
  const { start, end } = parseTimeRange(input, toolName);
  const signal = context?.signal;

  const iterator = dataQuery
    .getContext()
    .getBatchIterator(topic, start != undefined || end != undefined ? { start, end } : undefined);
  if (iterator == undefined) {
    throw new Error(
      "The loaded data source does not support message iteration (live sources cannot be read); only iterable recordings can be read",
    );
  }

  const messages: unknown[] = [];
  let totalBytes = 0;

  const { limitHit, scanned, stoppedEarly } = await runDependency(
    async () =>
      await iterateMessages(iterator, signal, (msgEvent) => {
        if (messages.length >= limit) {
          return false;
        }
        const entry = serializeMessageEntry(msgEvent);
        if (totalBytes + entry.entryBytes > DATA_QUERY_MAX_TOTAL_BYTES) {
          // Budget exhausted. The first entry is always collected anyway — its field summary is
          // small even when the raw payload is huge — so an oversized single message degrades to
          // a summary instead of being dropped.
          if (messages.length === 0) {
            messages.push({
              topic: entry.topic,
              schemaName: entry.schemaName,
              receiveTimeNs: entry.receiveTimeNs,
              message: entry.message,
            });
          }
          return false;
        }
        totalBytes += entry.entryBytes;
        messages.push({
          topic: entry.topic,
          schemaName: entry.schemaName,
          receiveTimeNs: entry.receiveTimeNs,
          message: entry.message,
        });
        return true;
      }),
    signal,
  );

  return {
    topic,
    count: messages.length,
    scanned,
    // Truncation is the real "did not finish scanning" signal: byte budget, hit limit, or the
    // scan cap — never a complete scan with few hits.
    truncated: stoppedEarly || limitHit,
    overScanLimit: limitHit,
    messages,
  };
}

function normalizedLogText(schemaName: string, msgEvent: MessageEvent): string | undefined {
  if (!isLogDatatype(schemaName)) {
    return undefined;
  }
  const normalized = normalizedLogMessage(schemaName, msgEvent.message as LogMessageEvent["message"]);
  return [normalized.message, normalized.name].filter(Boolean).join(" ").toLowerCase();
}

function messageLevel(schemaName: string, msgEvent: MessageEvent): LogLevel | undefined {
  if (!isLogDatatype(schemaName)) {
    return undefined;
  }
  return normalizedLogMessage(schemaName, msgEvent.message as LogMessageEvent["message"]).level;
}

function messageText(msgEvent: MessageEvent): string {
  return safeSerializeMessage(msgEvent.message).toLowerCase();
}

/**
 * search_messages: scans one topic for messages matching a text substring and/or a log level
 * (at least one required; both act as AND). Log schemas match on the normalized message/name and
 * level; other schemas match the safe-serialized payload text. Hits return the receive time
 * (suitable for seeking) plus a safe summary of the payload.
 */
export async function runSearchMessagesTool(
  value: unknown,
  deps: Parameters<typeof requireDataQuery>[0],
  context?: { signal?: AbortSignal },
): Promise<unknown> {
  const toolName = "search_messages";
  const input = requireRecord(value, toolName);
  const topic = requireString(input, "topic", toolName);
  const text = input.text;
  const level = optionalEnum<LogLevelName>(input, "level", toolName, LOG_LEVELS);
  if (
    (typeof text !== "string" || text.trim().length === 0) &&
    level == undefined
  ) {
    throw new Error(
      `${toolName} requires at least one of "text" or "level"; both are applied as AND when given`,
    );
  }
  if (text != undefined && (typeof text !== "string" || text.trim().length === 0)) {
    throw new Error(`${toolName}.text must be a non-empty string`);
  }
  const textLower = typeof text === "string" ? text.toLowerCase() : "";
  const levelValue = level == undefined ? undefined : LOG_LEVEL_TO_VALUE[level];
  const limit = optionalPositiveInteger(input, "limit", toolName, 20) ?? 20;
  const dataQuery = requireDataQuery(deps);
  const { start, end } = parseTimeRange(input, toolName);
  const signal = context?.signal;

  const iterator = dataQuery
    .getContext()
    .getBatchIterator(topic, start != undefined || end != undefined ? { start, end } : undefined);
  if (iterator == undefined) {
    throw new Error(
      "The loaded data source does not support message iteration (live sources cannot be read); only iterable recordings can be read",
    );
  }

  const hits: unknown[] = [];
  let totalBytes = 0;

  const { limitHit, scanned, stoppedEarly } = await runDependency(
    async () =>
      await iterateMessages(iterator, signal, (msgEvent) => {
        const matchesLevel =
          levelValue == undefined ||
          (messageLevel(msgEvent.schemaName, msgEvent) ?? LogLevel.UNKNOWN) === levelValue;
        if (!matchesLevel) {
          return true;
        }
        if (textLower.length > 0) {
          const logText = normalizedLogText(msgEvent.schemaName, msgEvent);
          const searchable = logText ?? messageText(msgEvent);
          if (!searchable.includes(textLower)) {
            return true;
          }
        }
        if (hits.length >= limit) {
          return false;
        }
        const entry = serializeMessageEntry(msgEvent);
        if (totalBytes + entry.entryBytes > DATA_QUERY_MAX_TOTAL_BYTES) {
          if (hits.length === 0) {
            hits.push({
              receiveTimeNs: entry.receiveTimeNs,
              message: entry.message,
            });
          }
          return false;
        }
        totalBytes += entry.entryBytes;
        hits.push({
          // receiveTime is the seekable timestamp — the message-internal stamp is not used.
          receiveTimeNs: entry.receiveTimeNs,
          message: entry.message,
        });
        return true;
      }),
    signal,
  );

  return {
    topic,
    count: hits.length,
    scanned,
    truncated: stoppedEarly || limitHit,
    overScanLimit: limitHit,
    hits,
  };
}

function requireTime(input: Record<string, unknown>, toolName: string): Time {
  const timeNs = optionalDecimalString(input, "time", toolName);
  if (timeNs == undefined) {
    throw new Error(`${toolName}.time is required for action "seek"`);
  }
  return fromNanoSec(BigInt(timeNs));
}

function clampTime(target: Time, start: Time, end: Time): Time {
  if (compare(target, start) < 0) {
    return start;
  }
  if (compare(target, end) > 0) {
    return end;
  }
  return target;
}

/**
 * playback_control: seek/play/pause with per-action gating. seek clamps the requested time to the
 * loaded data range [startTime, endTime] and reports the accepted clamped target; the player
 * state backfills asynchronously, so the returned time is the accepted request, not currentTime.
 */
export async function runPlaybackControlTool(
  value: unknown,
  deps: Parameters<typeof requireDataQuery>[0],
  _context?: { signal?: AbortSignal },
): Promise<unknown> {
  const toolName = "playback_control";
  const input = requireRecord(value, toolName);
  const action = optionalEnum(input, "action", toolName, ["seek", "play", "pause"]);
  if (action == undefined) {
    throw new Error(`${toolName}.action is required`);
  }
  const dataQuery = requireDataQuery(deps);
  const context = dataQuery.getContext();

  switch (action) {
    case "seek": {
      if (context.seekPlayback == undefined) {
        throw new Error(
          "playback_control: seek is unavailable (the player does not support playback control)",
        );
      }
      const { activeData } = context.playerState;
      const startTime = activeData?.startTime;
      const endTime = activeData?.endTime;
      if (startTime == undefined || endTime == undefined) {
        throw new Error("playback_control: playback data is not ready (no active time range)");
      }
      const requested = requireTime(input, toolName);
      const accepted = clampTime(requested, startTime, endTime);
      context.seekPlayback(accepted);
      // seekPlayback returns void and the player state backfills asynchronously: report the
      // accepted clamped target time, not a claimed currentTime.
      return { action: "seek", acceptedTimeNs: toNanoSec(accepted).toString() };
    }
    case "play": {
      if (context.startPlayback == undefined) {
        throw new Error(
          "playback_control: play is unavailable (the player does not support playback control)",
        );
      }
      context.startPlayback();
      return { action: "play" };
    }
    case "pause": {
      if (context.pausePlayback == undefined) {
        throw new Error(
          "playback_control: pause is unavailable (the player does not support playback control)",
        );
      }
      context.pausePlayback();
      return { action: "pause" };
    }
    default:
      throw new Error(`${toolName}.action must be one of: seek, play, pause`);
  }
}
