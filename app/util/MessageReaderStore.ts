// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { MessageReader, parseMessageDefinition } from "rosbag";

import { FREEZE_MESSAGES } from "@foxglove/studio-base/util/globalConstants";

class ReaderItem {
  md5: string;
  reader: MessageReader;

  constructor(md5: string, messageDefinition: string) {
    this.md5 = md5;
    this.reader = new MessageReader(parseMessageDefinition(messageDefinition), {
      freeze: FREEZE_MESSAGES,
    });
  }
}

export default class MessageReaderStore {
  storage: {
    [type: string]: ReaderItem;
  } = {};

  get(type: string, md5: string, messageDefinition: string): MessageReader {
    let item = this.storage[type];
    if (!item) {
      item = new ReaderItem(md5, messageDefinition);
      this.storage[type] = item;
    }
    if (item.md5 !== md5) {
      delete this.storage[type];
      item = new ReaderItem(md5, messageDefinition);
      this.storage[type] = item;
    }
    return item.reader;
  }
}
