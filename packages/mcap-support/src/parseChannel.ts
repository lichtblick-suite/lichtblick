// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import protobufjs from "protobufjs";
import { FileDescriptorSet, IFileDescriptorSet } from "protobufjs/ext/descriptor";

import { parse as parseMessageDefinition, RosMsgDefinition } from "@foxglove/rosmsg";
import { MessageReader } from "@foxglove/rosmsg-serialization";
import { MessageReader as ROS2MessageReader } from "@foxglove/rosmsg2-serialization";

import { parseFlatbufferSchema } from "./parseFlatbufferSchema";
import { parseJsonSchema } from "./parseJsonSchema";
import { protobufDefinitionsToDatatypes, stripLeadingDot } from "./protobufDefinitionsToDatatypes";
import { RosDatatypes } from "./types";

type Channel = {
  messageEncoding: string;
  schema: { name: string; encoding: string; data: Uint8Array } | undefined;
};

export type ParsedChannel = {
  fullSchemaName: string;
  deserializer: (data: ArrayBufferView) => unknown;
  datatypes: RosDatatypes;
};

function parsedDefinitionsToDatatypes(
  parsedDefinitions: RosMsgDefinition[],
  rootName: string,
): RosDatatypes {
  const datatypes: RosDatatypes = new Map();
  parsedDefinitions.forEach(({ name, definitions }, index) => {
    if (index === 0) {
      datatypes.set(rootName, { name: rootName, definitions });
    } else if (name != undefined) {
      datatypes.set(name, { name, definitions });
    }
  });
  return datatypes;
}

/**
 * Process a channel/schema and extract information that can be used to deserialize messages on the
 * channel, and schemas in the format expected by Studio's RosDatatypes.
 *
 * See:
 * - https://github.com/foxglove/mcap/blob/main/docs/specification/well-known-message-encodings.md
 * - https://github.com/foxglove/mcap/blob/main/docs/specification/well-known-schema-encodings.md
 */
export function parseChannel(channel: Channel): ParsedChannel {
  if (channel.messageEncoding === "json") {
    if (channel.schema?.encoding !== "jsonschema") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected jsonschema)`,
      );
    }
    const textDecoder = new TextDecoder();
    const schema =
      channel.schema.data.length > 0
        ? JSON.parse(textDecoder.decode(channel.schema.data))
        : undefined;
    let datatypes: RosDatatypes = new Map();
    let deserializer = (data: ArrayBufferView) => JSON.parse(textDecoder.decode(data));
    if (schema != undefined) {
      if (typeof schema !== "object") {
        throw new Error(`Invalid schema, expected JSON object, got ${typeof schema}`);
      }
      const { datatypes: parsedDatatypes, postprocessValue } = parseJsonSchema(
        schema as Record<string, unknown>,
        channel.schema.name,
      );
      datatypes = parsedDatatypes;
      deserializer = (data) =>
        postprocessValue(JSON.parse(textDecoder.decode(data)) as Record<string, unknown>);
    }
    return { fullSchemaName: channel.schema.name, deserializer, datatypes };
  }

  if (channel.messageEncoding === "flatbuffer") {
    if (channel.schema?.encoding !== "flatbuffer") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected flatbuffer)`,
      );
    }
    return parseFlatbufferSchema(channel.schema.name, channel.schema.data);
  }

  if (channel.messageEncoding === "protobuf") {
    if (channel.schema?.encoding !== "protobuf") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected protobuf)`,
      );
    }
    const descriptorSet = FileDescriptorSet.decode(channel.schema.data);

    // Modify the definition of google.protobuf.Timestamp so it gets parsed as {sec, nsec},
    // compatible with the rest of Studio.
    for (const file of (descriptorSet as unknown as IFileDescriptorSet).file) {
      if (file.package === "google.protobuf") {
        for (const message of file.messageType ?? []) {
          if (message.name === "Timestamp" || message.name === "Duration") {
            for (const field of message.field ?? []) {
              if (field.name === "seconds") {
                field.name = "sec";
              } else if (field.name === "nanos") {
                field.name = "nsec";
              }
            }
          }
        }
      }
    }

    const root = protobufjs.Root.fromDescriptor(descriptorSet);
    root.resolveAll();
    const type = root.lookupType(channel.schema.name);

    const deserializer = (data: ArrayBufferView) => {
      return type.toObject(
        type.decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)),
        { defaults: true },
      );
    };

    const datatypes: RosDatatypes = new Map();
    protobufDefinitionsToDatatypes(datatypes, type);

    return {
      // fullName is a fully qualified name but includes a leading dot. Remove the leading dot.
      fullSchemaName: stripLeadingDot(type.fullName),
      deserializer,
      datatypes,
    };
  }

  if (channel.messageEncoding === "ros1") {
    if (channel.schema?.encoding !== "ros1msg") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected ros1msg)`,
      );
    }
    const schema = new TextDecoder().decode(channel.schema.data);
    const parsedDefinitions = parseMessageDefinition(schema);
    const reader = new MessageReader(parsedDefinitions);
    return {
      fullSchemaName: channel.schema.name,
      datatypes: parsedDefinitionsToDatatypes(parsedDefinitions, channel.schema.name),
      deserializer: (data) => reader.readMessage(data),
    };
  }

  if (channel.messageEncoding === "cdr") {
    if (channel.schema?.encoding !== "ros2msg") {
      throw new Error(
        `Message encoding ${channel.messageEncoding} with ${
          channel.schema == undefined
            ? "no encoding"
            : `schema encoding '${channel.schema.encoding}'`
        } is not supported (expected ros2msg)`,
      );
    }
    const schema = new TextDecoder().decode(channel.schema.data);
    const parsedDefinitions = parseMessageDefinition(schema, { ros2: true });
    const reader = new ROS2MessageReader(parsedDefinitions);
    return {
      fullSchemaName: channel.schema.name,
      datatypes: parsedDefinitionsToDatatypes(parsedDefinitions, channel.schema.name),
      deserializer: (data) => reader.readMessage(data),
    };
  }

  throw new Error(`Unsupported encoding ${channel.messageEncoding}`);
}
