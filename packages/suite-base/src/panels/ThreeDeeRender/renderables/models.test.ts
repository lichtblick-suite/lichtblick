// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { setEmbeddedMaterialsOpacity, updateEmbeddedMaterialsOpacity } from "./models";

describe("setEmbeddedMaterialsOpacity", () => {
  it("clones embedded materials and applies opacity without mutating cached materials", () => {
    const cachedMaterial = new THREE.MeshStandardMaterial({
      opacity: 0.8,
      transparent: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial);
    const model = new THREE.Group();
    model.add(mesh);

    setEmbeddedMaterialsOpacity(model, 0.5);

    const instanceMaterial = mesh.material;
    expect(instanceMaterial).not.toBe(cachedMaterial);
    expect(instanceMaterial.opacity).toBeCloseTo(0.4);
    expect(instanceMaterial.transparent).toBe(true);
    expect(instanceMaterial.depthWrite).toBe(false);
    expect(cachedMaterial.opacity).toBe(0.8);
    expect(cachedMaterial.transparent).toBe(false);
    expect(cachedMaterial.depthWrite).toBe(true);
  });

  it("updates every material in a multi-material mesh", () => {
    const opaqueMaterial = new THREE.MeshStandardMaterial({ opacity: 1 });
    const transparentMaterial = new THREE.MeshStandardMaterial({
      opacity: 0.5,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [opaqueMaterial, transparentMaterial]);
    const model = new THREE.Group();
    model.add(mesh);

    setEmbeddedMaterialsOpacity(model, 1);

    const materials = mesh.material;
    expect(materials[0]).not.toBe(opaqueMaterial);
    expect(materials[0]).toMatchObject({ opacity: 1, transparent: false, depthWrite: true });
    expect(materials[1]).not.toBe(transparentMaterial);
    expect(materials[1]).toMatchObject({ opacity: 0.5, transparent: true, depthWrite: false });
  });
});

describe("updateEmbeddedMaterialsOpacity", () => {
  it("updates opacity in place without recloning or compounding multipliers", () => {
    const cachedMaterial = new THREE.MeshStandardMaterial({ opacity: 0.8 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial);
    const model = new THREE.Group();
    model.add(mesh);

    setEmbeddedMaterialsOpacity(model, 0.5);
    const instanceMaterial = mesh.material;
    expect(instanceMaterial.opacity).toBeCloseTo(0.4);

    updateEmbeddedMaterialsOpacity(model, 0.25);
    expect(mesh.material).toBe(instanceMaterial);
    expect(instanceMaterial.opacity).toBeCloseTo(0.2);

    // Full layer opacity restores the intrinsic 0.8 (still translucent because base < 1).
    updateEmbeddedMaterialsOpacity(model, 1);
    expect(mesh.material).toBe(instanceMaterial);
    expect(instanceMaterial.opacity).toBeCloseTo(0.8);
    expect(instanceMaterial.transparent).toBe(true);
    expect(instanceMaterial.depthWrite).toBe(false);
    expect(cachedMaterial.opacity).toBe(0.8);
  });

  it("increments material version only when transparent or depthWrite flip", () => {
    const cachedMaterial = new THREE.MeshStandardMaterial({ opacity: 1, transparent: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial);
    const model = new THREE.Group();
    model.add(mesh);

    setEmbeddedMaterialsOpacity(model, 1);
    const instanceMaterial = mesh.material;
    const versionAfterSetup = instanceMaterial.version;

    // Same structural flags (still fully opaque) — no shader recompile needed.
    updateEmbeddedMaterialsOpacity(model, 1);
    expect(instanceMaterial.version).toBe(versionAfterSetup);

    // Crossing into translucent flips transparent/depthWrite.
    updateEmbeddedMaterialsOpacity(model, 0.5);
    expect(instanceMaterial.transparent).toBe(true);
    expect(instanceMaterial.version).toBeGreaterThan(versionAfterSetup);

    const versionAfterFlip = instanceMaterial.version;
    updateEmbeddedMaterialsOpacity(model, 0.25);
    expect(instanceMaterial.version).toBe(versionAfterFlip);
  });
});
