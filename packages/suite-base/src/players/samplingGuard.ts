// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type SamplingGuardInput = {
  samplingRequest?: {
    mode: "latest-per-render-tick";
  };
  samplingAuthorized?: true;
};

/**
 * Shared sampling authorization guard.
 *
 * Sampling requests are honored only when the subscription also carries
 * internal sampling authorization from trusted pipeline code.
 */
export function applySamplingGuardToSubscription<T extends SamplingGuardInput>(subscription: T): T {
  if (
    subscription.samplingRequest?.mode === "latest-per-render-tick" &&
    subscription.samplingAuthorized !== true
  ) {
    return {
      ...subscription,
      samplingRequest: undefined,
      samplingAuthorized: undefined,
    } as T;
  }

  return subscription;
}

/**
 * Applies the shared sampling guard to an array of subscriptions.
 */
export function applySamplingGuardToSubscriptions<T extends SamplingGuardInput>(
  subscriptions: readonly T[],
): T[] {
  return subscriptions.map((subscription) => applySamplingGuardToSubscription(subscription));
}
