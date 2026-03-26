// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { InternalSubscribePayload, SubscribePayload } from "@lichtblick/suite-base/players/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import {
  applySamplingGuardToSubscription,
  applySamplingGuardToSubscriptions,
} from "./samplingGuard";

describe("samplingGuard", () => {
  const topic = `/${BasicBuilder.string()}`;

  it("applySamplingGuardToSubscription removes unapproved sampling request", () => {
    // Given
    const subscription: SubscribePayload = {
      topic,
      samplingRequest: { mode: "latest-per-render-tick" },
    };

    // When
    const result = applySamplingGuardToSubscription(subscription);

    // Then
    expect(result).toEqual({ topic, samplingAuthorized: undefined, samplingRequest: undefined });
  });

  it("drops sampling requests without internal authorization", () => {
    // Given
    const input: SubscribePayload[] = [
      {
        topic,
        samplingRequest: { mode: "latest-per-render-tick" },
      },
    ];

    // When
    const result = applySamplingGuardToSubscriptions(input);

    // Then
    expect(result).toEqual([{ topic }]);
  });

  it("keeps sampling requests with internal authorization", () => {
    // Given
    const input: InternalSubscribePayload[] = [
      {
        topic,
        samplingRequest: { mode: "latest-per-render-tick" },
        samplingAuthorized: true,
      },
    ];

    // When
    const result = applySamplingGuardToSubscriptions(input);

    // Then
    expect(result).toEqual(input);
  });
});
