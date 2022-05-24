// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dracoDecoderWasmUrl from "three/examples/jsm/../js/libs/draco/draco_decoder.wasm";
import dracoWasmWrapperJs from "three/examples/jsm/../js/libs/draco/draco_wasm_wrapper.js?raw";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader";

export type LoadModelOptions = {
  ignoreColladaUpAxis?: boolean;
};

export class ModelCache {
  private _gltfLoader = new GLTFLoader();
  private _models = new Map<string, Promise<GLTF | undefined>>();

  constructor(private loadModelOptions: LoadModelOptions) {
    const dracoLoader = new DRACOLoader();

    // Hack in a replacement function to load assets from the webpack bundle
    (dracoLoader as { _loadLibrary?: (url: string, responseType: string) => unknown })[
      "_loadLibrary"
    ] = async function (url: string, responseType: string) {
      if (url === "draco_wasm_wrapper.js" && responseType === "text") {
        return dracoWasmWrapperJs;
      } else if (url === "draco_decoder.wasm" && responseType === "arraybuffer") {
        return await (await fetch(dracoDecoderWasmUrl)).arrayBuffer();
      } else {
        throw new Error(`DRACOLoader attempt to load non-bundled asset: ${url} as ${responseType}`);
      }
    };
    this._gltfLoader.setDRACOLoader(dracoLoader);
  }

  async load(url: string, reportError: (_: Error) => void): Promise<GLTF | undefined> {
    let promise = this._models.get(url);
    if (promise) {
      return await promise;
    }

    promise = this._loadModel(url, this.loadModelOptions).catch(async (err) => {
      reportError(err as Error);
      return undefined;
    });
    this._models.set(url, promise);
    return await promise;
  }

  private async _loadModel(url: string, _options: LoadModelOptions): Promise<GLTF | undefined> {
    // TODO: Support other model formats
    const gltf = await this._gltfLoader.loadAsync(url);

    // THREE.js uses Y-up, while we follow the ROS [REP-0103](https://www.ros.org/reps/rep-0103.html)
    // convention of Z-up
    gltf.scene.rotateZ(Math.PI / 2);
    gltf.scene.rotateX(Math.PI / 2);

    return gltf;
  }
}
