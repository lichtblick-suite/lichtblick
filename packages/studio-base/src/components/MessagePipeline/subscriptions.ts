// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import moize from "moize";
import * as R from "ramda";

import { Immutable } from "@foxglove/studio";
import { SubscribePayload } from "@foxglove/studio-base/players/types";

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
 */
function mergeSubscription(
  a: Immutable<SubscribePayload>,
  b: Immutable<SubscribePayload>,
): Immutable<SubscribePayload> {
  const isAllFields = a.fields == undefined || b.fields == undefined;
  const fields = R.pipe(
    R.chain((payload: Immutable<SubscribePayload>): readonly string[] => payload.fields ?? []),
    R.map((v) => v.trim()),
    R.filter((v: string) => v.length > 0),
    R.uniq,
  )([a, b]);

  return {
    ...a,
    fields: fields.length > 0 && !isAllFields ? fields : undefined,
  };
}

/**
 * Merge subscriptions that subscribe to the same topic, paying attention to
 * the fields they need. This ignores `preloadType`.
 */
function denormalizeSubscriptions(
  subscriptions: Immutable<SubscribePayload[]>,
): Immutable<SubscribePayload[]> {
  return R.pipe(
    R.groupBy((v: Immutable<SubscribePayload>) => v.topic),
    R.values,
    // Filter out any set of payloads that contains _only_ empty `fields`
    R.filter((payloads: Immutable<SubscribePayload[]> | undefined) => {
      // Handle this later
      if (payloads == undefined) {
        return true;
      }

      return !R.all(
        (v: Immutable<SubscribePayload>) => v.fields != undefined && v.fields.length === 0,
        payloads,
      );
    }),
    // Now reduce them down to a single payload for each topic
    R.chain(
      (payloads: Immutable<SubscribePayload[]> | undefined): Immutable<SubscribePayload>[] => {
        const first = payloads?.[0];
        if (payloads == undefined || first == undefined || payloads.length === 0) {
          return [];
        }
        return [R.reduce(mergeSubscription, first, payloads)];
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
  subscriptions: Immutable<SubscribePayload[]>,
): Immutable<SubscribePayload[]> {
  return R.pipe(
    R.chain((v: Immutable<SubscribePayload>): Immutable<SubscribePayload>[] => {
      const { preloadType } = v;
      if (preloadType !== "full") {
        return [v];
      }

      // a "full" subscription to all fields implies a "partial" subscription
      // to those fields, too
      return [v, { ...v, preloadType: "partial" }];
    }),
    R.partition((v: Immutable<SubscribePayload>) => v.preloadType === "full"),
    ([full, partial]) => [...denormalizeSubscriptions(full), ...denormalizeSubscriptions(partial)],
  )(subscriptions);
}
