// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { areEqual } from "@foxglove/rostime";
import { PartialMessageEvent } from "@foxglove/studio-base/panels/ThreeDeeRender/SceneExtension";

import { AnyImage, CompressedImageTypes } from "./ImageTypes";
import { decodeCompressedImageToBitmap } from "./decodeImage";

export class BitmapCache {
  #latestBitmapsByTopic = new Map<
    string,
    { messageEvent: PartialMessageEvent<AnyImage>; bitmap: ImageBitmap | Promise<ImageBitmap> }
  >();

  /**
   * Get the cached bitmap for the given MessageEvent if it exists, or if not, decode it
   * asynchronously. Cache is keyed on topic and receiveTime.
   *
   * @param thenFn Called when the bitmap is available. If the bitmap was already cached, this will
   * be called synchronously.
   * @param catchFn Called with any errors encountered during decoding
   */
  public getBitmap(
    messageEvent: PartialMessageEvent<AnyImage>,
    image: CompressedImageTypes,
    resizeWidth: number | undefined,
    thenFn: (bitmap: ImageBitmap) => void,
    catchFn: (error: Error) => void,
  ): void {
    const cachedBitmap = this.#latestBitmapsByTopic.get(messageEvent.topic);
    if (cachedBitmap && areEqual(cachedBitmap.messageEvent.receiveTime, messageEvent.receiveTime)) {
      if (cachedBitmap.bitmap instanceof Promise) {
        cachedBitmap.bitmap.then(thenFn).catch(catchFn);
      } else {
        thenFn(cachedBitmap.bitmap);
      }
      return;
    }
    const newBitmap = {
      messageEvent,
      bitmap: decodeCompressedImageToBitmap(image, resizeWidth),
    };
    this.#latestBitmapsByTopic.set(messageEvent.topic, newBitmap);
    newBitmap.bitmap
      .then((bitmap) => {
        thenFn(bitmap);
        // Update the cache with the resolved bitmap so we can call thenFn synchronously in the future
        if (this.#latestBitmapsByTopic.get(messageEvent.topic)?.messageEvent === messageEvent) {
          this.#latestBitmapsByTopic.set(messageEvent.topic, { messageEvent, bitmap });
        }
      })
      .catch(catchFn);
  }
}
