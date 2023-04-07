// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import fs from "fs";
import { FileDescriptorSet, IFileDescriptorSet } from "protobufjs/ext/descriptor";

import { parseChannel } from "./parseChannel";

describe("parseChannel", () => {
  it("works with json/jsonschema", () => {
    const channel = parseChannel({
      messageEncoding: "json",
      schema: {
        name: "X",
        encoding: "jsonschema",
        data: new TextEncoder().encode(
          JSON.stringify({ type: "object", properties: { value: { type: "string" } } }),
        ),
      },
    });
    expect(channel.deserialize(new TextEncoder().encode(JSON.stringify({ value: "hi" })))).toEqual({
      value: "hi",
    });
  });

  it("works with flatbuffer", () => {
    const reflectionSchema = fs.readFileSync(`${__dirname}/fixtures/reflection.bfbs`);
    const channel = parseChannel({
      messageEncoding: "flatbuffer",
      schema: { name: "reflection.Schema", encoding: "flatbuffer", data: reflectionSchema },
    });
    const deserialized = channel.deserialize(reflectionSchema) as {
      objects: Record<string, unknown>[];
    };
    expect(deserialized.objects.length).toEqual(10);
    expect(deserialized.objects[0]!.name).toEqual("reflection.Enum");
  });

  it("works with protobuf", () => {
    const fds = FileDescriptorSet.encode(FileDescriptorSet.root.toDescriptor("proto3")).finish();
    const channel = parseChannel({
      messageEncoding: "protobuf",
      schema: { name: "google.protobuf.FileDescriptorSet", encoding: "protobuf", data: fds },
    });
    const deserialized = channel.deserialize(fds) as IFileDescriptorSet;
    expect(deserialized.file[0]!.name).toEqual("google_protobuf.proto");
  });

  it("handles protobuf repeated enum having multiple default value aliases", () => {
    /*
    syntax = "proto3";

    enum ExampleEnum {
        option allow_alias = true;
        UNKNOWN = 0;
        WHATEVER = 0;
        FOO = 1;
        BAR = 2;
    }

    message ExampleMessage {
        repeated ExampleEnum data = 1;
    }
    */
    const channel = parseChannel({
      messageEncoding: "protobuf",
      schema: {
        name: "ExampleMessage",
        encoding: "protobuf",
        data: Buffer.from(
          "0A8D010A156578616D706C655F6D6573736167652E70726F746F222C0A0E4578616D706C654D657373616765121A0A046461746118012003280E320C2E4578616D706C65456E756D2A3E0A0B4578616D706C65456E756D120B0A07554E4B4E4F574E1000120C0A085748415445564552100012070A03464F4F100112070A0342415210021A021001620670726F746F33",
          "hex",
        ),
      },
    });
    expect(channel.deserialize(Buffer.from("0A0101", "hex"))).toEqual({ data: [1] });
  });

  it("handles protobuf int64 values", () => {
    /*
    syntax = "proto3";

    message Int64Test {
      int64 int64 = 1;
      uint64 uint64 = 2;
      sint64 sint64 = 3;
      fixed64 fixed64 = 4;
      sfixed64 sfixed64 = 5;
      map<int64, int64> int64map = 6;
      map<uint64, uint64> uint64map = 7;
      map<sint64, sint64> sint64map = 8;
      map<fixed64, fixed64> fixed64map = 9;
      map<sfixed64, sfixed64> sfixed64map = 10;
      repeated Nested nested = 11;
    }

    message Nested {
      int64 int64 = 1;
      uint64 uint64 = 2;
      sint64 sint64 = 3;
      fixed64 fixed64 = 4;
      sfixed64 sfixed64 = 5;
      map<int64, int64> int64map = 6;
      map<uint64, uint64> uint64map = 7;
      map<sint64, sint64> sint64map = 8;
      map<fixed64, fixed64> fixed64map = 9;
      map<sfixed64, sfixed64> sfixed64map = 10;
    }
    */
    const channel = parseChannel({
      messageEncoding: "protobuf",
      schema: {
        name: "Int64Test",
        encoding: "protobuf",
        data: Buffer.from(
          "CvILCg9JbnQ2NFRlc3QucHJvdG8igwYKCUludDY0VGVzdBIUCgVpbnQ2NBgBIAEoA1IFaW50NjQSFgoGdWludDY0GAIgASgEUgZ1aW50NjQSFgoGc2ludDY0GAMgASgSUgZzaW50NjQSGAoHZml4ZWQ2NBgEIAEoBlIHZml4ZWQ2NBIaCghzZml4ZWQ2NBgFIAEoEFIIc2ZpeGVkNjQSNAoIaW50NjRtYXAYBiADKAsyGC5JbnQ2NFRlc3QuSW50NjRtYXBFbnRyeVIIaW50NjRtYXASNwoJdWludDY0bWFwGAcgAygLMhkuSW50NjRUZXN0LlVpbnQ2NG1hcEVudHJ5Ugl1aW50NjRtYXASNwoJc2ludDY0bWFwGAggAygLMhkuSW50NjRUZXN0LlNpbnQ2NG1hcEVudHJ5UglzaW50NjRtYXASOgoKZml4ZWQ2NG1hcBgJIAMoCzIaLkludDY0VGVzdC5GaXhlZDY0bWFwRW50cnlSCmZpeGVkNjRtYXASPQoLc2ZpeGVkNjRtYXAYCiADKAsyGy5JbnQ2NFRlc3QuU2ZpeGVkNjRtYXBFbnRyeVILc2ZpeGVkNjRtYXASHwoGbmVzdGVkGAsgAygLMgcuTmVzdGVkUgZuZXN0ZWQaOwoNSW50NjRtYXBFbnRyeRIQCgNrZXkYASABKANSA2tleRIUCgV2YWx1ZRgCIAEoA1IFdmFsdWU6AjgBGjwKDlVpbnQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoBFIDa2V5EhQKBXZhbHVlGAIgASgEUgV2YWx1ZToCOAEaPAoOU2ludDY0bWFwRW50cnkSEAoDa2V5GAEgASgSUgNrZXkSFAoFdmFsdWUYAiABKBJSBXZhbHVlOgI4ARo9Cg9GaXhlZDY0bWFwRW50cnkSEAoDa2V5GAEgASgGUgNrZXkSFAoFdmFsdWUYAiABKAZSBXZhbHVlOgI4ARo+ChBTZml4ZWQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoEFIDa2V5EhQKBXZhbHVlGAIgASgQUgV2YWx1ZToCOAEi0AUKBk5lc3RlZBIUCgVpbnQ2NBgBIAEoA1IFaW50NjQSFgoGdWludDY0GAIgASgEUgZ1aW50NjQSFgoGc2ludDY0GAMgASgSUgZzaW50NjQSGAoHZml4ZWQ2NBgEIAEoBlIHZml4ZWQ2NBIaCghzZml4ZWQ2NBgFIAEoEFIIc2ZpeGVkNjQSMQoIaW50NjRtYXAYBiADKAsyFS5OZXN0ZWQuSW50NjRtYXBFbnRyeVIIaW50NjRtYXASNAoJdWludDY0bWFwGAcgAygLMhYuTmVzdGVkLlVpbnQ2NG1hcEVudHJ5Ugl1aW50NjRtYXASNAoJc2ludDY0bWFwGAggAygLMhYuTmVzdGVkLlNpbnQ2NG1hcEVudHJ5UglzaW50NjRtYXASNwoKZml4ZWQ2NG1hcBgJIAMoCzIXLk5lc3RlZC5GaXhlZDY0bWFwRW50cnlSCmZpeGVkNjRtYXASOgoLc2ZpeGVkNjRtYXAYCiADKAsyGC5OZXN0ZWQuU2ZpeGVkNjRtYXBFbnRyeVILc2ZpeGVkNjRtYXAaOwoNSW50NjRtYXBFbnRyeRIQCgNrZXkYASABKANSA2tleRIUCgV2YWx1ZRgCIAEoA1IFdmFsdWU6AjgBGjwKDlVpbnQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoBFIDa2V5EhQKBXZhbHVlGAIgASgEUgV2YWx1ZToCOAEaPAoOU2ludDY0bWFwRW50cnkSEAoDa2V5GAEgASgSUgNrZXkSFAoFdmFsdWUYAiABKBJSBXZhbHVlOgI4ARo9Cg9GaXhlZDY0bWFwRW50cnkSEAoDa2V5GAEgASgGUgNrZXkSFAoFdmFsdWUYAiABKAZSBXZhbHVlOgI4ARo+ChBTZml4ZWQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoEFIDa2V5EhQKBXZhbHVlGAIgASgQUgV2YWx1ZToCOAFiBnByb3RvMw==",
          "base64",
        ),
      },
    });
    expect(
      channel.deserialize(
        Buffer.from(
          "088c95f0c4c5a9d28ff20110bc85a0cfc8e0c8e38a0118e7d59ff6f4acdbe01b21bc02e8890423c78a298c0a9c584c491ff23216088c95f0c4c5a9d28ff201108c95f0c4c5a9d28ff2013a1608bc85a0cfc8e0c8e38a0110bc85a0cfc8e0c8e38a01421408e7d59ff6f4acdbe01b10e7d59ff6f4acdbe01b4a1209bc02e8890423c78a11bc02e8890423c78a5212098c0a9c584c491ff2118c0a9c584c491ff25aa001088c95f0c4c5a9d28ff20110bc85a0cfc8e0c8e38a0118e7d59ff6f4acdbe01b21bc02e8890423c78a298c0a9c584c491ff23216088c95f0c4c5a9d28ff201108c95f0c4c5a9d28ff2013a1608bc85a0cfc8e0c8e38a0110bc85a0cfc8e0c8e38a01421408e7d59ff6f4acdbe01b10e7d59ff6f4acdbe01b4a1209bc02e8890423c78a11bc02e8890423c78a5212098c0a9c584c491ff2118c0a9c584c491ff2",
          "hex",
        ),
      ),
    ).toEqual({
      int64: -999999999999997300n,
      uint64: 10000000000000000700n,
      sint64: -999999999999997300n,
      fixed64: 10000000000000000700n,
      sfixed64: -999999999999997300n,
      int64map: [{ key: -999999999999997300n, value: -999999999999997300n }],
      uint64map: [{ key: 10000000000000000700n, value: 10000000000000000700n }],
      sint64map: [{ key: -999999999999997300n, value: -999999999999997300n }],
      fixed64map: [{ key: 10000000000000000700n, value: 10000000000000000700n }],
      sfixed64map: [{ key: -999999999999997300n, value: -999999999999997300n }],
      nested: [
        {
          int64: -999999999999997300n,
          uint64: 10000000000000000700n,
          sint64: -999999999999997300n,
          fixed64: 10000000000000000700n,
          sfixed64: -999999999999997300n,
          int64map: [{ key: -999999999999997300n, value: -999999999999997300n }],
          uint64map: [{ key: 10000000000000000700n, value: 10000000000000000700n }],
          sint64map: [{ key: -999999999999997300n, value: -999999999999997300n }],
          fixed64map: [{ key: 10000000000000000700n, value: 10000000000000000700n }],
          sfixed64map: [{ key: -999999999999997300n, value: -999999999999997300n }],
        },
      ],
    });
  });

  it("works with ros1", () => {
    const channel = parseChannel({
      messageEncoding: "ros1",
      schema: {
        name: "foo_msgs/Bar",
        encoding: "ros1msg",
        data: new TextEncoder().encode("string data"),
      },
    });

    const obj = channel.deserialize(new Uint8Array([4, 0, 0, 0, 65, 66, 67, 68]));
    expect(obj).toEqual({ data: "ABCD" });
  });

  it("works with ros2", () => {
    const channel = parseChannel({
      messageEncoding: "cdr",
      schema: {
        name: "foo_msgs/Bar",
        encoding: "ros2msg",
        data: new TextEncoder().encode("string data"),
      },
    });

    const obj = channel.deserialize(new Uint8Array([0, 1, 0, 0, 5, 0, 0, 0, 65, 66, 67, 68, 0]));
    expect(obj).toEqual({ data: "ABCD" });
  });

  it("works with ros2idl", () => {
    const channel = parseChannel({
      messageEncoding: "cdr",
      schema: {
        name: "foo_msgs/Bar",
        encoding: "ros2idl",
        data: new TextEncoder().encode(`
        module foo_msgs {
          struct Bar {string data;};
        };
        `),
      },
    });

    const obj = channel.deserialize(new Uint8Array([0, 1, 0, 0, 5, 0, 0, 0, 65, 66, 67, 68, 0]));
    expect(obj).toEqual({ data: "ABCD" });
  });
});
