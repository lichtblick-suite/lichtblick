// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { RawImage } from "@foxglove/schemas";

import type { RawImageOptions } from "./decodeImage";
import { Image as RosImage } from "../../ros";

/**
 * Provides a worker that can process RawImages on a background thread.
 *
 * The input image data must be **copied** to the worker, because image messages may be used
 * concurrently by other panels and features of the app. However, the resulting decoded data is
 * [transferred](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
 * back to the main thread.
 */
export class WorkerImageDecoder {
  #worker: Worker;
  #remote: Comlink.Remote<(typeof import("./WorkerImageDecoder.worker"))["service"]>;
  #abort?: () => void;

  public constructor() {
    this.#worker = new Worker(
      // foxglove-depcheck-used: babel-plugin-transform-import-meta
      new URL("./WorkerImageDecoder.worker", import.meta.url),
    );
    this.#remote = Comlink.wrap(this.#worker);
  }

  /**
   * Copies `image` to the worker, and transfers the decoded result back to the main thread.
   */
  public async decode(
    image: RosImage | RawImage,
    options: Partial<RawImageOptions>,
  ): Promise<ImageData> {
    return await new Promise((resolve, reject) => {
      /** WARNING:
       * Be careful with closures in this function as they can easily create memory leaks
       * by keeping a promise from being GC'ed until the next promise is resolved.
       * Always test that these promises are not keeping images in memory over time.
       */

      /** More decode requests can be made while the last one is being processed
       * so we need to keep track of the previous abort function and abort if the
       * next one finishes before the first. If it's already resolved, then the abort is a noop.
       */
      const prevAbort = this.#abort;
      this.#abort = makeAbort(reject);
      void this.#remote.decode(image, options).then(resolve).catch(reject).finally(prevAbort);
    });
  }

  public terminate(): void {
    /** Need to abort as well as terminate because the worker.terminate() call
     * causes the promise to be neither resolved nor rejected. This creates a circular
     * reference loop with the `.then` functions within the renderable, causing the
     * Renderer to never be garbage collected because it's linked to this ongoing
     * promise and worker.
     */
    this.#abort?.();
    this.#abort = undefined;
    this.#worker.terminate();
  }
}

/** Creates a function that calls the reject function with an abort error */
function makeAbort(reject: (reason?: unknown) => void): () => void {
  return () => {
    reject(new Error("Decode aborted."));
  };
}
