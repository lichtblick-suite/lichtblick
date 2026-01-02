// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@lichtblick/suite";

/**
 * Helper function for generating mock messages for tests and stories.
 *
 * @param message the message body
 * @param fields fields in the message object to override
 * @returns a MessageEvent
 */
export function mockMessage<T>(message: T, fields?: Partial<MessageEvent<T>>): MessageEvent<T> {
  return {
    topic: "topic",
    schemaName: "schema",
    receiveTime: { sec: 0, nsec: 0 },
    message,
    sizeInBytes: 1,
    ...fields,
  };
}
