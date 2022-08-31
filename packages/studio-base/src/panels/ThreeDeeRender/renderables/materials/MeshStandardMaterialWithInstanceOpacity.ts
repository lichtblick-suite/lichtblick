// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

// Same as MeshStandardMaterial, but supporting a per-instance alpha using an `instanceOpacity` attribute.
// Based on https://github.com/pailhead/three-instanced-mesh/pull/35
export class MeshStandardMaterialWithInstanceOpacity extends THREE.MeshStandardMaterial {
  public constructor(parameters?: THREE.MeshStandardMaterialParameters) {
    super(parameters);
  }

  public override onBeforeCompile(shader: THREE.Shader, renderer: THREE.WebGLRenderer): void {
    super.onBeforeCompile(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <color_pars_vertex>",
        `
        #include <color_pars_vertex>
        attribute float instanceOpacity;
        varying float vInstanceOpacity;
        `,
      )
      .replace(
        "#include <color_vertex>",
        `
        #include <color_vertex>
        vInstanceOpacity = instanceOpacity;
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <color_pars_fragment>",
        `
        #include <color_pars_fragment>
        varying float vInstanceOpacity;
        `,
      )
      .replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        diffuseColor.a = vInstanceOpacity * opacity;
        `,
      );
  }
}
