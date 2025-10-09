// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { calculateStaticItemFrequency } from "@lichtblick/suite-base/util/calculateStaticItemFrequency";

describe("calculateStaticItemFrequency", () => {
  const numMessages = 200;
  const firstMessageTime = { sec: 1, nsec: 0 };
  const lastMessageTime = { sec: 6, nsec: 0 };
  const duration = { sec: 6, nsec: 0 };

  it("should return undefined when lastMessage is undefined and duration is zero", () => {
    const zeroDuration = { sec: 0, nsec: 0 };

    const result = calculateStaticItemFrequency(numMessages, undefined, undefined, zeroDuration);
    expect(result).toBeUndefined();
  });

  it("should calculate frequency using duration when timestamps are missing", () => {
    const result = calculateStaticItemFrequency(numMessages, undefined, undefined, duration);
    expect(result).toBe(numMessages / duration.sec);
  });

  it("should return undefined if numMessages < 2", () => {
    const messages = 1;

    const result = calculateStaticItemFrequency(
      messages,
      firstMessageTime,
      lastMessageTime,
      duration,
    );
    expect(result).toBeUndefined();
  });

  it("should return undefined if first and last message times are equal", () => {
    const sameTimeMessage = { sec: 1, nsec: 0 };

    const result = calculateStaticItemFrequency(
      numMessages,
      sameTimeMessage,
      sameTimeMessage,
      duration,
    );
    expect(result).toBeUndefined();
  });

  it("should calculate frequency using topic duration", () => {
    const messages = 6;
    const result = calculateStaticItemFrequency(
      messages,
      { sec: 0, nsec: 0 },
      { sec: 5, nsec: 0 },
      duration,
    );
    expect(result).toBe(1); // (6-1)/5 = 1
  });

  it("should return undefined if topic duration is zero", () => {
    const messages = BasicBuilder.number();

    //The only way to simulate this condition is by having the first message after the last message
    const result = calculateStaticItemFrequency(
      messages,
      { sec: 4, nsec: 0 },
      { sec: 2, nsec: 0 },
      duration,
    );
    expect(result).toBeUndefined();
  });
});
