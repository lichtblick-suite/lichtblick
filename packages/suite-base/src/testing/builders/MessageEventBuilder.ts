// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

class MessageEventBuilder {
  public static messageEvent<T>(props: Partial<MessageEvent<T>> = {}): MessageEvent<T> {
    return defaults<MessageEvent<T>>(props, {
      message: BasicBuilder.stringMap() as T,
      publishTime: RosTimeBuilder.time(),
      receiveTime: RosTimeBuilder.time(),
      schemaName: BasicBuilder.string(),
      sizeInBytes: BasicBuilder.number(),
      topic: BasicBuilder.string(),
      topicConfig: BasicBuilder.stringMap(),
    });
  }

  public static messageEvents(count = 3): MessageEvent[] {
    return BasicBuilder.multiple(MessageEventBuilder.messageEvent, count);
  }
}

export default MessageEventBuilder;
