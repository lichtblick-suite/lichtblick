// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { Immutable } from "@foxglove/studio";
import { mergeSubscriptions } from "@foxglove/studio-base/components/MessagePipeline/subscriptions";
import { SubscribePayload } from "@foxglove/studio-base/players/types";

// A mapping from the subscription to the input topics needed to satisfy
// that request.
type SubscriberInputs = [SubscribePayload, readonly string[] | undefined];

/**
 * Calculates a mapping from topic name to a SubscribePayload containing the
 * minimum `preloadType` necessary to fulfill that request.
 */
export function getPreloadTypes(
  subscriptions: SubscribePayload[],
): Record<string, SubscribePayload> {
  return R.pipe(
    // Gather all of the payloads into subscriptions for the same topic
    R.groupBy((v: SubscribePayload) => v.topic),
    // Consolidate subscriptions to the same topic down to a single payload
    // and ignore `fields`
    R.mapObjIndexed((payloads: SubscribePayload[] | undefined, topic): SubscribePayload => {
      // If at least one preloadType is explicitly "full", we need "full",
      // but default to "partial"
      const hasFull = R.any((v: SubscribePayload) => v.preloadType === "full", payloads ?? []);

      return {
        topic,
        preloadType: hasFull ? "full" : "partial",
      };
    }),
  )(subscriptions);
}

/**
 * Rewrites the provided array of subscriptions to omit subscriptions to
 * virtual topics and subscribe only to the inputs to those topics, then
 * deduplicates.
 */
export function remapVirtualSubscriptions(
  subscriptions: SubscribePayload[],
  inputsByOutputTopic: Map<string, readonly string[]>,
): Immutable<SubscribePayload[]> {
  // Pair all subscriptions with their user script input topics (if any)
  const payloadInputsPairs = R.pipe(
    R.map((v: SubscribePayload): SubscriberInputs => [v, inputsByOutputTopic.get(v.topic)]),
    R.filter(([, topics]: SubscriberInputs) => topics?.length !== 0),
  )(subscriptions);

  return R.pipe(
    R.chain(([subscription, topics]: SubscriberInputs): SubscribePayload[] => {
      const preloadType = subscription.preloadType ?? "partial";

      // Leave the subscription unmodified if it is not a user script topic
      if (topics == undefined) {
        return [subscription];
      }

      // Subscribe to all fields for all topics used by this user script
      // because we can't know what fields the user script actually uses
      // (for now)
      return topics.map((v) => ({
        topic: v,
        preloadType,
      }));
    }),
    mergeSubscriptions,
  )(payloadInputsPairs);
}
