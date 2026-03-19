// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import moize from "moize";
import * as R from "ramda";

import { Immutable } from "@lichtblick/suite";
import { InternalSubscribePayload, SubscribePayload } from "@lichtblick/suite-base/players/types";

/**
 * Create a deep equal memoized identify function. Used for stabilizing the subscription payloads we
 * send on to the player.
 *
 * Note that this has unlimited cache size so it should be managed by some containing scope.
 */
export function makeSubscriptionMemoizer(): (val: SubscribePayload) => SubscribePayload {
  return moize((val: SubscribePayload) => val, { isDeepEqual: true, maxSize: Infinity });
}

/**
 * Merge two SubscribePayloads, using either all of the fields or the union of
 * the specific fields requested.
 *
 * Sampling note:
 * - We keep sampling only when both payloads request the same sampling mode.
 * - Authorization is OR'ed so one trusted subscriber can authorize sampling for the merged output.
 */
function mergeSubscription(
  a: Immutable<InternalSubscribePayload>,
  b: Immutable<InternalSubscribePayload>,
): Immutable<InternalSubscribePayload> {
  const isAllFields = a.fields == undefined || b.fields == undefined;
  const fields = R.pipe(
    R.chain((payload: Immutable<SubscribePayload>): readonly string[] => payload.fields ?? []),
    R.map((v) => v.trim()),
    R.filter((v: string) => v.length > 0),
    R.uniq,
  )([a, b]);

  const sameSamplingMode =
    a.samplingRequest?.mode != undefined && a.samplingRequest.mode === b.samplingRequest?.mode;
  const samplingRequest = sameSamplingMode ? a.samplingRequest : undefined;
  const samplingAuthorized =
    sameSamplingMode && (a.samplingAuthorized === true || b.samplingAuthorized === true)
      ? true
      : undefined;

  return {
    ...a,
    fields: fields.length > 0 && !isAllFields ? fields : undefined,
    samplingRequest,
    samplingAuthorized,
  };
}

function applySamplingGuard(
  payload: Immutable<InternalSubscribePayload>,
): Immutable<InternalSubscribePayload> {
  // No sampling requested -> nothing to enforce.
  if (payload.samplingRequest?.mode == undefined) {
    return payload;
  }

  // Sampling requested and explicitly authorized by trusted pipeline code -> keep it.
  if (payload.samplingAuthorized === true) {
    return payload;
  }

  // Sampling requested but not authorized -> strip request before sending to players.
  return {
    ...payload,
    samplingRequest: undefined,
    samplingAuthorized: undefined,
  };
}

/**
 * Merge subscriptions that subscribe to the same topic, paying attention to
 * the fields they need. This ignores `preloadType`.
 */
function denormalizeSubscriptions(
  subscriptions: Immutable<InternalSubscribePayload[]>,
): Immutable<InternalSubscribePayload[]> {
  return R.pipe(
    R.groupBy((v: Immutable<InternalSubscribePayload>) => v.topic),
    R.values,
    // Filter out any set of payloads that contains _only_ empty `fields`
    R.filter((payloads: Immutable<InternalSubscribePayload[]> | undefined) => {
      // Handle this later
      if (payloads == undefined) {
        return true;
      }

      return !payloads.every((v: Immutable<InternalSubscribePayload>) => v.fields?.length === 0);
    }),
    // Now reduce them down to a single payload for each topic
    R.chain(
      (
        payloads: Immutable<InternalSubscribePayload[]> | undefined,
      ): Immutable<InternalSubscribePayload>[] => {
        const first = payloads?.[0];
        if (payloads == undefined || first == undefined || payloads.length === 0) {
          return [];
        }
        const merged = R.reduce(mergeSubscription, first, payloads.slice(1));
        return [applySamplingGuard(merged)];
      },
    ),
  )(subscriptions);
}

/**
 * Merges individual topic subscriptions into a set of subscriptions to send on to the player.
 *
 * If any client requests a "whole" subscription to a topic then all fields will be fetched for that
 * topic. If various clients request different slices of a topic then we request the union of all
 * requested slices.
 */
export function mergeSubscriptions(
  subscriptions: Immutable<InternalSubscribePayload[]>,
): Immutable<InternalSubscribePayload[]> {
  return R.pipe(
    R.chain((v: Immutable<InternalSubscribePayload>): Immutable<InternalSubscribePayload>[] => {
      const { preloadType } = v;
      if (preloadType !== "full") {
        return [v];
      }

      // a "full" subscription to all fields implies a "partial" subscription
      // to those fields, too
      return [v, { ...v, preloadType: "partial" }];
    }),
    R.partition((v: Immutable<InternalSubscribePayload>) => v.preloadType === "full"),
    ([full, partial]) => [...denormalizeSubscriptions(full), ...denormalizeSubscriptions(partial)],
  )(subscriptions);
}
