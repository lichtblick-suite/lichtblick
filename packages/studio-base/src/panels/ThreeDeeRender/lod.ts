// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export enum DetailLevel {
  Low,
  Medium,
  High,
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
