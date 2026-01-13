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
  if (!wasmInitPromise) {
    wasmInitPromise = wasmInit()
      .then(() => {
        wasmInitialized = true;
      })
      .catch((error) => {
        console.error("Failed to initialize WASM module:", error);
        wasmInitPromise = undefined;
      });
  }
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

  // Create WASM decoder lazily on first deserialize call
  let wasmDecoder: ProtobufDecoder | undefined;

  const deserialize = (data: ArrayBufferView) => {
    const buffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    // Try WASM decoder if initialized
    if (wasmInitialized) {
      try {
        if (!wasmDecoder) {
          wasmDecoder = new ProtobufDecoder(schemaData, schemaName);
        }
        return wasmDecoder.decode(buffer);
      } catch (error) {
        console.error("❌ WASM decode failed, falling back to protobufjs:", error);
      }
    }

    // Fallback to protobufjs
    return rootType.toObject(rootType.decode(buffer), { defaults: true });
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
