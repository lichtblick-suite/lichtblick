// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { MessageDefinition } from "@lichtblick/message-definition";
import { Time, fromNanoSec } from "@lichtblick/rostime";

import { IRenderer } from "./IRenderer";
import { makePose } from "./transforms";

/** Topic on which edited (offset) transforms are published as foxglove.FrameTransform. */
export const EDITED_TRANSFORMS_TOPIC = "/lichtblick/edited_transforms";

/**
 * Global-variable name carrying the edited transforms for in-app consumers. Unlike the ROS topic,
 * this reaches other panels in the same app (the ROS1 player does not loop self-published messages
 * back to its own subscribers) and works during bag playback too.
 */
export const EDITED_TRANSFORMS_VARIABLE = "edited_transforms";

/**
 * Schema name used when advertising. Must exactly match the root key in FrameTransformDatatypes:
 * the ROS players resolve the message definition by this name (rosDatatypesToMessageDefinition),
 * so the dotted "foxglove.FrameTransform" would fail to resolve. Using the ROS-style name lets the
 * topic advertise on ROS1/ROS2 connections.
 */
export const FRAME_TRANSFORM_SCHEMA = "foxglove_msgs/FrameTransform";

/**
 * Message definition for foxglove.FrameTransform, used when advertising the edited-transforms
 * topic. Kept inline (like the geometry_msgs maps in publish.ts) so publishing does not depend on
 * a schema being present in the recording.
 */
export const FrameTransformDatatypes = new Map<string, MessageDefinition>([
  [
    "foxglove_msgs/FrameTransform",
    {
      definitions: [
        { type: "time", name: "timestamp", isArray: false, isComplex: false },
        { type: "string", name: "parent_frame_id", isArray: false, isComplex: false },
        { type: "string", name: "child_frame_id", isArray: false, isComplex: false },
        { type: "geometry_msgs/Vector3", name: "translation", isArray: false, isComplex: true },
        { type: "geometry_msgs/Quaternion", name: "rotation", isArray: false, isComplex: true },
      ],
    },
  ],
  [
    "geometry_msgs/Vector3",
    {
      definitions: [
        { type: "float64", name: "x", isArray: false, isComplex: false },
        { type: "float64", name: "y", isArray: false, isComplex: false },
        { type: "float64", name: "z", isArray: false, isComplex: false },
      ],
    },
  ],
  [
    "geometry_msgs/Quaternion",
    {
      definitions: [
        { type: "float64", name: "x", isArray: false, isComplex: false },
        { type: "float64", name: "y", isArray: false, isComplex: false },
        { type: "float64", name: "z", isArray: false, isComplex: false },
        { type: "float64", name: "w", isArray: false, isComplex: false },
      ],
    },
  ],
]);

/** A flat foxglove.FrameTransform message (see normalizeFrameTransform). */
export type FrameTransformMessage = {
  timestamp: Time;
  parent_frame_id: string;
  child_frame_id: string;
  translation: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
};

const FRAME_KEY_PREFIX = "frame:";

function isEdited(
  offset: Readonly<[number | undefined, number | undefined, number | undefined]> | undefined,
): boolean {
  return offset?.some((v) => v != undefined && v !== 0) === true;
}

/**
 * Returns true if the renderer config contains at least one frame with a non-zero editable offset.
 * Cheaper than collectEditedTransforms — no pose allocation or transform-tree traversal — so it
 * can be used as a fast-exit guard on high-frequency events such as configChange.
 */
export function hasEditedTransforms(renderer: IRenderer): boolean {
  const transforms = renderer.config.transforms;
  // Use for...in to avoid the intermediate array that Object.keys() allocates. This function
  // runs on every configChange (including camera drags) so allocation must be avoided.
  for (const frameKey in transforms) {
    if (!Object.hasOwn(transforms, frameKey)) {
      continue;
    }
    if (!frameKey.startsWith(FRAME_KEY_PREFIX)) {
      continue;
    }
    const settings = transforms[frameKey];
    if (isEdited(settings?.xyzOffset) || isEdited(settings?.rpyCoefficient)) {
      return true;
    }
  }
  return false;
}

/**
 * Builds a foxglove.FrameTransform for every coordinate frame that has a non-zero editable offset
 * (xyzOffset or rpyCoefficient). The published transform is the resolved parent->child pose with
 * the offset already baked in (via CoordinateFrame.GetTransformMatrix), expressed at the renderer's
 * current time. Frames without a parent or without a resolvable transform are skipped.
 */
export function collectEditedTransforms(renderer: IRenderer): FrameTransformMessage[] {
  const messages: FrameTransformMessage[] = [];
  const transforms = renderer.config.transforms;
  // The transform subsystem uses nanoseconds-as-bigint for its time; the message stamp uses
  // rostime {sec, nsec}.
  const time = renderer.currentTime;
  const stamp = fromNanoSec(time);

  for (const frameKey in transforms) {
    if (!Object.hasOwn(transforms, frameKey)) {
      continue;
    }
    if (!frameKey.startsWith(FRAME_KEY_PREFIX)) {
      continue;
    }
    const settings = transforms[frameKey];
    if (!isEdited(settings?.xyzOffset) && !isEdited(settings?.rpyCoefficient)) {
      continue;
    }

    const childId = frameKey.slice(FRAME_KEY_PREFIX.length);
    const childFrame = renderer.transformTree.frame(childId);
    const parentId = childFrame?.parent()?.id;
    if (childFrame == undefined || parentId == undefined) {
      continue;
    }

    // Resolve the child-frame origin expressed in its parent (parent->child pose). The editable
    // offset is applied inside apply()/GetTransformMatrix, so this is the edited transform.
    const pose = makePose();
    const resolved = renderer.transformTree.apply(
      pose,
      pose,
      parentId,
      parentId,
      childId,
      time,
      time,
    );
    if (resolved == undefined) {
      continue;
    }

    messages.push({
      timestamp: stamp,
      parent_frame_id: parentId,
      child_frame_id: childId,
      translation: { x: pose.position.x, y: pose.position.y, z: pose.position.z },
      rotation: {
        x: pose.orientation.x,
        y: pose.orientation.y,
        z: pose.orientation.z,
        w: pose.orientation.w,
      },
    });
  }

  return messages;
}
