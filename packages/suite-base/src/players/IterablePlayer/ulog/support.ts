// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageDefinition, MessageDefinitionField } from "@foxglove/message-definition";
import { MessageDefinition as ULogMessageDefinition, ULog, LogLevel } from "@foxglove/ulog";

export function messageIdToTopic(msgId: number, ulog: ULog): string | undefined {
  return ulog.subscriptions.get(msgId)?.name;
}

export function messageDefinitionToRos(msgDef: ULogMessageDefinition): MessageDefinition {
  const definitions: MessageDefinitionField[] = [];

  for (const field of msgDef.fields) {
    const isString = field.type === "char";
    definitions.push({
      name: field.name,
      type: typeToRos(field.type),
      isArray: field.arrayLength != undefined && !isString,
      arrayLength: isString ? undefined : field.arrayLength,
      upperBound: isString ? field.arrayLength ?? 1 : undefined,
      isComplex: field.isComplex,
    });
  }

  return { name: msgDef.name, definitions };
}

export function logLevelToRosout(level: LogLevel): number {
  switch (level) {
    case LogLevel.Emerg:
    case LogLevel.Alert:
    case LogLevel.Crit:
      return 16; // fatal/critical
    case LogLevel.Err:
      return 8; // error
    case LogLevel.Warning:
      return 4; // warning
    case LogLevel.Notice:
    case LogLevel.Info:
      return 2; // info
    case LogLevel.Debug:
    default:
      return 1; // debug
  }
}

function typeToRos(type: string): string {
  switch (type) {
    case "int8_t":
      return "int8";
    case "uint8_t":
      return "uint8";
    case "int16_t":
      return "int16";
    case "uint16_t":
      return "uint16";
    case "int32_t":
      return "int32";
    case "uint32_t":
      return "uint32";
    case "int64_t":
      return "int64";
    case "uint64_t":
      return "uint64";
    case "float":
      return "float32";
    case "double":
      return "float64";
    case "bool":
      return "bool";
    case "char":
      return "string";
    default:
      return type;
  }
}
