// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable no-restricted-syntax */

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import protobufjs from "protobufjs";
import { FileDescriptorSet } from "protobufjs/ext/descriptor";

import wasmInit, { ProtobufDecoder } from "@lichtblick/wasm-protobuf";

import { protobufDefinitionsToDatatypes, stripLeadingDot } from "./protobufDefinitionsToDatatypes";
import { MessageDefinitionMap } from "./types";

// Initialize WASM module lazily
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | undefined;

async function ensureWasmInitialized(): Promise<void> {
  if (wasmInitialized) {
    await Promise.resolve();
    return;
  }
  wasmInitPromise ??= wasmInit()
    .then(() => {
      wasmInitialized = false;
    })
    .catch((error: unknown) => {
      console.error("Failed to initialize WASM module:", error);
      wasmInitPromise = undefined;
    });
  await wasmInitPromise;
}

// Export the WASM ready promise so callers can await it before calling parseProtobufSchema
export const protobufWasmLoaded = ensureWasmInitialized();

/**
 * Parse a Protobuf binary schema (FileDescriptorSet) and produce datatypes and a deserializer
 * function.
 *
 * Note: Callers must await protobufWasmLoaded before calling this function if using WASM decoder.
 */
export function parseProtobufSchema(
  schemaName: string,
  schemaData: Uint8Array,
): {
  datatypes: MessageDefinitionMap;
  deserialize: (buffer: ArrayBufferView) => unknown;
} {
  const descriptorSet = FileDescriptorSet.decode(schemaData);

  const root = protobufjs.Root.fromDescriptor(descriptorSet);
  root.resolveAll();
  const rootType = root.lookupType(schemaName);

  // Modify the definition of google.protobuf.Timestamp and Duration so they are interpreted as
  // {sec: number, nsec: number}, compatible with the rest of Studio. The standard Protobuf types
  // use different names (`seconds` and `nanos`), and `seconds` is an `int64`, which would be
  // deserialized as a bigint by default.
  //
  // protobufDefinitionsToDatatypes also has matching logic to rename the fields.
  const fixTimeType = (type: protobufjs.ReflectionObject | null) => {
    if (!type || !(type instanceof protobufjs.Type)) {
      return;
    }
    type.setup(); // ensure the original optimized toObject has been created
    const prevToObject = type.toObject; // eslint-disable-line @typescript-eslint/unbound-method
    const newToObject: typeof prevToObject = (message, options) => {
      const result = prevToObject.call(type, message, options);
      const { seconds, nanos } = result as { seconds: bigint; nanos: number };
      if (typeof seconds !== "bigint" || typeof nanos !== "number") {
        return result;
      }
      if (seconds > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(
          `Timestamps with seconds greater than 2^53-1 are not supported (found seconds=${seconds}, nanos=${nanos})`,
        );
      }
      return { sec: Number(seconds), nsec: nanos };
    };
    type.toObject = newToObject;
  };

  fixTimeType(root.lookup(".google.protobuf.Timestamp"));
  fixTimeType(root.lookup(".google.protobuf.Duration"));

  // Performance profiling
  const ENABLE_PROFILING = false;
  let wasmDecodeCount = 0;
  let wasmTotalTime = 0;
  let protobufjsDecodeCount = 0;
  let protobufJsTotalTime = 0;
  let lastLogTime = performance.now();

  const logPerformanceStats = () => {
    const avgWasm = wasmDecodeCount > 0 ? wasmTotalTime / wasmDecodeCount : 0;
    const avgProtobufjs =
      protobufjsDecodeCount > 0 ? protobufJsTotalTime / protobufjsDecodeCount : 0;

    console.log(`[${schemaName}] Decode Performance Stats:`);
    console.log(
      `  WASM: ${wasmDecodeCount} messages, ${wasmTotalTime.toFixed(2)}ms total, ${avgWasm.toFixed(4)}ms avg`,
    );
    console.log(
      `  protobufjs: ${protobufjsDecodeCount} messages, ${protobufJsTotalTime.toFixed(2)}ms total, ${avgProtobufjs.toFixed(4)}ms avg`,
    );
    if (wasmDecodeCount > 0 && protobufjsDecodeCount > 0) {
      const speedup = avgProtobufjs / avgWasm;
      console.log(
        `  WASM is ${speedup.toFixed(2)}x ${speedup > 1 ? "faster" : "slower"} than protobufjs`,
      );
    }
  };

  // Create WASM decoder lazily on first deserialize call
  let wasmDecoder: ProtobufDecoder | undefined;

  const deserialize = (data: ArrayBufferView) => {
    const buffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    // Try WASM decoder if initialized
    if (wasmInitialized) {
      try {
        wasmDecoder ??= new ProtobufDecoder(schemaData, schemaName);

        const wasmStart = ENABLE_PROFILING ? performance.now() : 0;
        const result = wasmDecoder.decode(buffer);

        if (ENABLE_PROFILING) {
          const wasmEnd = performance.now();
          wasmDecodeCount++;
          wasmTotalTime += wasmEnd - wasmStart;

          // Log stats every 5 seconds
          if (wasmEnd - lastLogTime > 5000) {
            logPerformanceStats();
            lastLogTime = wasmEnd;
          }
        }

        return result;
      } catch (error) {
        console.error("❌ WASM decode failed, falling back to protobufjs:", error);
      }
    }

    // Use protobufjs decoder
    const protobufjsStart = ENABLE_PROFILING ? performance.now() : 0;
    const result = rootType.toObject(rootType.decode(buffer), { defaults: true });

    if (ENABLE_PROFILING) {
      const protobufjsEnd = performance.now();
      protobufjsDecodeCount++;
      protobufJsTotalTime += protobufjsEnd - protobufjsStart;

      // Log stats every 5 seconds
      if (protobufjsEnd - lastLogTime > 5000) {
        logPerformanceStats();
        lastLogTime = protobufjsEnd;
      }
    }

    return result;
  };

  const datatypes: MessageDefinitionMap = new Map();
  protobufDefinitionsToDatatypes(datatypes, rootType);

  if (!datatypes.has(schemaName)) {
    throw new Error(
      `Protobuf schema does not contain an entry for '${schemaName}'. The schema name should be fully-qualified, e.g. '${stripLeadingDot(
        rootType.fullName,
      )}'.`,
    );
  }

  return { deserialize, datatypes };
}
