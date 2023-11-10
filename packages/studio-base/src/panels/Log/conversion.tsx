// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromNanoSec } from "@foxglove/rostime";
import { Log as FoxgloveLog } from "@foxglove/schemas";
import { Time } from "@foxglove/studio";

import {
  Ros1RosgraphMsgs$Log,
  LogLevel,
  Ros2RosgraphMsgs$Log,
  LogMessageEvent,
  NormalizedLogMessage,
} from "./types";

// Get the log message string from the log message
export function getNormalizedMessage(logMessage: Partial<LogMessageEvent["message"]>): string {
  if ("msg" in logMessage) {
    return logMessage.msg ?? "";
  } else if ("message" in logMessage) {
    return logMessage.message ?? "";
  }

  return "";
}

export function getNormalizedLevel(
  datatype: string,
  raw: Partial<LogMessageEvent["message"]>,
): number {
  switch (datatype) {
    case "foxglove_msgs/Log":
    case "foxglove_msgs/msg/Log":
    case "foxglove::Log":
    case "foxglove.Log":
      return (raw as Partial<FoxgloveLog>).level ?? LogLevel.UNKNOWN;
    case "rosgraph_msgs/Log":
    case "rcl_interfaces/msg/Log":
      return rosLevelToLogLevel((raw as Ros1RosgraphMsgs$Log).level);
  }

  return LogLevel.UNKNOWN;
}

function getNormalizedStamp(datatype: string, raw: Partial<LogMessageEvent["message"]>): Time {
  switch (datatype) {
    case "foxglove_msgs/Log":
    case "foxglove_msgs/msg/Log":
    case "foxglove::Log":
    case "foxglove.Log": {
      const timestamp = (raw as Partial<FoxgloveLog>).timestamp;
      if (typeof timestamp === "bigint") {
        return fromNanoSec(timestamp);
      }
      return timestamp ?? { sec: 0, nsec: 0 };
    }
    case "rosgraph_msgs/Log":
      return (raw as Ros1RosgraphMsgs$Log).header.stamp;
    case "rcl_interfaces/msg/Log":
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
