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
    return await this.#remote.decode(image, options);
  }

  public terminate(): void {
    this.#worker.terminate();
  }
}
