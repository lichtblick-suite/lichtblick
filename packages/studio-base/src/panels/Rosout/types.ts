// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Header } from "@foxglove/studio-base/types/Messages";

export type RosgraphMsgs$Log = Readonly<{
  header: Header;
  level: number;
  name: string;
  msg: string;
  file: string;
  function: string;
  line: number;
  topics: readonly string[];
}>;
