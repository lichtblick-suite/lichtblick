// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { JsonMessageWriter } from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer/JsonMessageWriter";

describe("JsonMessageWriter", () => {
  const writer = new JsonMessageWriter();

  it("should return a message converted to a Uint8Array", () => {
    const message = { text: "test message" };

    const result = writer.writeMessage(message);

    expect(result).toHaveLength(result.length);
  });

  it("should return an empty Uint8array because the message recieved was undefined", () => {
    const message = undefined;

    const result = writer.writeMessage(message);
    const expected = new Uint8Array(Buffer.from(""));

    expect(result).toEqual(expected);
  });
});
