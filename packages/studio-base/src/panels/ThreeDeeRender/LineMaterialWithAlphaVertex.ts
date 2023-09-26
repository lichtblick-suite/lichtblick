// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Adapted from <https://github.com/mrdoob/three.js/blob/master/examples/jsm/lines/LineMaterial.js>
// to support vertex color alpha channel

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-restricted-syntax */

/**
 * parameters = {
 *  color: <hex>,
 *  linewidth: <float>,
 *  dashed: <boolean>,
 *  dashScale: <float>,
 *  dashSize: <float>,
 *  dashOffset: <float>,
 *  gapSize: <float>,
 *  resolution: <Vector2>, // to be set by renderer
 * }
 */

import {
  ShaderLib,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2,
  MaterialParameters,
} from "three";

(UniformsLib as any).line = {
  worldUnits: { value: 1 },
  linewidth: { value: 1 },
  resolution: { value: new Vector2(1, 1) },
  dashOffset: { value: 0 },
  dashScale: { value: 1 },
  dashSize: { value: 1 },
  gapSize: { value: 1 },
};

ShaderLib["foxglove.line"] = {
  uniforms: UniformsUtils.merge([UniformsLib.common, UniformsLib.fog, (UniformsLib as any).line]),

  vertexShader: /* glsl */ `
    #include <common>
    #include <color_pars_vertex>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>
    #include <clipping_planes_pars_vertex>

    uniform float linewidth;
    uniform vec2 resolution;

    attribute vec3 instanceStart;
    attribute vec3 instanceEnd;

    attribute vec4 instanceColorStart;
    attribute vec4 instanceColorEnd;

    #ifdef WORLD_UNITS

      varying vec4 worldPos;
      varying vec3 worldStart;
      varying vec3 worldEnd;

      #ifdef USE_DASH

        varying vec2 vUv;

      #endif

    #else

      varying vec2 vUv;

    #endif

    #ifdef USE_DASH

      uniform float dashScale;
      attribute float instanceDistanceStart;
      attribute float instanceDistanceEnd;
      varying float vLineDistance;

    #endif

    #ifdef USE_COLOR

      varying float vAlpha;

    #endif

    void trimSegment( const in vec4 start, inout vec4 end ) {

      // trim end segment so it terminates between the camera plane and the near plane

      // conservative estimate of the near plane
      float a = projectionMatrix[ 2 ][ 2 ]; // 3nd entry in 3th column
      float b = projectionMatrix[ 3 ][ 2 ]; // 3nd entry in 4th column
      float nearEstimate = - 0.5 * b / a;

      float alpha = ( nearEstimate - start.z ) / ( end.z - start.z );

      end.xyz = mix( start.xyz, end.xyz, alpha );

    }

    void main() {

      #ifdef USE_COLOR

        vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart.xyz : instanceColorEnd.xyz;
        vAlpha = ( position.y < 0.5 ) ? instanceColorStart.w : instanceColorEnd.w;

      #endif

      #ifdef USE_DASH

        vLineDistance = ( position.y < 0.5 ) ? dashScale * instanceDistanceStart : dashScale * instanceDistanceEnd;
        vUv = uv;

      #endif

      float aspect = resolution.x / resolution.y;

      // camera space
      vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );
      vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );

      #ifdef WORLD_UNITS

        worldStart = start.xyz;
        worldEnd = end.xyz;

      #else

        vUv = uv;

      #endif

      // special case for perspective projection, and segments that terminate either in, or behind, the camera plane
      // clearly the gpu firmware has a way of addressing this issue when projecting into ndc space
      // but we need to perform ndc-space calculations in the shader, so we must address this issue directly
      // perhaps there is a more elegant solution -- WestLangley

      bool perspective = ( projectionMatrix[ 2 ][ 3 ] == - 1.0 ); // 4th entry in the 3rd column

      if ( perspective ) {

        if ( start.z < 0.0 && end.z >= 0.0 ) {

          trimSegment( start, end );

        } else if ( end.z < 0.0 && start.z >= 0.0 ) {

          trimSegment( end, start );

        }

      }

      // clip space
      vec4 clipStart = projectionMatrix * start;
      vec4 clipEnd = projectionMatrix * end;

      // ndc space
      vec3 ndcStart = clipStart.xyz / clipStart.w;
      vec3 ndcEnd = clipEnd.xyz / clipEnd.w;

      // direction
      vec2 dir = ndcEnd.xy - ndcStart.xy;

      // account for clip-space aspect ratio
      dir.x *= aspect;
      dir = normalize( dir );

      #ifdef WORLD_UNITS

        // get the offset direction as perpendicular to the view vector
        vec3 worldDir = normalize( end.xyz - start.xyz );
        vec3 offset;
        if ( position.y < 0.5 ) {

          offset = normalize( cross( start.xyz, worldDir ) );

        } else {

          offset = normalize( cross( end.xyz, worldDir ) );

        }

        // sign flip
        if ( position.x < 0.0 ) offset *= - 1.0;

        float forwardOffset = dot( worldDir, vec3( 0.0, 0.0, 1.0 ) );

        // don't extend the line if we're rendering dashes because we
        // won't be rendering the endcaps
        #ifndef USE_DASH

          // extend the line bounds to encompass  endcaps
          start.xyz += - worldDir * linewidth * 0.5;
          end.xyz += worldDir * linewidth * 0.5;

          // shift the position of the quad so it hugs the forward edge of the line
          offset.xy -= dir * forwardOffset;
          offset.z += 0.5;

        #endif

        // endcaps
        if ( position.y > 1.0 || position.y < 0.0 ) {

          offset.xy += dir * 2.0 * forwardOffset;

        }

        // adjust for linewidth
        offset *= linewidth * 0.5;

        // set the world position
        worldPos = ( position.y < 0.5 ) ? start : end;
        worldPos.xyz += offset;

        // project the worldpos
        vec4 clip = projectionMatrix * worldPos;

        // shift the depth of the projected points so the line
        // segements overlap neatly
        vec3 clipPose = ( position.y < 0.5 ) ? ndcStart : ndcEnd;
        clip.z = clipPose.z * clip.w;

      #else

        vec2 offset = vec2( dir.y, - dir.x );
        // undo aspect ratio adjustment
        dir.x /= aspect;
        offset.x /= aspect;

        // sign flip
        if ( position.x < 0.0 ) offset *= - 1.0;

        // endcaps
        if ( position.y < 0.0 ) {

          offset += - dir;

        } else if ( position.y > 1.0 ) {

          offset += dir;

        }

        // adjust for linewidth
        offset *= linewidth;

        // adjust for clip-space to screen-space conversion // maybe resolution should be based on viewport ...
        offset /= resolution.y;

        // select end
        vec4 clip = ( position.y < 0.5 ) ? clipStart : clipEnd;

        // back to clip space
        offset *= clip.w;

        clip.xy += offset;

      #endif

      gl_Position = clip;

      vec4 mvPosition = ( position.y < 0.5 ) ? start : end; // this is an approximation

      #include <logdepthbuf_vertex>
      #include <clipping_planes_vertex>
      #include <fog_vertex>

    }
    `,

  fragmentShader: /* glsl */ `
    uniform vec3 diffuse;
    uniform float opacity;
    uniform float linewidth;

    #ifdef USE_DASH

      uniform float dashOffset;
      uniform float dashSize;
      uniform float gapSize;

    #endif

    varying float vLineDistance;

    #ifdef WORLD_UNITS

      varying vec4 worldPos;
      varying vec3 worldStart;
      varying vec3 worldEnd;

      #ifdef USE_DASH

        varying vec2 vUv;

      #endif

    #else

      varying vec2 vUv;

    #endif

    #ifdef USE_COLOR

      varying float vAlpha;

    #endif

    #include <common>
    #include <color_pars_fragment>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>
    #include <clipping_planes_pars_fragment>

    vec2 closestLineToLine(vec3 p1, vec3 p2, vec3 p3, vec3 p4) {

      float mua;
      float mub;

      vec3 p13 = p1 - p3;
      vec3 p43 = p4 - p3;

      vec3 p21 = p2 - p1;

      float d1343 = dot( p13, p43 );
      float d4321 = dot( p43, p21 );
      float d1321 = dot( p13, p21 );
      float d4343 = dot( p43, p43 );
      float d2121 = dot( p21, p21 );

      float denom = d2121 * d4343 - d4321 * d4321;

      float numer = d1343 * d4321 - d1321 * d4343;

      mua = numer / denom;
      mua = clamp( mua, 0.0, 1.0 );
      mub = ( d1343 + d4321 * ( mua ) ) / d4343;
      mub = clamp( mub, 0.0, 1.0 );

      return vec2( mua, mub );

    }

    void main() {

      #include <clipping_planes_fragment>

      #ifdef USE_DASH

        if ( vUv.y < - 1.0 || vUv.y > 1.0 ) discard; // discard endcaps

        if ( mod( vLineDistance + dashOffset, dashSize + gapSize ) > dashSize ) discard; // todo - FIX

      #endif

      #ifdef USE_COLOR

      float alpha = vAlpha;

      #else

      float alpha = opacity;

      #endif

      #ifdef WORLD_UNITS

        // Find the closest points on the view ray and the line segment
        vec3 rayEnd = normalize( worldPos.xyz ) * 1e5;
        vec3 lineDir = worldEnd - worldStart;
        vec2 params = closestLineToLine( worldStart, worldEnd, vec3( 0.0, 0.0, 0.0 ), rayEnd );

        vec3 p1 = worldStart + lineDir * params.x;
        vec3 p2 = rayEnd * params.y;
        vec3 delta = p1 - p2;
        float len = length( delta );
        float norm = len / linewidth;

        #ifndef USE_DASH

          #ifdef USE_ALPHA_TO_COVERAGE

            float dnorm = fwidth( norm );
            alpha = 1.0 - smoothstep( 0.5 - dnorm, 0.5 + dnorm, norm );

          #else

            if ( norm > 0.5 ) {

              discard;

            }

          #endif

        #endif

      #else

        #ifdef USE_ALPHA_TO_COVERAGE

          // artifacts appear on some hardware if a derivative is taken within a conditional
          float a = vUv.x;
          float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
          float len2 = a * a + b * b;
          float dlen = fwidth( len2 );

          if ( abs( vUv.y ) > 1.0 ) {

            alpha = 1.0 - smoothstep( 1.0 - dlen, 1.0 + dlen, len2 );

          }

        #else

          if ( abs( vUv.y ) > 1.0 ) {

            float a = vUv.x;
            float b = ( vUv.y > 0.0 ) ? vUv.y - 1.0 : vUv.y + 1.0;
            float len2 = a * a + b * b;

            if ( len2 > 1.0 ) discard;

          }

        #endif

      #endif

      vec4 diffuseColor = vec4( diffuse, alpha );

      #include <logdepthbuf_fragment>
      #include <color_fragment>

      gl_FragColor = vec4( diffuseColor.rgb, alpha );

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      #include <premultiplied_alpha_fragment>

    }
    `,
};

export interface LineMaterialParameters extends MaterialParameters {
  alphaToCoverage?: boolean | undefined;
  color?: number | undefined;
  dashed?: boolean | undefined;
  dashScale?: number | undefined;
  dashSize?: number | undefined;
  dashOffset?: number | undefined;
  gapSize?: number | undefined;
  linewidth?: number | undefined;
  resolution?: Vector2 | undefined;
  wireframe?: boolean | undefined;
  worldUnits?: boolean | undefined;
}

/** LineMaterial that supports vertex colors with an alpha channel */
export class LineMaterialWithAlphaVertex extends ShaderMaterial {
  public readonly isLineMaterial = true;

  public constructor(parameters: LineMaterialParameters) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    super({
      type: "LineMaterial",

      uniforms: UniformsUtils.clone((ShaderLib["foxglove.line"] as any).uniforms),

      vertexShader: (ShaderLib["foxglove.line"] as any).vertexShader,
      fragmentShader: (ShaderLib["foxglove.line"] as any).fragmentShader,

      clipping: true, // required for clipping support
    } as any);

    this.setValues(parameters);
  }

  public get color() {
    return this.uniforms.diffuse!.value;
  }

  public set color(value) {
    this.uniforms.diffuse!.value = value;
  }

  public get worldUnits() {
    return "WORLD_UNITS" in this.defines;
  }

  public set worldUnits(value) {
    if (value) {
      this.defines.WORLD_UNITS = "";
    } else {
      delete this.defines.WORLD_UNITS;
    }
  }

  public get lineWidth() {
    return this.uniforms.linewidth!.value;
  }

  public set lineWidth(value) {
    this.linewidth = value;
    this.uniforms.linewidth!.value = value;
  }

  public get dashed() {
    return Boolean("USE_DASH" in this.defines);
  }

  public set dashed(value) {
    if (Boolean(value) !== Boolean("USE_DASH" in this.defines)) {
      this.needsUpdate = true;
    }

    if (value) {
      this.defines.USE_DASH = "";
    } else {
      delete this.defines.USE_DASH;
    }
  }

  public get dashScale() {
    return this.uniforms.dashScale!.value;
  }

  public set dashScale(value) {
    this.uniforms.dashScale!.value = value;
  }

  public get dashSize() {
    return this.uniforms.dashSize!.value;
  }

  public set dashSize(value) {
    this.uniforms.dashSize!.value = value;
  }

  public get dashOffset() {
    return this.uniforms.dashOffset!.value;
  }

  public set dashOffset(value) {
    this.uniforms.dashOffset!.value = value;
  }

  public get gapSize() {
    return this.uniforms.gapSize!.value;
  }

  public set gapSize(value) {
    this.uniforms.gapSize!.value = value;
  }

  // Cannot use `set opacity()` because it would conflict with the superclass property
  public setOpacity(value: number) {
    this.uniforms.opacity!.value = value;
  }

  public get resolution(): THREE.Vector2 {
    return this.uniforms.resolution!.value;
  }

  public set resolution(value: THREE.Vector2) {
    this.uniforms.resolution!.value.copy(value);
  }
}
