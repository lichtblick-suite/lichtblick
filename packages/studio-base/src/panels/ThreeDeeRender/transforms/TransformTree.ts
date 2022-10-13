// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CoordinateFrame, MAX_DURATION } from "./CoordinateFrame";
import { Transform } from "./Transform";
import { Pose } from "./geometry";
import { Duration, Time } from "./time";

const DEFAULT_MAX_CAPACITY_PER_FRAME = 50_000;

/**
 * TransformTree is a collection of coordinate frames with convenience methods
 * for getting and creating frames and adding transforms between frames.
 */
export class TransformTree {
  private _frames = new Map<string, CoordinateFrame>();
  private _maxStorageTime: Duration;
  private _maxCapacityPerFrame: number;

  public constructor(
    maxStorageTime = MAX_DURATION,
    maxCapacityPerFrame = DEFAULT_MAX_CAPACITY_PER_FRAME,
  ) {
    this._maxStorageTime = maxStorageTime;
    this._maxCapacityPerFrame = maxCapacityPerFrame;
  }

  public addTransform(
    frameId: string,
    parentFrameId: string,
    time: Time,
    transform: Transform,
  ): boolean {
    let updated = !this.hasFrame(frameId);
    const frame = this.getOrCreateFrame(frameId);
    const curParentFrame = frame.parent();
    if (curParentFrame == undefined || curParentFrame.id !== parentFrameId) {
      // will throw error if cycle is created
      this._checkParentForCycle(frameId, parentFrameId);
      // This frame was previously unparented but now we know its parent, or we
      // are reparenting this frame
      frame.setParent(this.getOrCreateFrame(parentFrameId));
      updated = true;
    }

    frame.addTransform(time, transform);
    return updated;
  }

  public clear(): void {
    this._frames.clear();
  }

  public hasFrame(id: string): boolean {
    return this._frames.has(id);
  }

  public frame(id: string): CoordinateFrame | undefined {
    return this._frames.get(id);
  }

  public getOrCreateFrame(id: string): CoordinateFrame {
    let frame = this._frames.get(id);
    if (!frame) {
      frame = new CoordinateFrame(id, undefined, this._maxStorageTime, this._maxCapacityPerFrame);
      this._frames.set(id, frame);
    }
    return frame;
  }

  public frames(): ReadonlyMap<string, CoordinateFrame> {
    return this._frames;
  }

  public apply(
    output: Pose,
    input: Readonly<Pose>,
    frameId: string,
    rootFrameId: string | undefined,
    srcFrameId: string,
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

    const frames = Array.from(this._frames.values());
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
  private _checkParentForCycle(frameId: string, parentFrameId: string) {
    // walk up tree from parent Frame to check if it eventually crosses the frame
    let frame = this.frame(parentFrameId);
    while (frame?.parent()) {
      if (frame.parent()?.id === frameId) {
        throw Error(
          `Transform tree cycle detected: Cannot add parent frame "${parentFrameId}" to frame"${frameId}. Aborted adding of transform.`,
        );
      }
      frame = frame.parent();
    }
  }

  public static Clone(tree: TransformTree): TransformTree {
    // eslint-disable-next-line no-underscore-dangle
    const newTree = new TransformTree(tree._maxStorageTime, tree._maxCapacityPerFrame);
    // eslint-disable-next-line no-underscore-dangle
    newTree._frames = tree._frames;
    return newTree;
  }
}
