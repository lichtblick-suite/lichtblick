// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import dracoDecoderWasmUrl from "three/examples/jsm/../js/libs/draco/draco_decoder.wasm";
import dracoWasmWrapperJs from "three/examples/jsm/../js/libs/draco/draco_wasm_wrapper.js?raw";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";

export type LoadModelOptions = {
  edgeMaterial: THREE.Material;
  ignoreColladaUpAxis?: boolean;
};

export type LoadedModel = THREE.Group | THREE.Scene;

const DEFAULT_COLOR = new THREE.Color(0x248eff).convertSRGBToLinear();

export class ModelCache {
  private _gltfLoader = new GLTFLoader();
  private _stlLoader = new STLLoader();
  private _daeLoader = new ColladaLoader();
  private _objLoader = new OBJLoader();
  private _textDecoder = new TextDecoder();
  private _models = new Map<string, Promise<LoadedModel | undefined>>();
  private _edgeMaterial: THREE.Material;

  constructor(private loadModelOptions: LoadModelOptions) {
    this._edgeMaterial = loadModelOptions.edgeMaterial;
    this._gltfLoader.setDRACOLoader(createDracoLoader());
  }

  async load(url: string, reportError: (_: Error) => void): Promise<LoadedModel | undefined> {
    let promise = this._models.get(url);
    if (promise) {
      return await promise;
    }

    promise = this._loadModel(url, this.loadModelOptions)
      .then((model) => (model ? addEdges(model, this._edgeMaterial) : undefined))
      .catch(async (err) => {
        reportError(err as Error);
        return undefined;
      });

    this._models.set(url, promise);
    return await promise;
  }

  private async _loadModel(
    url: string,
    options: LoadModelOptions,
  ): Promise<LoadedModel | undefined> {
    const GLB_MAGIC = 0x676c5446; // "glTF"

    const response = await fetch(url);
    if (!response.ok) {
      const errMsg = response.statusText;
      throw new Error(
        `Error ${response.status}${errMsg ? ` (${errMsg})` : ``} loading model from <${url}>`,
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 4) {
      throw new Error(`${buffer.byteLength} bytes received loading model from <${url}>`);
    }
    const view = new DataView(buffer);

    // Check if this is a glTF .glb file
    if (GLB_MAGIC === view.getUint32(0, false)) {
      const gltf = await this._gltfLoader.loadAsync(url);

      // THREE.js uses Y-up, while Studio follows the ROS
      // [REP-0103](https://www.ros.org/reps/rep-0103.html) convention of Z-up
      gltf.scene.rotateZ(Math.PI / 2);
      gltf.scene.rotateX(Math.PI / 2);

      return gltf.scene;
    }

    // STL binary files don't have a header, so we have to rely on the MIME type or file extension
    const contentType = response.headers.get("content-type") ?? "";
    if (STL_MIME_TYPES.includes(contentType) || /\.stl$/i.test(url)) {
      const bufferGeometry = this._stlLoader.parse(buffer);
      const material = new THREE.MeshStandardMaterial({
        name: url.slice(-32),
        color: DEFAULT_COLOR,
        metalness: 0,
        roughness: 1,
        dithering: true,
      });
      const mesh = new THREE.Mesh(bufferGeometry, material);
      const group = new THREE.Group();
      group.add(mesh);
      return group;
    }

    if (DAE_MIME_TYPES.includes(contentType) || /\.dae$/i.test(url)) {
      let text = this._textDecoder.decode(buffer);
      if (options.ignoreColladaUpAxis === true) {
        const xml = new DOMParser().parseFromString(text, "application/xml");
        xml.querySelectorAll("up_axis").forEach((node) => node.remove());
        text = xml.documentElement.outerHTML;
      }
      const dae = this._daeLoader.parse(text, "./model.dae");
      return dae.scene;
    }

    if (OBJ_MIME_TYPES.includes(contentType) || /\.obj$/i.test(url)) {
      const text = this._textDecoder.decode(buffer);
      const group = this._objLoader.parse(text);
      return fixMaterials(group);
    }

    throw new Error(`Unknown mesh resource type at ${url}`);
  }
}

// https://github.com/Ultimaker/Cura/issues/4141
const STL_MIME_TYPES = ["model/stl", "model/x.stl-ascii", "model/x.stl-binary", "application/sla"];
const DAE_MIME_TYPES = ["model/vnd.collada+xml"];
const OBJ_MIME_TYPES = ["model/obj", "text/prs.wavefront-obj"];

function createDracoLoader(): DRACOLoader {
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

  return dracoLoader;
}

function addEdges(model: LoadedModel, edgeMaterial: THREE.Material): LoadedModel {
  const edgesToAdd: [edges: THREE.LineSegments, parent: THREE.Object3D][] = [];

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    // Enable shadows for all meshes
    child.castShadow = true;
    child.receiveShadow = true;

    // Draw edges for all meshes
    const edgesGeometry = new THREE.EdgesGeometry(child.geometry, 40);
    const line = new THREE.LineSegments(edgesGeometry, edgeMaterial);
    edgesToAdd.push([line, child]);
  });

  for (const [line, parent] of edgesToAdd) {
    parent.add(line);
  }
  return model;
}

function fixMaterials(model: LoadedModel): LoadedModel {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    if (child.material instanceof THREE.MeshPhongMaterial) {
      const material = phongToStandard(child.material);
      child.material.dispose();
      child.material = material;
    }

    if (child.material instanceof THREE.MeshStandardMaterial) {
      child.material.metalness = 0;
      child.material.roughness = 1;
      child.material.dithering = true;
    }
  });
  return model;
}

function phongToStandard(material: THREE.MeshPhongMaterial): THREE.MeshStandardMaterial {
  const standard = new THREE.MeshStandardMaterial({ name: material.name });
  standard.copy(material);
  return standard;
}
