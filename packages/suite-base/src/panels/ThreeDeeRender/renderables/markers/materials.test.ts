/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { shouldShowMarkerOutlines, updateStandardMaterialColor } from "./materials";

describe("shouldShowMarkerOutlines", () => {
  it("defaults showOutlines to true and requires opaque alpha", () => {
    expect(shouldShowMarkerOutlines({ showOutlines: undefined, alpha: 1 })).toBe(true);
    expect(shouldShowMarkerOutlines({ showOutlines: undefined, alpha: 0.5 })).toBe(false);
    expect(shouldShowMarkerOutlines({ showOutlines: true, alpha: 1 })).toBe(true);
    expect(shouldShowMarkerOutlines({ showOutlines: false, alpha: 1 })).toBe(false);
    expect(shouldShowMarkerOutlines({ showOutlines: true, alpha: 0.99 })).toBe(false);
  });
});

describe("updateStandardMaterialColor", () => {
  it("updates color, opacity, and transparency flags", () => {
    const material = new THREE.MeshStandardMaterial({
      transparent: false,
      depthWrite: true,
      opacity: 1,
    });

    updateStandardMaterialColor(material, { r: 1, g: 0, b: 0, a: 0.4 });

    expect(material.opacity).toBe(0.4);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);

    updateStandardMaterialColor(material, { r: 0, g: 1, b: 0, a: 1 });

    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
  });
});
