// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { MemoizedVertexBuffer, VertexBuffer } from "./types";

// Implements a double buffer caching for vertex buffers.
// We keep track of both the current and the previous frames to tell
// which vertex buffer are not used anymore and need to be deleted.
export default class VertexBufferCache {
  private _current = new Map<Float32Array, MemoizedVertexBuffer>();
  private _previous = new Map<Float32Array, MemoizedVertexBuffer>();

  // Call this method before rendering to initialize
  // the cache for the current frame.
  onPreRender(): void {
    this._previous = this._current;
    this._current = new Map<Float32Array, MemoizedVertexBuffer>();
  }

  // Get a vertex buffer from the cache.
  get(key: VertexBuffer): MemoizedVertexBuffer | undefined {
    const { buffer } = key;
    let existing = this._current.get(buffer);
    if (existing) {
      // The vertex buffer exists in the current frame
      return existing;
    }
    existing = this._previous.get(buffer);
    if (existing) {
      // The vertex buffer was not used in the current frame yet
      // but there is valid cached instance in the previous frame.
      // Move the cached value to the current frame to prevent it
      // from being deleted when executing onPostRender().
      this.set(key, existing);
      this._previous.delete(buffer);
      return existing;
    }
    // The vertex buffer has not being cached neither in the current
    // nor in the previous frame.
    return undefined;
  }

  // Set a cached value for a vertex buffer
  set(key: VertexBuffer, value: MemoizedVertexBuffer): void {
    const existing = this._current.get(key.buffer);
    if (existing) {
      if (existing === value) {
        // Nothing to do
        return;
      }
      // A vertex buffer should not change in the same frame,
      // but if it does, we need override the existing cached value
      // and delete it's buffer.
      this._deleteBuffer(existing);
    }
    this._current.set(key.buffer, value);
  }

  // Call this function after rendering a frame to delete unused buffers
  onPostRender(): void {
    this._previous.forEach(this._deleteBuffer);
    this._previous.clear();
  }

  private _deleteBuffer = (cached: MemoizedVertexBuffer): void => {
    const { buffer } = cached;
    // Destroy GPU buffer
    buffer?.destroy();
  };
}
