// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseProtobufSchema } from "./parseProtobufSchema";

describe("parseProtobufSchema", () => {
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
    const channel = parseProtobufSchema(
      "ExampleMessage",
      Buffer.from(
        "0A8D010A156578616D706C655F6D6573736167652E70726F746F222C0A0E4578616D706C654D657373616765121A0A046461746118012003280E320C2E4578616D706C65456E756D2A3E0A0B4578616D706C65456E756D120B0A07554E4B4E4F574E1000120C0A085748415445564552100012070A03464F4F100112070A0342415210021A021001620670726F746F33",
        "hex",
      ),
    );
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
    const channel = parseProtobufSchema(
      "Int64Test",
      Buffer.from(
        "CvILCg9JbnQ2NFRlc3QucHJvdG8igwYKCUludDY0VGVzdBIUCgVpbnQ2NBgBIAEoA1IFaW50NjQSFgoGdWludDY0GAIgASgEUgZ1aW50NjQSFgoGc2ludDY0GAMgASgSUgZzaW50NjQSGAoHZml4ZWQ2NBgEIAEoBlIHZml4ZWQ2NBIaCghzZml4ZWQ2NBgFIAEoEFIIc2ZpeGVkNjQSNAoIaW50NjRtYXAYBiADKAsyGC5JbnQ2NFRlc3QuSW50NjRtYXBFbnRyeVIIaW50NjRtYXASNwoJdWludDY0bWFwGAcgAygLMhkuSW50NjRUZXN0LlVpbnQ2NG1hcEVudHJ5Ugl1aW50NjRtYXASNwoJc2ludDY0bWFwGAggAygLMhkuSW50NjRUZXN0LlNpbnQ2NG1hcEVudHJ5UglzaW50NjRtYXASOgoKZml4ZWQ2NG1hcBgJIAMoCzIaLkludDY0VGVzdC5GaXhlZDY0bWFwRW50cnlSCmZpeGVkNjRtYXASPQoLc2ZpeGVkNjRtYXAYCiADKAsyGy5JbnQ2NFRlc3QuU2ZpeGVkNjRtYXBFbnRyeVILc2ZpeGVkNjRtYXASHwoGbmVzdGVkGAsgAygLMgcuTmVzdGVkUgZuZXN0ZWQaOwoNSW50NjRtYXBFbnRyeRIQCgNrZXkYASABKANSA2tleRIUCgV2YWx1ZRgCIAEoA1IFdmFsdWU6AjgBGjwKDlVpbnQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoBFIDa2V5EhQKBXZhbHVlGAIgASgEUgV2YWx1ZToCOAEaPAoOU2ludDY0bWFwRW50cnkSEAoDa2V5GAEgASgSUgNrZXkSFAoFdmFsdWUYAiABKBJSBXZhbHVlOgI4ARo9Cg9GaXhlZDY0bWFwRW50cnkSEAoDa2V5GAEgASgGUgNrZXkSFAoFdmFsdWUYAiABKAZSBXZhbHVlOgI4ARo+ChBTZml4ZWQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoEFIDa2V5EhQKBXZhbHVlGAIgASgQUgV2YWx1ZToCOAEi0AUKBk5lc3RlZBIUCgVpbnQ2NBgBIAEoA1IFaW50NjQSFgoGdWludDY0GAIgASgEUgZ1aW50NjQSFgoGc2ludDY0GAMgASgSUgZzaW50NjQSGAoHZml4ZWQ2NBgEIAEoBlIHZml4ZWQ2NBIaCghzZml4ZWQ2NBgFIAEoEFIIc2ZpeGVkNjQSMQoIaW50NjRtYXAYBiADKAsyFS5OZXN0ZWQuSW50NjRtYXBFbnRyeVIIaW50NjRtYXASNAoJdWludDY0bWFwGAcgAygLMhYuTmVzdGVkLlVpbnQ2NG1hcEVudHJ5Ugl1aW50NjRtYXASNAoJc2ludDY0bWFwGAggAygLMhYuTmVzdGVkLlNpbnQ2NG1hcEVudHJ5UglzaW50NjRtYXASNwoKZml4ZWQ2NG1hcBgJIAMoCzIXLk5lc3RlZC5GaXhlZDY0bWFwRW50cnlSCmZpeGVkNjRtYXASOgoLc2ZpeGVkNjRtYXAYCiADKAsyGC5OZXN0ZWQuU2ZpeGVkNjRtYXBFbnRyeVILc2ZpeGVkNjRtYXAaOwoNSW50NjRtYXBFbnRyeRIQCgNrZXkYASABKANSA2tleRIUCgV2YWx1ZRgCIAEoA1IFdmFsdWU6AjgBGjwKDlVpbnQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoBFIDa2V5EhQKBXZhbHVlGAIgASgEUgV2YWx1ZToCOAEaPAoOU2ludDY0bWFwRW50cnkSEAoDa2V5GAEgASgSUgNrZXkSFAoFdmFsdWUYAiABKBJSBXZhbHVlOgI4ARo9Cg9GaXhlZDY0bWFwRW50cnkSEAoDa2V5GAEgASgGUgNrZXkSFAoFdmFsdWUYAiABKAZSBXZhbHVlOgI4ARo+ChBTZml4ZWQ2NG1hcEVudHJ5EhAKA2tleRgBIAEoEFIDa2V5EhQKBXZhbHVlGAIgASgQUgV2YWx1ZToCOAFiBnByb3RvMw==",
        "base64",
      ),
    );
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

  it("converts protobuf time/duration int64 to number rather than bigint", () => {
    const poseInFrameChannel = parseProtobufSchema(
      "foxglove.PoseInFrame",
      Buffer.from(
        "CmcKGWZveGdsb3ZlL1F1YXRlcm5pb24ucHJvdG8SCGZveGdsb3ZlIjgKClF1YXRlcm5pb24SCQoBeBgBIAEoARIJCgF5GAIgASgBEgkKAXoYAyABKAESCQoBdxgEIAEoAWIGcHJvdG8zClYKFmZveGdsb3ZlL1ZlY3RvcjMucHJvdG8SCGZveGdsb3ZlIioKB1ZlY3RvcjMSCQoBeBgBIAEoARIJCgF5GAIgASgBEgkKAXoYAyABKAFiBnByb3RvMwqyAQoTZm94Z2xvdmUvUG9zZS5wcm90bxIIZm94Z2xvdmUaGWZveGdsb3ZlL1F1YXRlcm5pb24ucHJvdG8aFmZveGdsb3ZlL1ZlY3RvcjMucHJvdG8iVgoEUG9zZRIjCghwb3NpdGlvbhgBIAEoCzIRLmZveGdsb3ZlLlZlY3RvcjMSKQoLb3JpZW50YXRpb24YAiABKAsyFC5mb3hnbG92ZS5RdWF0ZXJuaW9uYgZwcm90bzMK7wEKH2dvb2dsZS9wcm90b2J1Zi90aW1lc3RhbXAucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIrCglUaW1lc3RhbXASDwoHc2Vjb25kcxgBIAEoAxINCgVuYW5vcxgCIAEoBUKFAQoTY29tLmdvb2dsZS5wcm90b2J1ZkIOVGltZXN0YW1wUHJvdG9QAVoyZ29vZ2xlLmdvbGFuZy5vcmcvcHJvdG9idWYvdHlwZXMva25vd24vdGltZXN0YW1wcGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMwrSAQoaZm94Z2xvdmUvUG9zZUluRnJhbWUucHJvdG8SCGZveGdsb3ZlGhNmb3hnbG92ZS9Qb3NlLnByb3RvGh9nb29nbGUvcHJvdG9idWYvdGltZXN0YW1wLnByb3RvImwKC1Bvc2VJbkZyYW1lEi0KCXRpbWVzdGFtcBgBIAEoCzIaLmdvb2dsZS5wcm90b2J1Zi5UaW1lc3RhbXASEAoIZnJhbWVfaWQYAiABKAkSHAoEcG9zZRgDIAEoCzIOLmZveGdsb3ZlLlBvc2ViBnByb3RvMw==",
        "base64",
      ),
    );

    const poseInFrame = poseInFrameChannel.deserialize(
      Buffer.from(
        "CgwIx8LcoQYQuJzV6wESA2ZvbxooChsJAAAAAAAA8D8RAAAAAAAAAEAZAAAAAAAACEASCSEAAAAAAADwPw==",
        "base64",
      ),
    );
    expect(poseInFrame).toMatchInlineSnapshot(`
      {
        "frame_id": "foo",
        "pose": {
          "orientation": {
            "w": 1,
            "x": 0,
            "y": 0,
            "z": 0,
          },
          "position": {
            "x": 1,
            "y": 2,
            "z": 3,
          },
        },
        "timestamp": {
          "nsec": 494227000,
          "sec": 1681334599,
        },
      }
    `);

    expect(() =>
      poseInFrameChannel.deserialize(
        Buffer.from(
          "CgsIgICAgICAgBAQARIDZm9vGigKGwkAAAAAAADwPxEAAAAAAAAAQBkAAAAAAAAIQBIJIQAAAAAAAPA/",
          "base64",
        ),
      ),
    ).toThrow(
      "Timestamps with seconds greater than 2^53-1 are not supported (found seconds=9007199254740992, nanos=1)",
    );

    const sceneUpdateChannel = parseProtobufSchema(
      "foxglove.SceneUpdate",
      Buffer.from(
        "Cl0KFGZveGdsb3ZlL0NvbG9yLnByb3RvEghmb3hnbG92ZSIzCgVDb2xvchIJCgFyGAEgASgBEgkKAWcYAiABKAESCQoBYhgDIAEoARIJCgFhGAQgASgBYgZwcm90bzMKZwoZZm94Z2xvdmUvUXVhdGVybmlvbi5wcm90bxIIZm94Z2xvdmUiOAoKUXVhdGVybmlvbhIJCgF4GAEgASgBEgkKAXkYAiABKAESCQoBehgDIAEoARIJCgF3GAQgASgBYgZwcm90bzMKVgoWZm94Z2xvdmUvVmVjdG9yMy5wcm90bxIIZm94Z2xvdmUiKgoHVmVjdG9yMxIJCgF4GAEgASgBEgkKAXkYAiABKAESCQoBehgDIAEoAWIGcHJvdG8zCrIBChNmb3hnbG92ZS9Qb3NlLnByb3RvEghmb3hnbG92ZRoZZm94Z2xvdmUvUXVhdGVybmlvbi5wcm90bxoWZm94Z2xvdmUvVmVjdG9yMy5wcm90byJWCgRQb3NlEiMKCHBvc2l0aW9uGAEgASgLMhEuZm94Z2xvdmUuVmVjdG9yMxIpCgtvcmllbnRhdGlvbhgCIAEoCzIULmZveGdsb3ZlLlF1YXRlcm5pb25iBnByb3RvMwqHAgodZm94Z2xvdmUvQXJyb3dQcmltaXRpdmUucHJvdG8SCGZveGdsb3ZlGhRmb3hnbG92ZS9Db2xvci5wcm90bxoTZm94Z2xvdmUvUG9zZS5wcm90byKoAQoOQXJyb3dQcmltaXRpdmUSHAoEcG9zZRgBIAEoCzIOLmZveGdsb3ZlLlBvc2USFAoMc2hhZnRfbGVuZ3RoGAIgASgBEhYKDnNoYWZ0X2RpYW1ldGVyGAMgASgBEhMKC2hlYWRfbGVuZ3RoGAQgASgBEhUKDWhlYWRfZGlhbWV0ZXIYBSABKAESHgoFY29sb3IYBiABKAsyDy5mb3hnbG92ZS5Db2xvcmIGcHJvdG8zCuMBChxmb3hnbG92ZS9DdWJlUHJpbWl0aXZlLnByb3RvEghmb3hnbG92ZRoUZm94Z2xvdmUvQ29sb3IucHJvdG8aE2ZveGdsb3ZlL1Bvc2UucHJvdG8aFmZveGdsb3ZlL1ZlY3RvcjMucHJvdG8ibgoNQ3ViZVByaW1pdGl2ZRIcCgRwb3NlGAEgASgLMg4uZm94Z2xvdmUuUG9zZRIfCgRzaXplGAIgASgLMhEuZm94Z2xvdmUuVmVjdG9yMxIeCgVjb2xvchgDIAEoCzIPLmZveGdsb3ZlLkNvbG9yYgZwcm90bzMKlQIKIGZveGdsb3ZlL0N5bGluZGVyUHJpbWl0aXZlLnByb3RvEghmb3hnbG92ZRoUZm94Z2xvdmUvQ29sb3IucHJvdG8aE2ZveGdsb3ZlL1Bvc2UucHJvdG8aFmZveGdsb3ZlL1ZlY3RvcjMucHJvdG8imwEKEUN5bGluZGVyUHJpbWl0aXZlEhwKBHBvc2UYASABKAsyDi5mb3hnbG92ZS5Qb3NlEh8KBHNpemUYAiABKAsyES5mb3hnbG92ZS5WZWN0b3IzEhQKDGJvdHRvbV9zY2FsZRgDIAEoARIRCgl0b3Bfc2NhbGUYBCABKAESHgoFY29sb3IYBSABKAsyDy5mb3hnbG92ZS5Db2xvcmIGcHJvdG8zClsKG2ZveGdsb3ZlL0tleVZhbHVlUGFpci5wcm90bxIIZm94Z2xvdmUiKgoMS2V5VmFsdWVQYWlyEgsKA2tleRgBIAEoCRINCgV2YWx1ZRgCIAEoCWIGcHJvdG8zClQKFWZveGdsb3ZlL1BvaW50My5wcm90bxIIZm94Z2xvdmUiKQoGUG9pbnQzEgkKAXgYASABKAESCQoBeRgCIAEoARIJCgF6GAMgASgBYgZwcm90bzMKpAMKHGZveGdsb3ZlL0xpbmVQcmltaXRpdmUucHJvdG8SCGZveGdsb3ZlGhRmb3hnbG92ZS9Db2xvci5wcm90bxoVZm94Z2xvdmUvUG9pbnQzLnByb3RvGhNmb3hnbG92ZS9Qb3NlLnByb3RvIq8CCg1MaW5lUHJpbWl0aXZlEioKBHR5cGUYASABKA4yHC5mb3hnbG92ZS5MaW5lUHJpbWl0aXZlLlR5cGUSHAoEcG9zZRgCIAEoCzIOLmZveGdsb3ZlLlBvc2USEQoJdGhpY2tuZXNzGAMgASgBEhcKD3NjYWxlX2ludmFyaWFudBgEIAEoCBIgCgZwb2ludHMYBSADKAsyEC5mb3hnbG92ZS5Qb2ludDMSHgoFY29sb3IYBiABKAsyDy5mb3hnbG92ZS5Db2xvchIfCgZjb2xvcnMYByADKAsyDy5mb3hnbG92ZS5Db2xvchIPCgdpbmRpY2VzGAggAygHIjQKBFR5cGUSDgoKTElORV9TVFJJUBAAEg0KCUxJTkVfTE9PUBABEg0KCUxJTkVfTElTVBACYgZwcm90bzMKrgIKHWZveGdsb3ZlL01vZGVsUHJpbWl0aXZlLnByb3RvEghmb3hnbG92ZRoUZm94Z2xvdmUvQ29sb3IucHJvdG8aE2ZveGdsb3ZlL1Bvc2UucHJvdG8aFmZveGdsb3ZlL1ZlY3RvcjMucHJvdG8itwEKDk1vZGVsUHJpbWl0aXZlEhwKBHBvc2UYASABKAsyDi5mb3hnbG92ZS5Qb3NlEiAKBXNjYWxlGAIgASgLMhEuZm94Z2xvdmUuVmVjdG9yMxIeCgVjb2xvchgDIAEoCzIPLmZveGdsb3ZlLkNvbG9yEhYKDm92ZXJyaWRlX2NvbG9yGAQgASgIEgsKA3VybBgFIAEoCRISCgptZWRpYV90eXBlGAYgASgJEgwKBGRhdGEYByABKAxiBnByb3RvMwrnAQoeZm94Z2xvdmUvU3BoZXJlUHJpbWl0aXZlLnByb3RvEghmb3hnbG92ZRoUZm94Z2xvdmUvQ29sb3IucHJvdG8aE2ZveGdsb3ZlL1Bvc2UucHJvdG8aFmZveGdsb3ZlL1ZlY3RvcjMucHJvdG8icAoPU3BoZXJlUHJpbWl0aXZlEhwKBHBvc2UYASABKAsyDi5mb3hnbG92ZS5Qb3NlEh8KBHNpemUYAiABKAsyES5mb3hnbG92ZS5WZWN0b3IzEh4KBWNvbG9yGAMgASgLMg8uZm94Z2xvdmUuQ29sb3JiBnByb3RvMwr4AQocZm94Z2xvdmUvVGV4dFByaW1pdGl2ZS5wcm90bxIIZm94Z2xvdmUaFGZveGdsb3ZlL0NvbG9yLnByb3RvGhNmb3hnbG92ZS9Qb3NlLnByb3RvIpoBCg1UZXh0UHJpbWl0aXZlEhwKBHBvc2UYASABKAsyDi5mb3hnbG92ZS5Qb3NlEhEKCWJpbGxib2FyZBgCIAEoCBIRCglmb250X3NpemUYAyABKAESFwoPc2NhbGVfaW52YXJpYW50GAQgASgIEh4KBWNvbG9yGAUgASgLMg8uZm94Z2xvdmUuQ29sb3ISDAoEdGV4dBgGIAEoCWIGcHJvdG8zCqYCCiRmb3hnbG92ZS9UcmlhbmdsZUxpc3RQcmltaXRpdmUucHJvdG8SCGZveGdsb3ZlGhRmb3hnbG92ZS9Db2xvci5wcm90bxoVZm94Z2xvdmUvUG9pbnQzLnByb3RvGhNmb3hnbG92ZS9Qb3NlLnByb3RvIqkBChVUcmlhbmdsZUxpc3RQcmltaXRpdmUSHAoEcG9zZRgBIAEoCzIOLmZveGdsb3ZlLlBvc2USIAoGcG9pbnRzGAIgAygLMhAuZm94Z2xvdmUuUG9pbnQzEh4KBWNvbG9yGAMgASgLMg8uZm94Z2xvdmUuQ29sb3ISHwoGY29sb3JzGAQgAygLMg8uZm94Z2xvdmUuQ29sb3ISDwoHaW5kaWNlcxgFIAMoB2IGcHJvdG8zCusBCh5nb29nbGUvcHJvdG9idWYvZHVyYXRpb24ucHJvdG8SD2dvb2dsZS5wcm90b2J1ZiIqCghEdXJhdGlvbhIPCgdzZWNvbmRzGAEgASgDEg0KBW5hbm9zGAIgASgFQoMBChNjb20uZ29vZ2xlLnByb3RvYnVmQg1EdXJhdGlvblByb3RvUAFaMWdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2R1cmF0aW9ucGL4AQGiAgNHUEKqAh5Hb29nbGUuUHJvdG9idWYuV2VsbEtub3duVHlwZXNiBnByb3RvMwrvAQofZ29vZ2xlL3Byb3RvYnVmL3RpbWVzdGFtcC5wcm90bxIPZ29vZ2xlLnByb3RvYnVmIisKCVRpbWVzdGFtcBIPCgdzZWNvbmRzGAEgASgDEg0KBW5hbm9zGAIgASgFQoUBChNjb20uZ29vZ2xlLnByb3RvYnVmQg5UaW1lc3RhbXBQcm90b1ABWjJnb29nbGUuZ29sYW5nLm9yZy9wcm90b2J1Zi90eXBlcy9rbm93bi90aW1lc3RhbXBwYvgBAaICA0dQQqoCHkdvb2dsZS5Qcm90b2J1Zi5XZWxsS25vd25UeXBlc2IGcHJvdG8zCrIHChpmb3hnbG92ZS9TY2VuZUVudGl0eS5wcm90bxIIZm94Z2xvdmUaHWZveGdsb3ZlL0Fycm93UHJpbWl0aXZlLnByb3RvGhxmb3hnbG92ZS9DdWJlUHJpbWl0aXZlLnByb3RvGiBmb3hnbG92ZS9DeWxpbmRlclByaW1pdGl2ZS5wcm90bxobZm94Z2xvdmUvS2V5VmFsdWVQYWlyLnByb3RvGhxmb3hnbG92ZS9MaW5lUHJpbWl0aXZlLnByb3RvGh1mb3hnbG92ZS9Nb2RlbFByaW1pdGl2ZS5wcm90bxoeZm94Z2xvdmUvU3BoZXJlUHJpbWl0aXZlLnByb3RvGhxmb3hnbG92ZS9UZXh0UHJpbWl0aXZlLnByb3RvGiRmb3hnbG92ZS9UcmlhbmdsZUxpc3RQcmltaXRpdmUucHJvdG8aHmdvb2dsZS9wcm90b2J1Zi9kdXJhdGlvbi5wcm90bxofZ29vZ2xlL3Byb3RvYnVmL3RpbWVzdGFtcC5wcm90byKjBAoLU2NlbmVFbnRpdHkSLQoJdGltZXN0YW1wGAEgASgLMhouZ29vZ2xlLnByb3RvYnVmLlRpbWVzdGFtcBIQCghmcmFtZV9pZBgCIAEoCRIKCgJpZBgDIAEoCRIrCghsaWZldGltZRgEIAEoCzIZLmdvb2dsZS5wcm90b2J1Zi5EdXJhdGlvbhIUCgxmcmFtZV9sb2NrZWQYBSABKAgSKAoIbWV0YWRhdGEYBiADKAsyFi5mb3hnbG92ZS5LZXlWYWx1ZVBhaXISKAoGYXJyb3dzGAcgAygLMhguZm94Z2xvdmUuQXJyb3dQcmltaXRpdmUSJgoFY3ViZXMYCCADKAsyFy5mb3hnbG92ZS5DdWJlUHJpbWl0aXZlEioKB3NwaGVyZXMYCSADKAsyGS5mb3hnbG92ZS5TcGhlcmVQcmltaXRpdmUSLgoJY3lsaW5kZXJzGAogAygLMhsuZm94Z2xvdmUuQ3lsaW5kZXJQcmltaXRpdmUSJgoFbGluZXMYCyADKAsyFy5mb3hnbG92ZS5MaW5lUHJpbWl0aXZlEjIKCXRyaWFuZ2xlcxgMIAMoCzIfLmZveGdsb3ZlLlRyaWFuZ2xlTGlzdFByaW1pdGl2ZRImCgV0ZXh0cxgNIAMoCzIXLmZveGdsb3ZlLlRleHRQcmltaXRpdmUSKAoGbW9kZWxzGA4gAygLMhguZm94Z2xvdmUuTW9kZWxQcmltaXRpdmViBnByb3RvMwr+AQoiZm94Z2xvdmUvU2NlbmVFbnRpdHlEZWxldGlvbi5wcm90bxIIZm94Z2xvdmUaH2dvb2dsZS9wcm90b2J1Zi90aW1lc3RhbXAucHJvdG8ipAEKE1NjZW5lRW50aXR5RGVsZXRpb24SLQoJdGltZXN0YW1wGAEgASgLMhouZ29vZ2xlLnByb3RvYnVmLlRpbWVzdGFtcBIwCgR0eXBlGAIgASgOMiIuZm94Z2xvdmUuU2NlbmVFbnRpdHlEZWxldGlvbi5UeXBlEgoKAmlkGAMgASgJIiAKBFR5cGUSDwoLTUFUQ0hJTkdfSUQQABIHCgNBTEwQAWIGcHJvdG8zCtgBChpmb3hnbG92ZS9TY2VuZVVwZGF0ZS5wcm90bxIIZm94Z2xvdmUaGmZveGdsb3ZlL1NjZW5lRW50aXR5LnByb3RvGiJmb3hnbG92ZS9TY2VuZUVudGl0eURlbGV0aW9uLnByb3RvImgKC1NjZW5lVXBkYXRlEjAKCWRlbGV0aW9ucxgBIAMoCzIdLmZveGdsb3ZlLlNjZW5lRW50aXR5RGVsZXRpb24SJwoIZW50aXRpZXMYAiADKAsyFS5mb3hnbG92ZS5TY2VuZUVudGl0eWIGcHJvdG8z",
        "base64",
      ),
    );

    const sceneUpdate = sceneUpdateChannel.deserialize(
      Buffer.from("EhwKDAjHwtyhBhC4nNXrASIMCMfC3KEGELic1esB", "base64"),
    );
    expect(sceneUpdate).toMatchInlineSnapshot(`
      {
        "deletions": [],
        "entities": [
          {
            "arrows": [],
            "cubes": [],
            "cylinders": [],
            "frame_id": "",
            "frame_locked": false,
            "id": "",
            "lifetime": {
              "nsec": 494227000,
              "sec": 1681334599,
            },
            "lines": [],
            "metadata": [],
            "models": [],
            "spheres": [],
            "texts": [],
            "timestamp": {
              "nsec": 494227000,
              "sec": 1681334599,
            },
            "triangles": [],
          },
        ],
      }
    `);

    expect(sceneUpdateChannel.datatypes.get("google.protobuf.Timestamp")).toMatchInlineSnapshot(`
      {
        "definitions": [
          {
            "isArray": false,
            "name": "sec",
            "type": "int32",
          },
          {
            "isArray": false,
            "name": "nsec",
            "type": "int32",
          },
        ],
      }
    `);
    expect(sceneUpdateChannel.datatypes.get("google.protobuf.Duration")).toMatchInlineSnapshot(`
      {
        "definitions": [
          {
            "isArray": false,
            "name": "sec",
            "type": "int32",
          },
          {
            "isArray": false,
            "name": "nsec",
            "type": "int32",
          },
        ],
      }
    `);

    // Duration too large
    expect(() =>
      sceneUpdateChannel.deserialize(Buffer.from("EhMKBAgCEAMiCwiAgICAgICAEBAB", "base64")),
    ).toThrow(
      "Timestamps with seconds greater than 2^53-1 are not supported (found seconds=9007199254740992, nanos=1)",
    );

    // Timestamp too large
    expect(() =>
      sceneUpdateChannel.deserialize(Buffer.from("EhMKCwiAgICAgICAEBABIgQIAhAD", "base64")),
    ).toThrow(
      "Timestamps with seconds greater than 2^53-1 are not supported (found seconds=9007199254740992, nanos=1)",
    );
  });
});
