// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/studio";
import { Header } from "@foxglove/studio-base/types/Messages";

export type RosgraphMsgs$Log = Readonly<{
  header?: Header; // ROS1 Log message
  stamp?: Time; // ROS2 Log message
  level: number;
  name: string;
  msg: string;
  file: string;
  function: string;
  line: number;
  topics?: readonly string[]; // ROS1 Log message
}>;
