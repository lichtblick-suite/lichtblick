// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CoordinateFrame, MAX_DURATION, FallbackFrameId, AnyFrameId } from "./CoordinateFrame";
import { Transform } from "./Transform";
import { Pose } from "./geometry";
import { Duration, Time } from "./time";

const DEFAULT_MAX_CAPACITY_PER_FRAME = 50_000;

export enum AddTransformResult {
  NOT_UPDATED,
  UPDATED,
  CYCLE_DETECTED,
}

/**
 * TransformTree is a collection of coordinate frames with convenience methods
 * for getting and creating frames and adding transforms between frames.
 */
export class TransformTree {
  #frames = new Map<string, CoordinateFrame>();
  #maxStorageTime: Duration;
  #maxCapacityPerFrame: number;
  public defaultRootFrame: CoordinateFrame<FallbackFrameId>;

  public constructor(
    maxStorageTime = MAX_DURATION,
    maxCapacityPerFrame = DEFAULT_MAX_CAPACITY_PER_FRAME,
  ) {
    this.#maxStorageTime = maxStorageTime;
    this.#maxCapacityPerFrame = maxCapacityPerFrame;
    this.defaultRootFrame = new CoordinateFrame(
      CoordinateFrame.FALLBACK_FRAME_ID,
      undefined,
      this.#maxStorageTime,
      this.#maxCapacityPerFrame,
    );
    this.defaultRootFrame.addTransform(0n, Transform.Identity());
  }

  public addTransform(
    frameId: string,
    parentFrameId: string,
    time: Time,
    transform: Transform,
  ): AddTransformResult {
    let updated = !this.hasFrame(frameId);
    let cycleDetected = false;
    const frame = this.getOrCreateFrame(frameId);
    const curParentFrame = frame.parent();
    if (curParentFrame == undefined || curParentFrame.id !== parentFrameId) {
      cycleDetected = this.#checkParentForCycle(frameId, parentFrameId);
      // This frame was previously unparented but now we know its parent, or we
      // are reparenting this frame
      if (!cycleDetected) {
        frame.setParent(this.getOrCreateFrame(parentFrameId));
        updated = true;
      }
    }

    if (!cycleDetected) {
      frame.addTransform(time, transform);
    }
    return cycleDetected
      ? AddTransformResult.CYCLE_DETECTED
      : updated
      ? AddTransformResult.UPDATED
      : AddTransformResult.NOT_UPDATED;
  }

  /**
   * Removes transform data from a particular parent-child link at the given timestamp. Does nothing
   * if the child does not exist or has a different parent.
   */
  public removeTransform(childFrameId: string, parentFrameId: string, stamp: bigint): void {
    const child = this.frame(childFrameId);
    if (!child) {
      return;
    }
    if (child.parent()?.id !== parentFrameId) {
      return;
    }
    child.removeTransformAt(stamp);
    this.#removeEmptyAncestors(child);
  }

  /**
   * Walk up the tree starting from `candidate` and prune frames with no history entries and no
   * children.
   */
  #removeEmptyAncestors(candidate: CoordinateFrame): void {
    if (candidate.transformsSize() > 0) {
      // don't want to delete this frame, it is not empty
      return;
    }

    // Build a list of children for each frame in the tree, used to check whether nodes are leaf
    // nodes
    const childrenByParentId = new Map<string, Set<string>>();
    for (const frame of this.#frames.values()) {
      childrenByParentId.set(frame.id, new Set());
    }
    for (const frame of this.#frames.values()) {
      const parent = frame.parent();
      if (parent === candidate) {
        // can't delete this frame or its ancestors, it still has children
        return;
      }
      if (parent == undefined) {
        continue;
      }
      const children = childrenByParentId.get(parent.id);
      if (!children) {
        throw new Error("invariant: should have children array");
      }
      children.add(frame.id);
    }

    // Walk upwards, deleting nodes with no history entries and no children
    for (
      let current: typeof candidate | undefined = candidate;
      current;
      current = current.parent()
    ) {
      if (current.transformsSize() > 0) {
        // don't want to delete this frame, it is not empty
        return;
      }
      const children = childrenByParentId.get(current.id);
      if (children && children.size > 0) {
        // can't delete this frame or its ancestors, it still has children
        return;
      }
      this.#frames.delete(current.id);
      childrenByParentId.delete(current.id);
      const parentId = current.parent()?.id;
      if (parentId) {
        childrenByParentId.get(parentId)?.delete(current.id);
      }
    }
  }

  public clear(): void {
    this.#frames.clear();
  }

  public clearAfter(time: Time): void {
    for (const frame of this.#frames.values()) {
      frame.removeTransformsAfter(time);
    }
  }

  public hasFrame(id: AnyFrameId): boolean {
    if (id === CoordinateFrame.FALLBACK_FRAME_ID) {
      return true;
    }
    return this.#frames.has(id);
  }

  public frame<ID extends AnyFrameId>(id: ID): CoordinateFrame<ID> | undefined {
    if (id === CoordinateFrame.FALLBACK_FRAME_ID) {
      return this.defaultRootFrame as CoordinateFrame<ID>;
    }
    return this.#frames.get(id) as CoordinateFrame<ID>;
  }

  public getOrCreateFrame(id: string): CoordinateFrame {
    let frame = this.#frames.get(id);
    if (!frame) {
      frame = new CoordinateFrame(id, undefined, this.#maxStorageTime, this.#maxCapacityPerFrame);
      this.#frames.set(id, frame);
    }
    return frame;
  }

  public frames(): ReadonlyMap<string, CoordinateFrame> {
    return this.#frames;
  }

  public apply(
    output: Pose,
    input: Readonly<Pose>,
    frameId: AnyFrameId,
    rootFrameId: AnyFrameId | undefined,
    srcFrameId: AnyFrameId,
    dstTime: Time,
    srcTime: Time,
    maxDelta?: Duration,
  ): Pose | undefined {
    const frame = this.frame(frameId);
    const srcFrame = this.frame(srcFrameId);
    if (!frame || !srcFrame) {
      return undefined;
    }
    const rootFrame =
      (rootFrameId != undefined ? this.frame(rootFrameId) : frame.root()) ?? frame.root();
    return frame.apply(output, input, rootFrame, srcFrame, dstTime, srcTime, maxDelta);
  }

  public frameList(): { label: string; value: string }[] {
    type FrameEntry = { id: string; children: FrameEntry[] };

    const frames = Array.from(this.#frames.values());
    const frameMap = new Map<string, FrameEntry>(
      frames.map((frame) => [frame.id, { id: frame.id, children: [] }]),
    );

    // Create a hierarchy of coordinate frames
    const rootFrames: FrameEntry[] = [];
    for (const frame of frames) {
      const frameEntry = frameMap.get(frame.id)!;
      const parentId = frame.parent()?.id;
      if (parentId == undefined) {
        rootFrames.push(frameEntry);
      } else {
        const parent = frameMap.get(parentId);
        if (parent == undefined) {
          continue;
        }
        parent.children.push(frameEntry);
      }
    }

    // Convert the `rootFrames` hierarchy into a flat list of coordinate frames with depth
    const output: { label: string; value: string }[] = [];

    function addFrame(frame: FrameEntry, depth: number) {
      const displayName = CoordinateFrame.DisplayName(frame.id);
      output.push({
        value: frame.id,
        label: `${"\u00A0\u00A0".repeat(depth)}${displayName}`,
      });
      frame.children.sort((a, b) => a.id.localeCompare(b.id));
      for (const child of frame.children) {
        addFrame(child, depth + 1);
      }
    }

    rootFrames.sort((a, b) => a.id.localeCompare(b.id));
    for (const entry of rootFrames) {
      addFrame(entry, 0);
    }

    return output;
  }
  #checkParentForCycle(frameId: string, parentFrameId: string): boolean {
    if (frameId === parentFrameId) {
      return true;
    }
    // walk up tree from parent Frame to check if it eventually crosses the frame
    let frame = this.frame(parentFrameId);
    while (frame?.parent()) {
      if (frame.parent()?.id === frameId) {
        return true;
      }
      frame = frame.parent();
    }
    return false;
  }

  public static Clone(tree: TransformTree): TransformTree {
    const newTree = new TransformTree(tree.#maxStorageTime, tree.#maxCapacityPerFrame);
    newTree.#frames = tree.#frames;
    return newTree;
  }
}
