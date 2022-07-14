// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

type vec4 = [number, number, number, number];

export class ScreenOverlay extends THREE.Object3D {
  private static geometry: THREE.PlaneGeometry | undefined;

  material: THREE.ShaderMaterial;

  constructor() {
    super();

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { color: { value: [0, 0, 0, 0.8] } },
      vertexShader: /* glsl */ `
        void main() {
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec4 color;
        void main() {
          gl_FragColor = color;
        }
      `,
    });

    const mesh = new THREE.Mesh(ScreenOverlay.Geometry(), this.material);
    this.add(mesh);
  }

  setColor(color: THREE.Color, opacity: number): void {
    const colorUniform = this.material.uniforms.color!.value as vec4;
    colorUniform[0] = color.r;
    colorUniform[1] = color.g;
    colorUniform[2] = color.b;
    colorUniform[3] = opacity;
  }

  static Geometry(): THREE.PlaneGeometry {
    if (!ScreenOverlay.geometry) {
      ScreenOverlay.geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
      ScreenOverlay.geometry.computeBoundingSphere();
    }
    return ScreenOverlay.geometry;
  }
}
