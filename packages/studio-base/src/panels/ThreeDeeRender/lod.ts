// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { WebGLCapabilities } from "three";

export enum DetailLevel {
  Low,
  Medium,
  High,
}

/**
 * Returns the number of samples to use for Multi-Sample Anti-Aliasing (MSAA)
 * for the given level of detail.
 */
export function msaaSamples(lod: DetailLevel, capabilities: WebGLCapabilities): number {
  // NOTE: Type definition workaround
  const maxSamples = (capabilities as unknown as { maxSamples: number }).maxSamples;

  switch (lod) {
    case DetailLevel.Low:
      return Math.min(2, maxSamples);
    case DetailLevel.Medium:
      return Math.min(4, maxSamples);
    case DetailLevel.High:
      return maxSamples;
  }
}

export function arrowShaftSubdivisions(lod: DetailLevel): number {
  switch (lod) {
    case DetailLevel.Low:
      return 12;
    case DetailLevel.Medium:
      return 20;
    case DetailLevel.High:
      return 32;
  }
}

export function arrowHeadSubdivisions(lod: DetailLevel): number {
  switch (lod) {
    case DetailLevel.Low:
      return 12;
    case DetailLevel.Medium:
      return 20;
    case DetailLevel.High:
      return 32;
  }
}

export function cylinderSubdivisions(lod: DetailLevel): number {
  switch (lod) {
    case DetailLevel.Low:
      return 12;
    case DetailLevel.Medium:
      return 20;
    case DetailLevel.High:
      return 32;
  }
}

export function sphereSubdivisions(lod: DetailLevel): number {
  switch (lod) {
    case DetailLevel.Low:
      return 10;
    case DetailLevel.Medium:
      return 24;
    case DetailLevel.High:
      return 32;
  }
}
