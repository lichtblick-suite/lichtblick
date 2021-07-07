// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { RosMsgDefinition, RosMsgField } from "@foxglove/rosmsg";

export interface Time {
  // whole seconds
  sec: number;
  // additional nanoseconds past the sec value
  nsec: number;
}

type NamedRosMsgDefinition = {
  name: string;
  definitions: RosMsgField[];
};

// write a Time object to a DataView.
function writeTime(time: Time, view: DataView, offset: number): void {
  view.setUint32(offset, time.sec, true);
  view.setUint32(offset + 4, time.nsec, true);
}

class StandardTypeOffsetCalculator {
  offset = 0;

  // Returns the current offset and increments the next offset by `byteCount`.
  _incrementAndReturn(byteCount: number): number {
    const offset = this.offset;
    this.offset += byteCount;
    return offset;
  }

  // These are not actually used in the StandardTypeWriter, so they must be kept in sync with those implementations.
  json(value: unknown): number {
    return this.string(JSON.stringify(value));
  }

  // The following are used in the StandardTypeWriter.
  string(value: string): number {
    // int32 length
    if (typeof value !== "string") {
      throw new Error(`Expected string but got ${typeof value}`);
    }
    const length = 4 + value.length;
    return this._incrementAndReturn(length);
  }

  bool(): number {
    return this.uint8();
  }

  int8(): number {
    return this._incrementAndReturn(1);
  }

  uint8(): number {
    return this._incrementAndReturn(1);
  }

  int16(): number {
    return this._incrementAndReturn(2);
  }

  uint16(): number {
    return this._incrementAndReturn(2);
  }

  int32(): number {
    return this._incrementAndReturn(4);
  }

  uint32(): number {
    return this._incrementAndReturn(4);
  }

  float32(): number {
    return this._incrementAndReturn(4);
  }

  float64(): number {
    return this._incrementAndReturn(8);
  }

  int64(): number {
    return this._incrementAndReturn(8);
  }

  uint64(): number {
    return this._incrementAndReturn(8);
  }

  time(): number {
    return this._incrementAndReturn(8);
  }

  duration(): number {
    return this._incrementAndReturn(8);
  }
}

// this has hard-coded data writing functions for each
// of the standard message types http://docs.ros.org/api/std_msgs/html/index-msg.html
// eventually custom types decompose into these standard types
class StandardTypeWriter {
  data: Uint8Array;
  view: DataView;
  textEncoder?: TextEncoder;
  offsetCalculator: StandardTypeOffsetCalculator;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.offsetCalculator = new StandardTypeOffsetCalculator();
  }

  json(value: unknown): void {
    this.string(JSON.stringify(value));
  }

  string(value: string): void {
    if (this.textEncoder == undefined) {
      this.textEncoder = new TextEncoder();
    }
    const stringOffset = this.offsetCalculator.string(value);
    this.view.setInt32(stringOffset, value.length, true);
    this.textEncoder.encodeInto(value, this.data.subarray(stringOffset + 4));
  }

  bool(value: boolean): void {
    this.uint8(value ? 1 : 0);
  }

  int8(value: number): void {
    this.view.setInt8(this.offsetCalculator.int8(), value);
  }

  uint8(value: number): void {
    this.view.setUint8(this.offsetCalculator.uint8(), value);
  }

  int16(value: number): void {
    this.view.setInt16(this.offsetCalculator.int16(), value, true);
  }

  uint16(value: number): void {
    this.view.setUint16(this.offsetCalculator.uint16(), value, true);
  }

  int32(value: number): void {
    this.view.setInt32(this.offsetCalculator.int32(), value, true);
  }

  uint32(value: number): void {
    this.view.setUint32(this.offsetCalculator.uint32(), value, true);
  }

  float32(value: number): void {
    this.view.setFloat32(this.offsetCalculator.float32(), value, true);
  }

  float64(value: number): void {
    this.view.setFloat64(this.offsetCalculator.float64(), value, true);
  }

  int64(value: bigint | number): void {
    if (typeof value !== "bigint") {
      value = BigInt(value);
    }
    this.view.setBigInt64(this.offsetCalculator.int64(), value, true);
  }

  uint64(value: bigint | number): void {
    if (typeof value !== "bigint") {
      value = BigInt(value);
    }
    this.view.setBigUint64(this.offsetCalculator.uint64(), value, true);
  }

  time(time: Time): void {
    writeTime(time, this.view, this.offsetCalculator.time());
  }

  duration(time: Time): void {
    writeTime(time, this.view, this.offsetCalculator.time());
  }
}

const findTypeByName = (types: RosMsgDefinition[], name = ""): NamedRosMsgDefinition => {
  let foundName = ""; // track name separately in a non-null variable to appease Flow
  const matches = types.filter((type) => {
    const typeName = type.name ?? "";
    // if the search is empty, return unnamed types
    if (name.length === 0) {
      return typeName.length === 0;
    }
    // return if the search is in the type name
    // or matches exactly if a fully-qualified name match is passed to us
    const nameEnd = name.includes("/") ? name : `/${name}`;
    if (typeName.endsWith(nameEnd)) {
      foundName = typeName;
      return true;
    }
    return false;
  });
  if (matches.length !== 1) {
    throw new Error(
      `Expected 1 top level type definition for '${name}' but found ${matches.length}.`,
    );
  }
  return { ...matches[0]!, name: foundName };
};

const friendlyName = (name: string): string => name.replace(/\//g, "_");
type WriterAndSizeCalculator = {
  writer: (message: unknown, output: Uint8Array) => Uint8Array;
  byteSizeCalculator: (message: unknown) => number;
};

function createWriterAndSizeCalculator(types: RosMsgDefinition[]): WriterAndSizeCalculator {
  const unnamedTypes = types.filter((type) => type.name == undefined);
  if (unnamedTypes.length !== 1) {
    throw new Error("multiple unnamed types");
  }

  const unnamedType = unnamedTypes[0]!;

  const namedTypes: NamedRosMsgDefinition[] = types.filter(
    (type) => type.name != undefined,
  ) as NamedRosMsgDefinition[];

  const constructorBody = (
    type: RosMsgDefinition | NamedRosMsgDefinition,
    argName: "offsetCalculator" | "writer",
  ): string | undefined => {
    const lines: string[] = [];
    type.definitions.forEach((def) => {
      if (def.isConstant ?? false) {
        return;
      }

      // Accesses the field we are currently writing. Pulled out for easy reuse.
      const accessMessageField = `message["${def.name}"]`;
      if (def.isArray ?? false) {
        const lenField = `length_${def.name}`;
        // set a variable pointing to the parsed fixed array length
        // or write the byte indicating the dynamic length
        if (def.arrayLength != undefined) {
          lines.push(`var ${lenField} = ${def.arrayLength};`);
        } else {
          lines.push(`var ${lenField} = ${accessMessageField}.length;`);
          lines.push(`${argName}.uint32(${lenField});`);
        }

        // start the for-loop
        lines.push(`for (var i = 0; i < ${lenField}; i++) {`);
        // if the sub type is complex we need to allocate it and parse its values
        if (def.isComplex ?? false) {
          const defType = findTypeByName(types, def.type);
          // recursively call the function for the sub-type
          lines.push(`  ${friendlyName(defType.name)}(${argName}, ${accessMessageField}[i]);`);
        } else {
          // if the subtype is not complex its a simple low-level operation
          lines.push(`  ${argName}.${def.type}(${accessMessageField}[i]);`);
        }
        lines.push("}"); // close the for-loop
      } else if (def.isComplex ?? false) {
        const defType = findTypeByName(types, def.type);
        lines.push(`${friendlyName(defType.name)}(${argName}, ${accessMessageField});`);
      } else {
        // Call primitives directly.
        lines.push(`${argName}.${def.type}(${accessMessageField});`);
      }
    });
    return lines.join("\n    ");
  };

  let writerJs = "";
  let calculateSizeJs = "";

  namedTypes.forEach((t) => {
    writerJs += `
  function ${friendlyName(t.name)}(writer, message) {
    ${constructorBody(t, "writer")}
  };\n`;
    calculateSizeJs += `
  function ${friendlyName(t.name)}(offsetCalculator, message) {
    ${constructorBody(t, "offsetCalculator")}
  };\n`;
  });

  writerJs += `
  return function write(writer, message) {
    ${constructorBody(unnamedType, "writer")}
    return writer.data;
  };`;
  calculateSizeJs += `
  return function calculateSize(offsetCalculator, message) {
    ${constructorBody(unnamedType, "offsetCalculator")}
    return offsetCalculator.offset;
  };`;

  let write: (writer: StandardTypeWriter, message: unknown) => Uint8Array;
  let calculateSize: (offsetCalculator: StandardTypeOffsetCalculator, message: unknown) => number;
  try {
    // eslint-disable-next-line no-eval
    write = eval(`(function buildWriter() { ${writerJs} })()`);
  } catch (e) {
    console.error("error building writer:", writerJs);
    throw e;
  }
  try {
    // eslint-disable-next-line no-eval
    calculateSize = eval(`(function buildSizeCalculator() { ${calculateSizeJs} })()`);
  } catch (e) {
    console.error("error building size calculator:", calculateSizeJs);
    throw e;
  }

  return {
    writer(message: unknown, data: Uint8Array): Uint8Array {
      const writer = new StandardTypeWriter(data);
      return write(writer, message);
    },
    byteSizeCalculator(message: unknown): number {
      const offsetCalculator = new StandardTypeOffsetCalculator();
      return calculateSize(offsetCalculator, message);
    },
  };
}

export class MessageWriter {
  writer: (message: unknown, output: Uint8Array) => Uint8Array;
  byteSizeCalculator: (message: unknown) => number;

  // takes an object string message definition and returns
  // a message writer which can be used to write messages based
  // on the message definition
  constructor(definitions: RosMsgDefinition[]) {
    const { writer, byteSizeCalculator } = createWriterAndSizeCalculator(definitions);
    this.writer = writer;
    this.byteSizeCalculator = byteSizeCalculator;
  }

  // Calculates the byte size needed to write this message in bytes.
  calculateByteSize(message: unknown): number {
    return this.byteSizeCalculator(message);
  }

  // output is optional - if it is not provided, a Uint8Array will be generated.
  writeMessage(message: unknown, output?: Uint8Array): Uint8Array {
    if (output == undefined) {
      const dataSize = this.calculateByteSize(message);
      output = new Uint8Array(dataSize);
    }
    return this.writer(message, output);
  }
}
