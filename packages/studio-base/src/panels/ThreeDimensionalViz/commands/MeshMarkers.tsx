// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { ReactElement, useMemo, useCallback } from "react";
import { useToasts } from "react-toast-notifications";

import { CommonCommandProps, GLTFScene, parseGLB } from "@foxglove/regl-worldview";
import RemountOnValueChange from "@foxglove/studio-base/components/RemountOnValueChange";
import notFoundModelURL from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/404.glb";
import { GlbModel } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/GlbModel";
import { parseDaeToGlb } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/parseDaeToGlb";
import { parseStlToGlb } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/parseStlToGlb";
import { MeshMarker } from "@foxglove/studio-base/types/Messages";

type MeshMarkerProps = CommonCommandProps & {
  markers: MeshMarker[];
  loadModelOptions: LoadModelOptions;
};

async function loadNotFoundModel(): Promise<GlbModel> {
  const response = await fetch(notFoundModelURL);
  if (!response.ok) {
    throw new Error(`Unable to load 404.glb: ${response.status}`);
  }
  return (await parseGLB(await response.arrayBuffer())) as GlbModel;
}

// https://github.com/Ultimaker/Cura/issues/4141
const STL_MIME_TYPES = ["model/stl", "model/x.stl-ascii", "model/x.stl-binary", "application/sla"];
const DAE_MIME_TYPES = ["model/vnd.collada+xml"];

export type LoadModelOptions = {
  ignoreColladaUpAxis?: boolean;
};
async function loadModel(url: string, options: LoadModelOptions): Promise<GlbModel | undefined> {
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
    return (await parseGLB(buffer)) as GlbModel;
  }

  // STL binary files don't have a header, so we have to rely on the MIME type or file extension
  const contentType = response.headers.get("content-type") ?? "";
  if (STL_MIME_TYPES.includes(contentType) || /\.stl$/i.test(url)) {
    return parseStlToGlb(buffer);
  }

  if (DAE_MIME_TYPES.includes(contentType) || /\.dae$/i.test(url)) {
    return await parseDaeToGlb(buffer, options);
  }

  throw new Error(`Unknown mesh resource type at ${url}`);
}

class ModelCache {
  private models = new Map<string, Promise<GlbModel | undefined>>();

  public constructor(private loadModelOptions: LoadModelOptions) {}

  public async load(url: string, reportError: (_: Error) => void): Promise<GlbModel | undefined> {
    let promise = this.models.get(url);
    if (promise) {
      return await promise;
    }
    promise = loadModel(url, this.loadModelOptions).catch(async (err) => {
      reportError(err as Error);
      return await loadNotFoundModel();
    });
    this.models.set(url, promise);
    return await promise;
  }
}

function MeshMarkers({ markers, loadModelOptions, layerIndex }: MeshMarkerProps): ReactElement {
  const models: React.ReactNode[] = [];

  const modelCache = useMemo(() => new ModelCache(loadModelOptions), [loadModelOptions]);
  const { addToast } = useToasts();
  const reportError = useCallback(
    (error: Error) => {
      addToast(error.toString(), { appearance: "error", autoDismiss: true });
    },
    [addToast],
  );

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]!;
    const { mesh_resource, mesh_use_embedded_materials, color } = marker;
    if (!mesh_resource) {
      continue;
    }
    const url = mesh_resource;
    const alpha = (color?.a ?? 0) > 0 ? color!.a : 1;

    const newMarker = {
      ...marker,
      alpha,
      overrideColor: mesh_use_embedded_materials ? undefined : color,
    };
    delete newMarker.color; // color field is used for hitmap

    models.push(
      <GLTFScene
        key={i}
        layerIndex={layerIndex}
        model={async () => await modelCache.load(url, reportError)}
      >
        {newMarker}
      </GLTFScene>,
    );
  }

  return <RemountOnValueChange value={modelCache}>{...models}</RemountOnValueChange>;
}

export default MeshMarkers;
