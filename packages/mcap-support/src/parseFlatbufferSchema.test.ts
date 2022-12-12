// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ByteBuffer, Builder } from "flatbuffers";
import { Schema, BaseType, Type } from "flatbuffers_reflection";
import fs from "fs";

import { ByteVector } from "./fixtures/byte-vector";
import { parseFlatbufferSchema } from "./parseFlatbufferSchema";

const enumSchema = {
  definitions: [
    {
      isArray: true,
      isComplex: true,
      name: "attributes",
      type: "reflection.KeyValue",
    },
    {
      name: "declaration_file",
      type: "string",
    },
    {
      isArray: true,
      name: "documentation",
      type: "string",
    },
    {
      name: "is_union",
      type: "bool",
    },
    {
      name: "name",
      type: "string",
    },
    {
      isComplex: true,
      name: "underlying_type",
      type: "reflection.Type",
    },
    {
      isArray: true,
      isComplex: true,
      name: "values",
      type: "reflection.EnumVal",
    },
  ],
};
const typeSchema = {
  definitions: [
    {
      name: "base_size",
      type: "uint32",
    },
    {
      isConstant: true,
      name: "None",
      type: "int8",
      value: 0n,
    },
    {
      isConstant: true,
      name: "UType",
      type: "int8",
      value: 1n,
    },
    {
      isConstant: true,
      name: "Bool",
      type: "int8",
      value: 2n,
    },
    {
      isConstant: true,
      name: "Byte",
      type: "int8",
      value: 3n,
    },
    {
      isConstant: true,
      name: "UByte",
      type: "int8",
      value: 4n,
    },
    {
      isConstant: true,
      name: "Short",
      type: "int8",
      value: 5n,
    },
    {
      isConstant: true,
      name: "UShort",
      type: "int8",
      value: 6n,
    },
    {
      isConstant: true,
      name: "Int",
      type: "int8",
      value: 7n,
    },
    {
      isConstant: true,
      name: "UInt",
      type: "int8",
      value: 8n,
    },
    {
      isConstant: true,
      name: "Long",
      type: "int8",
      value: 9n,
    },
    {
      isConstant: true,
      name: "ULong",
      type: "int8",
      value: 10n,
    },
    {
      isConstant: true,
      name: "Float",
      type: "int8",
      value: 11n,
    },
    {
      isConstant: true,
      name: "Double",
      type: "int8",
      value: 12n,
    },
    {
      isConstant: true,
      name: "String",
      type: "int8",
      value: 13n,
    },
    {
      isConstant: true,
      name: "Vector",
      type: "int8",
      value: 14n,
    },
    {
      isConstant: true,
      name: "Obj",
      type: "int8",
      value: 15n,
    },
    {
      isConstant: true,
      name: "Union",
      type: "int8",
      value: 16n,
    },
    {
      isConstant: true,
      name: "Array",
      type: "int8",
      value: 17n,
    },
    {
      isConstant: true,
      name: "MaxBaseType",
      type: "int8",
      value: 18n,
    },
    {
      name: "base_type",
      type: "int8",
    },
    {
      isConstant: true,
      name: "None",
      type: "int8",
      value: 0n,
    },
    {
      isConstant: true,
      name: "UType",
      type: "int8",
      value: 1n,
    },
    {
      isConstant: true,
      name: "Bool",
      type: "int8",
      value: 2n,
    },
    {
      isConstant: true,
      name: "Byte",
      type: "int8",
      value: 3n,
    },
    {
      isConstant: true,
      name: "UByte",
      type: "int8",
      value: 4n,
    },
    {
      isConstant: true,
      name: "Short",
      type: "int8",
      value: 5n,
    },
    {
      isConstant: true,
      name: "UShort",
      type: "int8",
      value: 6n,
    },
    {
      isConstant: true,
      name: "Int",
      type: "int8",
      value: 7n,
    },
    {
      isConstant: true,
      name: "UInt",
      type: "int8",
      value: 8n,
    },
    {
      isConstant: true,
      name: "Long",
      type: "int8",
      value: 9n,
    },
    {
      isConstant: true,
      name: "ULong",
      type: "int8",
      value: 10n,
    },
    {
      isConstant: true,
      name: "Float",
      type: "int8",
      value: 11n,
    },
    {
      isConstant: true,
      name: "Double",
      type: "int8",
      value: 12n,
    },
    {
      isConstant: true,
      name: "String",
      type: "int8",
      value: 13n,
    },
    {
      isConstant: true,
      name: "Vector",
      type: "int8",
      value: 14n,
    },
    {
      isConstant: true,
      name: "Obj",
      type: "int8",
      value: 15n,
    },
    {
      isConstant: true,
      name: "Union",
      type: "int8",
      value: 16n,
    },
    {
      isConstant: true,
      name: "Array",
      type: "int8",
      value: 17n,
    },
    {
      isConstant: true,
      name: "MaxBaseType",
      type: "int8",
      value: 18n,
    },
    {
      name: "element",
      type: "int8",
    },
    {
      name: "element_size",
      type: "uint32",
    },
    {
      name: "fixed_length",
      type: "uint16",
    },
    {
      name: "index",
      type: "int32",
    },
  ],
};

describe("parseFlatbufferSchema", () => {
  it("rejects invalid schema", () => {
    expect(() => parseFlatbufferSchema("test", new Uint8Array([1]))).toThrow();
  });
  it("parses root table schema", () => {
    // Use the reflection Schema itself to read the reflection Schema (this is
    // actually a pretty good test case for coverage, since the Schema message
    // includes almost all the various flatbuffer features).
    // The .bfbs file in question is generated from running
    // $ flatc -b --schema reflection/reflection.fbs
    // In https://github.com/google/flatbuffers
    const reflectionSchemaBuffer: Buffer = fs.readFileSync(`${__dirname}/fixtures/reflection.bfbs`);
    const { datatypes, deserializer } = parseFlatbufferSchema(
      "reflection.Schema",
      reflectionSchemaBuffer,
    );
    const deserialized: any = deserializer(reflectionSchemaBuffer);
    const reflectionSchemaByteBuffer: ByteBuffer = new ByteBuffer(reflectionSchemaBuffer);
    const schema = Schema.getRootAsSchema(reflectionSchemaByteBuffer);
    // Spot check individual components to ensure that they got deserialized correctly.
    expect(deserialized.objects.length).toEqual(schema.objectsLength());
    expect(deserialized.objects.length).toEqual(10);
    expect(deserialized.objects[0].name).toEqual("reflection.Enum");
    expect(deserialized.file_ident).toEqual("BFBS");
    expect(deserialized.file_ext).toEqual("bfbs");
    expect(deserialized.fbs_files[0].filename.substr(-14)).toEqual("reflection.fbs");
    // Spot check the datatypes list.
    expect(datatypes.keys()).toContain("reflection.Enum");
    expect(datatypes.keys()).toContain("reflection.Object");
    expect(datatypes.get("reflection.Enum")).toEqual(enumSchema);
  });
  it("parses non-root table schema", () => {
    const reflectionSchemaBuffer: Buffer = fs.readFileSync(`${__dirname}/fixtures/reflection.bfbs`);
    const { datatypes, deserializer } = parseFlatbufferSchema(
      "reflection.Type",
      reflectionSchemaBuffer,
    );
    expect(datatypes.keys()).toContain("reflection.Type");
    expect(datatypes.get("reflection.Type")).toEqual(typeSchema);

    // Construct a reflection.Type object from scratch and confirm that we get
    // exactly the correct result.
    const builder = new Builder();
    Type.startType(builder);
    Type.addBaseType(builder, BaseType.Int);
    Type.addIndex(builder, 123);
    builder.finish(Type.endType(builder));

    expect(deserializer(builder.asUint8Array())).toEqual({ base_type: 7, index: 123 });
  });
  it("converts uint8 vectors to uint8arrays", () => {
    const builder = new Builder();

    /**
     * Byte Vector Schema (.fbs file not included in this repo)
     * table ByteVector {
     *   data:[uint8];
     * }
     * root_type ByteVector;
     */
    const data = ByteVector.createDataVector(builder, [1, 2, 3]);
    ByteVector.startByteVector(builder);
    ByteVector.addData(builder, data);
    const byteVector = ByteVector.endByteVector(builder);
    builder.finish(byteVector);
    /** the underlying buffer for the builder is larger than the uint8array of the data
     * this needs to be cleared so that the reading from the buffer by the parser doesn't use the wrong offsets
     * normally when this is written to a file, only the contents of the Uint8Array are written, not the underlying buffer
     * so this replicates that
     * essentially need to make sure byteVectorBin.buffer !== builder.asUint8Array().buffer
     */
    const byteVectorBin = Uint8Array.from(builder.asUint8Array());

    const byteVectorSchemaArray = fs.readFileSync(`${__dirname}/fixtures/ByteVector.bfbs`);
    const { deserializer } = parseFlatbufferSchema("ByteVector", byteVectorSchemaArray);
    expect(deserializer(byteVectorBin)).toEqual({ data: new Uint8Array([1, 2, 3]) });
  });
});
