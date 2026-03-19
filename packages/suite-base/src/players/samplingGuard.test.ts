// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { InternalSubscribePayload, SubscribePayload } from "@lichtblick/suite-base/players/types";

import {
  applySamplingGuardToSubscription,
  applySamplingGuardToSubscriptions,
} from "./samplingGuard";

describe("samplingGuard", () => {
  it("applySamplingGuardToSubscription removes unapproved sampling request", () => {
    expect(
      applySamplingGuardToSubscription({
        topic: "/foo",
        samplingRequest: { mode: "latest-per-render-tick" },
      }),
    ).toEqual({ topic: "/foo", samplingAuthorized: undefined, samplingRequest: undefined });
  });

  it("drops sampling requests without internal authorization", () => {
    const input: SubscribePayload[] = [
      {
        topic: "/foo",
        samplingRequest: { mode: "latest-per-render-tick" },
      },
    ];

    expect(applySamplingGuardToSubscriptions(input)).toEqual([{ topic: "/foo" }]);
  });

  it("keeps sampling requests with internal authorization", () => {
    const input: InternalSubscribePayload[] = [
      {
        topic: "/foo",
        samplingRequest: { mode: "latest-per-render-tick" },
        samplingAuthorized: true,
      },
    ];

    expect(applySamplingGuardToSubscriptions(input)).toEqual(input);
  });
});
