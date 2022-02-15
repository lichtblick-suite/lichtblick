// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/studio";

import {
  FoxgloveLog,
  Ros1RosgraphMsgs$Log,
  LogLevel,
  Ros2RosgraphMsgs$Log,
  LogMessageEvent,
  NormalizedLogMessage,
} from "./types";

// Get the log message string from the log message
export function getNormalizedMessage(logMessage: LogMessageEvent["message"]): string {
  if ("msg" in logMessage) {
    return logMessage.msg;
  } else if ("message" in logMessage) {
    return logMessage.message;
  }

  return "";
}

function getNormalizedLevel(datatype: string, raw: LogMessageEvent["message"]) {
  switch (datatype) {
    case "foxglove.Log":
      return (raw as FoxgloveLog).level;
    case "rosgraph_msgs/Log":
    case "rosgraph_msgs/msg/Log":
      return rosLevelToLogLevel((raw as Ros1RosgraphMsgs$Log).level);
  }

  return LogLevel.UNKNOWN;
}

function getNormalizedStamp(datatype: string, raw: LogMessageEvent["message"]): Time {
  switch (datatype) {
    case "foxglove.Log": {
      const sec = (raw as FoxgloveLog).timestamp / 1000000000n;
      const nsec = (raw as FoxgloveLog).timestamp - sec * 1000000000n;
      return {
        sec: Number(sec),
        nsec: Number(nsec),
      };
    }
    case "rosgraph_msgs/Log":
      return (raw as Ros1RosgraphMsgs$Log).header.stamp;
    case "rosgraph_msgs/msg/Log":
      return (raw as Ros2RosgraphMsgs$Log).stamp;
  }

  return {
    sec: 0,
    nsec: 0,
  };
}

export function normalizedLogMessage(
  datatype: string,
  raw: LogMessageEvent["message"],
): NormalizedLogMessage {
  const message = getNormalizedMessage(raw);
  const stamp = getNormalizedStamp(datatype, raw);
  const level = getNormalizedLevel(datatype, raw);

  return {
    message,
    stamp,
    level,
    name: raw.name,
    file: raw.file,
    line: raw.line,
  };
}

function rosLevelToLogLevel(rosLevel: number): LogLevel {
  switch (rosLevel) {
    case 1:
    case 10:
      return LogLevel.DEBUG;
    case 2:
    case 20:
      return LogLevel.INFO;
    case 4:
    case 30:
      return LogLevel.WARN;
    case 8:
    case 40:
      return LogLevel.ERROR;
    case 16:
    case 50:
      return LogLevel.FATAL;
    default:
      return LogLevel.UNKNOWN;
  }
}
