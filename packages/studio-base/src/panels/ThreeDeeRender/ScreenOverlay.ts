// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

export class ScreenOverlay extends THREE.Object3D {
  private static geometry: THREE.PlaneGeometry | undefined;

  constructor() {
    super();

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        void main() {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.75);
        }
      `,
    });

    const mesh = new THREE.Mesh(ScreenOverlay.Geometry(), material);
    this.add(mesh);
  }

  static Geometry(): THREE.PlaneGeometry {
    if (!ScreenOverlay.geometry) {
      ScreenOverlay.geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
      ScreenOverlay.geometry.computeBoundingSphere();
    }
    return ScreenOverlay.geometry;
  }
}
