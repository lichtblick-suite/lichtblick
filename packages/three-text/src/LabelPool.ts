// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { EventDispatcher } from "three";

import { FontManager, FontManagerOptions } from "./FontManager";

const tempVec2 = new THREE.Vector2();

class LabelMaterial extends THREE.RawShaderMaterial {
  constructor(params: { atlasTexture?: THREE.Texture; picking?: boolean }) {
    super({
      vertexShader: /* glsl */ `\
#version 300 es
precision highp float;
precision highp int;
uniform mat4 projectionMatrix, modelViewMatrix, modelMatrix;

uniform bool uBillboard;
uniform bool uSizeAttenuation;
uniform float uScale;
uniform vec2 uLabelSize;
uniform vec2 uTextureSize;
uniform vec2 uAnchorPoint;
uniform vec2 uCanvasSize;

in vec2 uv;
in vec2 position;
in vec2 instanceBoxPosition, instanceCharPosition;
in vec2 instanceUv;
in vec2 instanceBoxSize, instanceCharSize;
out mediump vec2 vUv;
out mediump vec2 vInsideChar;
out mediump vec2 vPosInLabel;
void main() {
  // Adjust uv coordinates so they are in the 0-1 range in the character region
  vec2 boxUv = (uv * instanceBoxSize - (instanceCharPosition - instanceBoxPosition)) / instanceCharSize;
  vInsideChar = boxUv;
  vUv = (instanceUv + boxUv * instanceCharSize) / uTextureSize;
  vec2 vertexPos = (instanceBoxPosition + position * instanceBoxSize - uAnchorPoint * uLabelSize) * uScale;
  vPosInLabel = (instanceBoxPosition + position * instanceBoxSize);

  // Adapted from THREE.ShaderLib.sprite
  if (uBillboard) {
    if (uSizeAttenuation) {
      vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
      mvPosition.xy += vertexPos;
      gl_Position = projectionMatrix * mvPosition;
    } else {
      vec4 mvPosition = modelViewMatrix * vec4(0., 0., 0., 1.);

      // Adapted from THREE.ShaderLib.sprite
      vec2 scale;
      scale.x = length(vec3(modelMatrix[0].xyz));
      scale.y = length(vec3(modelMatrix[1].xyz));

      gl_Position = projectionMatrix * mvPosition;

      // Add position after projection to maintain constant pixel size
      gl_Position.xy += vertexPos * 2. / uCanvasSize * scale * gl_Position.w;
    }
  } else {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vertexPos, 0.0, 1.0);
  }
}
`,
      fragmentShader:
        params.picking === true
          ? /* glsl */ `\
#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif
uniform vec4 objectId;
out vec4 outColor;
void main() {
  outColor = objectId;
}
`
          : /* glsl */ `\
#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
#else
  precision mediump float;
#endif
uniform sampler2D uMap;
uniform float uOpacity;
uniform mediump vec3 uColor, uBackgroundColor;
uniform float uScale;
uniform vec2 uLabelSize;
in mediump vec2 vUv;
in mediump vec2 vPosInLabel;
in mediump vec2 vInsideChar;
out vec4 outColor;

${THREE.ShaderChunk.encodings_pars_fragment /* for LinearTosRGB() */}

// From https://github.com/Jam3/three-bmfont-text/blob/e17efbe4e9392a83d4c5ee35c67eca5a11a13395/shaders/sdf.js
float aastep(float threshold, float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

void main() {
  float dist = texture(uMap, vUv).a;
  vec4 color = vec4(uBackgroundColor.rgb * (1.0 - dist) + uColor * dist, uOpacity);
  outColor = vec4(mix(uBackgroundColor, uColor, aastep(0.75, dist)), uOpacity);

  bool insideChar = vInsideChar.x >= 0.0 && vInsideChar.x <= 1.0 && vInsideChar.y >= 0.0 && vInsideChar.y <= 1.0;
  outColor = insideChar ? outColor : vec4(uBackgroundColor, uOpacity);
  outColor = LinearTosRGB(outColor);
}
`,
      uniforms: {
        objectId: { value: [NaN, NaN, NaN, NaN] },
        uAnchorPoint: { value: [0.5, 0.5] },
        uBillboard: { value: false },
        uSizeAttenuation: { value: true },
        uLabelSize: { value: [0, 0] },
        uCanvasSize: { value: [0, 0] },
        uScale: { value: 0 },
        uTextureSize: {
          value: [params.atlasTexture?.image.width ?? 0, params.atlasTexture?.image.height ?? 0],
        },
        uMap: { value: params.atlasTexture },
        uOpacity: { value: 1 },
        uColor: { value: [0, 0, 0] },
        uBackgroundColor: { value: [1, 1, 1] },
      },

      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
    });
  }
}

export class Label extends THREE.Object3D {
  text = "";
  mesh: THREE.InstancedMesh;
  geometry: THREE.InstancedBufferGeometry;
  material: LabelMaterial;
  pickingMaterial: LabelMaterial;

  instanceAttrData: Float32Array;
  instanceAttrBuffer: THREE.InstancedInterleavedBuffer;

  instanceBoxPosition: THREE.InterleavedBufferAttribute;
  instanceCharPosition: THREE.InterleavedBufferAttribute;
  instanceUv: THREE.InterleavedBufferAttribute;
  instanceBoxSize: THREE.InterleavedBufferAttribute;
  instanceCharSize: THREE.InterleavedBufferAttribute;

  lineHeight = 1;

  constructor(public labelPool: LabelPool) {
    super();

    this.geometry = new THREE.InstancedBufferGeometry();

    this.geometry.setAttribute("position", LabelPool.QUAD_POSITIONS);
    this.geometry.setAttribute("uv", LabelPool.QUAD_UVS);

    this.instanceAttrData = new Float32Array();
    this.instanceAttrBuffer = new THREE.InstancedInterleavedBuffer(this.instanceAttrData, 10, 1);
    this.instanceBoxPosition = new THREE.InterleavedBufferAttribute(this.instanceAttrBuffer, 2, 0);
    this.instanceCharPosition = new THREE.InterleavedBufferAttribute(this.instanceAttrBuffer, 2, 2);
    this.instanceUv = new THREE.InterleavedBufferAttribute(this.instanceAttrBuffer, 2, 4);
    this.instanceBoxSize = new THREE.InterleavedBufferAttribute(this.instanceAttrBuffer, 2, 6);
    this.instanceCharSize = new THREE.InterleavedBufferAttribute(this.instanceAttrBuffer, 2, 8);
    this.geometry.setAttribute("instanceBoxPosition", this.instanceBoxPosition);
    this.geometry.setAttribute("instanceCharPosition", this.instanceCharPosition);
    this.geometry.setAttribute("instanceUv", this.instanceUv);
    this.geometry.setAttribute("instanceBoxSize", this.instanceBoxSize);
    this.geometry.setAttribute("instanceCharSize", this.instanceCharSize);

    this.material = new LabelMaterial({ atlasTexture: labelPool.atlasTexture });
    this.pickingMaterial = new LabelMaterial({ picking: true });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 0);
    this.mesh.userData.pickingMaterial = this.pickingMaterial;

    this.mesh.onBeforeRender = (renderer, _scene, _camera, _geometry, _material, _group) => {
      renderer.getSize(tempVec2);
      this.material.uniforms.uCanvasSize!.value[0] = tempVec2.x;
      this.material.uniforms.uCanvasSize!.value[1] = tempVec2.y;
      this.pickingMaterial.uniforms.uCanvasSize!.value[0] = tempVec2.x;
      this.pickingMaterial.uniforms.uCanvasSize!.value[1] = tempVec2.y;
    };

    this.add(this.mesh);
    this.setOpacity(1);

    labelPool.addEventListener("scaleFactorChange", () => {
      // Trigger recalculation of scale uniform
      this.setLineHeight(this.lineHeight);
    });

    labelPool.addEventListener("atlasChange", () => {
      this._handleAtlasChange();
    });
    this._handleAtlasChange();
  }

  private _handleAtlasChange() {
    this.material.uniforms.uTextureSize!.value[0] = this.labelPool.atlasTexture.image.width;
    this.material.uniforms.uTextureSize!.value[1] = this.labelPool.atlasTexture.image.height;
    this.setLineHeight(this.lineHeight);
    this._needsUpdateLayout = true;
    this._updateLayoutIfNeeded();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.pickingMaterial.dispose();
    this.mesh.dispose();
  }

  private reallocateAttributeBufferIfNeeded(numChars: number) {
    const requiredLength = numChars * 10 * Float32Array.BYTES_PER_ELEMENT;
    if (this.instanceAttrData.byteLength < requiredLength) {
      this.instanceAttrData = new Float32Array(requiredLength);
      this.instanceAttrBuffer = new THREE.InstancedInterleavedBuffer(this.instanceAttrData, 10, 1);
      this.instanceBoxPosition.data = this.instanceAttrBuffer;
      this.instanceCharPosition.data = this.instanceAttrBuffer;
      this.instanceUv.data = this.instanceAttrBuffer;
      this.instanceBoxSize.data = this.instanceAttrBuffer;
      this.instanceCharSize.data = this.instanceAttrBuffer;
    }
  }

  setText(text: string): void {
    if (text !== this.text) {
      this.text = text;
      this._needsUpdateLayout = true;
      this.labelPool.updateAtlas(text);
      this._updateLayoutIfNeeded();
    }
  }

  private _needsUpdateLayout = false;
  private _updateLayoutIfNeeded() {
    if (!this._needsUpdateLayout) {
      return;
    }
    const layoutInfo = this.labelPool.fontManager.layout(this.text);
    this.material.uniforms.uLabelSize!.value[0] = layoutInfo.width;
    this.material.uniforms.uLabelSize!.value[1] = layoutInfo.height;
    this.pickingMaterial.uniforms.uLabelSize!.value[0] = layoutInfo.width;
    this.pickingMaterial.uniforms.uLabelSize!.value[1] = layoutInfo.height;

    this.geometry.instanceCount = this.mesh.count = layoutInfo.chars.length;

    this.reallocateAttributeBufferIfNeeded(layoutInfo.chars.length);

    let i = 0;
    for (const char of layoutInfo.chars) {
      // instanceBoxPosition
      this.instanceAttrData[i++] = char.left;
      this.instanceAttrData[i++] = layoutInfo.height - char.boxTop - char.boxHeight;
      // instanceCharPosition
      this.instanceAttrData[i++] = char.left;
      this.instanceAttrData[i++] =
        layoutInfo.height - char.boxTop - char.boxHeight + char.top - char.boxTop;
      // instanceUv
      this.instanceAttrData[i++] = char.atlasX;
      this.instanceAttrData[i++] = char.atlasY;
      // instanceBoxSize
      this.instanceAttrData[i++] = char.xAdvance;
      this.instanceAttrData[i++] = char.boxHeight;
      // instanceCharSize
      this.instanceAttrData[i++] = char.width;
      this.instanceAttrData[i++] = char.height;
    }
    this.instanceAttrBuffer.needsUpdate = true;
    this._needsUpdateLayout = false;
  }

  setColor(r: number, g: number, b: number): void {
    this.material.uniforms.uColor!.value[0] = r;
    this.material.uniforms.uColor!.value[1] = g;
    this.material.uniforms.uColor!.value[2] = b;
  }
  setBackgroundColor(r: number, g: number, b: number): void {
    this.material.uniforms.uBackgroundColor!.value[0] = r;
    this.material.uniforms.uBackgroundColor!.value[1] = g;
    this.material.uniforms.uBackgroundColor!.value[2] = b;
  }
  setOpacity(opacity: number): void {
    this.material.uniforms.uOpacity!.value = opacity;
    const transparent = opacity < 1;
    this.material.transparent = transparent;
    this.material.depthWrite = !transparent;
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setBillboard(billboard: boolean): void {
    this.material.uniforms.uBillboard!.value = billboard;
    this.pickingMaterial.uniforms.uBillboard!.value = billboard;
  }

  /**
   * Enable or disable size attenuation. Setting this to `false` also requires that billboarding is
   * enabled.
   */
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setSizeAttenuation(sizeAttenuation: boolean): void {
    this.material.uniforms.uSizeAttenuation!.value = sizeAttenuation;
    this.pickingMaterial.uniforms.uSizeAttenuation!.value = sizeAttenuation;
  }

  setAnchorPoint(x: number, y: number): void {
    this.material.uniforms.uAnchorPoint!.value[0] = x;
    this.material.uniforms.uAnchorPoint!.value[1] = y;
    this.pickingMaterial.uniforms.uAnchorPoint!.value[0] = x;
    this.pickingMaterial.uniforms.uAnchorPoint!.value[1] = y;
  }

  setLineHeight(lineHeight: number): void {
    this.lineHeight = lineHeight;
    const scale =
      (this.lineHeight * this.labelPool.scaleFactor) /
      this.labelPool.fontManager.atlasData.lineHeight;
    this.material.uniforms.uScale!.value = scale;
    this.pickingMaterial.uniforms.uScale!.value = scale;
  }
}

export class LabelPool extends EventDispatcher<{ type: "scaleFactorChange" | "atlasChange" }> {
  atlasTexture: THREE.DataTexture;

  private availableLabels: Label[] = [];
  private disposed = false;

  static QUAD_POINTS: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  static QUAD_POSITIONS = new THREE.BufferAttribute(new Float32Array(this.QUAD_POINTS.flat()), 2);
  static QUAD_UVS = new THREE.BufferAttribute(
    new Float32Array(this.QUAD_POINTS.flatMap(([x, y]) => [x, 1 - y])),
    2,
  );

  fontManager: FontManager;
  scaleFactor = 1;

  setScaleFactor(scaleFactor: number): void {
    this.scaleFactor = scaleFactor;
    this.dispatchEvent({ type: "scaleFactorChange" });
  }

  constructor(options: FontManagerOptions = {}) {
    super();
    this.fontManager = new FontManager(options);

    this.atlasTexture = new THREE.DataTexture(
      new Uint8ClampedArray(),
      0,
      0,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
      THREE.UVMapping,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
      THREE.LinearFilter,
      THREE.LinearFilter,
    );

    this.fontManager.addEventListener("atlasChange", () => {
      this._updateAtlasTexture();
    });
    this._updateAtlasTexture();
  }

  updateAtlas(text: string): void {
    this.fontManager.update(text);
  }

  private _updateAtlasTexture() {
    const data = new Uint8ClampedArray(this.fontManager.atlasData.data.length * 4);
    for (let i = 0; i < this.fontManager.atlasData.data.length; i++) {
      data[i * 4 + 0] = data[i * 4 + 1] = data[i * 4 + 2] = 1;
      data[i * 4 + 3] = this.fontManager.atlasData.data[i]!;
    }

    this.atlasTexture.image = {
      data,
      width: this.fontManager.atlasData.width,
      height: this.fontManager.atlasData.height,
    };
    this.atlasTexture.needsUpdate = true;
    this.dispatchEvent({ type: "atlasChange" });
  }

  acquire(): Label {
    return this.availableLabels.pop() ?? new Label(this);
  }

  release(label: Label): void {
    if (this.disposed) {
      label.dispose();
    } else {
      label.removeFromParent();
      this.availableLabels.push(label);
    }
  }

  dispose(): void {
    for (const label of this.availableLabels) {
      label.dispose();
    }
    this.atlasTexture.dispose();
    this.disposed = true;
  }
}
