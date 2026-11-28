// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";

type Transform = { child_frame_id?: unknown };

/** `/tf_static` or a namespaced `<ns>/tf_static`: latched topics that each publisher sends once. */
export function isStaticTransformTopic(topic: string): boolean {
  return topic === "/tf_static" || topic.endsWith("/tf_static");
}

function transformsOf(messageEvent: MessageEvent): readonly Transform[] | undefined {
  const transforms = (messageEvent.message as { transforms?: unknown } | undefined)?.transforms;
  return Array.isArray(transforms) ? (transforms as Transform[]) : undefined;
}

function childFrameIds(transforms: readonly Transform[]): string[] | undefined {
  const ids = transforms.map((t) => t.child_frame_id);
  return ids.every((id): id is string => typeof id === "string") ? ids : undefined;
}

/**
 * Combines a cached static transform message with a newer one, keyed by child frame.
 *
 * Each `/tf_static` publisher sends its transforms once, so with several publishers the last
 * message alone misses the frames of the others. The result keeps every child frame, the newer
 * transform winning, and the newer message's topic, schema and receive time. The size is the newer
 * message's plus the share of the older one that was kept. Returns `next` unchanged when there is
 * nothing to add from `prev` or a message is not a list of transforms with child frame ids.
 */
export function mergeStaticTransforms(
  prev: MessageEvent | undefined,
  next: MessageEvent,
): MessageEvent {
  if (prev == undefined) {
    return next;
  }
  const prevTransforms = transformsOf(prev);
  const nextTransforms = transformsOf(next);
  if (prevTransforms == undefined || nextTransforms == undefined) {
    return next;
  }
  const prevIds = childFrameIds(prevTransforms);
  const nextIds = childFrameIds(nextTransforms);
  if (prevIds == undefined || nextIds == undefined) {
    return next;
  }
  const nextIdSet = new Set(nextIds);
  const kept = prevTransforms.filter((_t, i) => !nextIdSet.has(prevIds[i]!));
  if (kept.length === 0) {
    return next;
  }
  return {
    ...next,
    message: { ...(next.message as object), transforms: [...kept, ...nextTransforms] },
    sizeInBytes:
      next.sizeInBytes + Math.round((prev.sizeInBytes * kept.length) / prevTransforms.length),
  };
}
