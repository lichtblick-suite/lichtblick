// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapWriter } from "@mcap/core";
import type { IWritable } from "@mcap/core";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_MCAP_FIXTURE_OPTIONS,
  MCAP_FIXTURE_GENERATOR_VERSION,
  MCAP_FIXTURE_MANIFEST,
  MCAP_FIXTURE_MESSAGE_SCHEMA,
  MCAP_FIXTURE_START_TIME_NS,
} from "./constants";
import type { FixtureManifest, ResolvedOptions } from "./generateMcapFixtures.types";
import type { McapFixtureOptions } from "./types";

// Deterministic MCAP fixtures for the `mcap-multi-ingest` scenario.
//
// Generated at test time instead of being committed, so the repository carries no binary fixtures
// (the generator itself is MPL-2.0 like the rest of the code). Every file spans the SAME time range
// so a merged multi-file iteration keeps several sources pinned at once; with
// `maxHydratedSources=1` this drives the `HydratedSourcePool` over budget (evictions/rehydrations).

function resolveOptions(opts: McapFixtureOptions | undefined): ResolvedOptions {
  return { ...DEFAULT_MCAP_FIXTURE_OPTIONS, ...opts };
}

function optionsHash(options: ResolvedOptions): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ version: MCAP_FIXTURE_GENERATOR_VERSION, ...options }))
    .digest("hex");
}

/** Deterministic printable payload of `length` characters for one file. */
function buildPayload(fileIndex: number, length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet.charAt((i * 7 + fileIndex * 13) % alphabet.length);
  }
  return result;
}

/** Sequential `IWritable` over a file descriptor. */
class FileWritable implements IWritable {
  readonly #fd: number;
  #position = 0n;

  public constructor(fd: number) {
    this.#fd = fd;
  }

  public position(): bigint {
    return this.#position;
  }

  public async write(buffer: Uint8Array): Promise<void> {
    let offset = 0;
    while (offset < buffer.byteLength) {
      offset += fs.writeSync(this.#fd, buffer, offset, buffer.byteLength - offset);
    }
    this.#position += BigInt(buffer.byteLength);
  }
}

export function getMcapFixtureFileName(fileIndex: number): string {
  return `multi-${fileIndex}.mcap`;
}

async function writeFixtureFile(
  filePath: string,
  fileIndex: number,
  options: ResolvedOptions,
): Promise<void> {
  const fd = fs.openSync(filePath, "w");
  try {
    const writer = new McapWriter({
      writable: new FileWritable(fd),
      useChunks: true,
      useChunkIndex: true,
      useMessageIndex: true,
      useStatistics: true,
      useSummaryOffsets: true,
      chunkSize: options.chunkSize,
    });
    await writer.start({ profile: "", library: "lichtblick-benchmark-fixtures" });
    const schemaId = await writer.registerSchema({
      name: "benchmark.Multi",
      encoding: "jsonschema",
      data: new TextEncoder().encode(JSON.stringify(MCAP_FIXTURE_MESSAGE_SCHEMA)),
    });
    const channelId = await writer.registerChannel({
      schemaId,
      topic: options.topic,
      messageEncoding: "json",
      metadata: new Map(),
    });

    const encoder = new TextEncoder();
    const payload = buildPayload(fileIndex, options.payloadBytes);
    const messageCount = Math.round(options.durationSec * options.rateHz);
    const periodNs = BigInt(Math.round(1e9 / options.rateHz));
    for (let seq = 0; seq < messageCount; seq++) {
      const t = seq / options.rateHz;
      const value = Math.sin(t * (1 + fileIndex)) + fileIndex;
      const logTime = MCAP_FIXTURE_START_TIME_NS + BigInt(seq) * periodNs;
      await writer.addMessage({
        channelId,
        sequence: seq,
        logTime,
        publishTime: logTime,
        data: encoder.encode(JSON.stringify({ value, seq, payload })),
      });
    }
    await writer.end();
  } finally {
    fs.closeSync(fd);
  }
}

function readManifest(dir: string): FixtureManifest | undefined {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dir, MCAP_FIXTURE_MANIFEST), "utf-8"),
    ) as FixtureManifest;
  } catch {
    return undefined;
  }
}

function isUpToDate(dir: string, manifest: FixtureManifest | undefined, hash: string): boolean {
  if (manifest?.hash !== hash) {
    return false;
  }
  return manifest.files.every((file) => {
    try {
      return fs.statSync(path.join(dir, file.name)).size === file.size;
    } catch {
      return false;
    }
  });
}

/**
 * Generates the fixtures into `dir` (created if needed) and returns their file names. Idempotent:
 * when `dir/manifest.json` matches the options hash and every listed file has the recorded size,
 * nothing is rewritten. Files are written to a temp name and renamed, so an interrupted run never
 * leaves a truncated fixture behind a valid manifest.
 */
export async function generateMcapFixtures(
  dir: string,
  opts?: McapFixtureOptions,
): Promise<string[]> {
  const options = resolveOptions(opts);
  const hash = optionsHash(options);
  fs.mkdirSync(dir, { recursive: true });

  const existing = readManifest(dir);
  if (existing != undefined && isUpToDate(dir, existing, hash)) {
    return existing.files.map((file) => file.name);
  }

  const files: FixtureManifest["files"] = [];
  for (let fileIndex = 0; fileIndex < options.fileCount; fileIndex++) {
    const name = getMcapFixtureFileName(fileIndex);
    const finalPath = path.join(dir, name);
    const tmpPath = `${finalPath}.tmp-${process.pid}`;
    await writeFixtureFile(tmpPath, fileIndex, options);
    fs.renameSync(tmpPath, finalPath);
    files.push({ name, size: fs.statSync(finalPath).size });
  }
  const manifest: FixtureManifest = { hash, files };
  fs.writeFileSync(path.join(dir, MCAP_FIXTURE_MANIFEST), JSON.stringify(manifest, undefined, 2));
  return files.map((file) => file.name);
}
