// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { setEmbeddedMaterialsOpacity, updateEmbeddedMaterialsOpacity } from "./models";

describe("setEmbeddedMaterialsOpacity", () => {
  it("clones embedded materials and applies opacity without mutating cached materials", () => {
    // Given
    const cachedMaterial = new THREE.MeshStandardMaterial({
      opacity: 0.8,
      transparent: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial);
    const model = new THREE.Group();
    model.add(mesh);

    // When
    setEmbeddedMaterialsOpacity(model, 0.5);

    // Then
    const instanceMaterial = mesh.material;
    expect(instanceMaterial).not.toBe(cachedMaterial);
    expect(instanceMaterial.opacity).toBeCloseTo(0.4);
    expect(instanceMaterial.transparent).toBe(true);
    expect(instanceMaterial.depthWrite).toBe(false);
    expect(cachedMaterial.opacity).toBe(0.8);
    expect(cachedMaterial.transparent).toBe(false);
    expect(cachedMaterial.depthWrite).toBe(true);
  });

  it("reuses one cloned material when multiple children share the source material", () => {
    // Given
    const sharedMaterial = new THREE.MeshStandardMaterial({ opacity: 1 });
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), sharedMaterial);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), sharedMaterial);
    const model = new THREE.Group();
    model.add(meshA, meshB);

    // When
    setEmbeddedMaterialsOpacity(model, 0.5);

    // Then
    expect(meshA.material).not.toBe(sharedMaterial);
    expect(meshA.material).toBe(meshB.material);
    expect((meshA.material as THREE.Material).opacity).toBeCloseTo(0.5);
  });

  it("applies opacity to LineSegments and Points as well as meshes", () => {
    const meshMaterial = new THREE.MeshStandardMaterial({ opacity: 1 });
    const lineMaterial = new THREE.LineBasicMaterial({ opacity: 1 });
    const pointsMaterial = new THREE.PointsMaterial({ opacity: 1 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), meshMaterial);
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
    const points = new THREE.Points(new THREE.BufferGeometry(), pointsMaterial);
    const model = new THREE.Group();
    model.add(mesh, lines, points);

    setEmbeddedMaterialsOpacity(model, 0.25);

    expect((mesh.material as THREE.Material).opacity).toBeCloseTo(0.25);
    expect((lines.material as THREE.Material).opacity).toBeCloseTo(0.25);
    expect((points.material as THREE.Material).opacity).toBeCloseTo(0.25);
    expect(meshMaterial.opacity).toBe(1);
    expect(lineMaterial.opacity).toBe(1);
    expect(pointsMaterial.opacity).toBe(1);
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

  it("skips children without a material property", () => {
    const material = new THREE.MeshStandardMaterial({ opacity: 1 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    const model = new THREE.Group();
    model.add(new THREE.Group(), mesh);

    expect(() => {
      setEmbeddedMaterialsOpacity(model, 0.5);
    }).not.toThrow();
    expect((mesh.material as THREE.Material).opacity).toBeCloseTo(0.5);
  });
});

describe("updateEmbeddedMaterialsOpacity", () => {
  it("updates opacity in place without recloning or compounding multipliers", () => {
    // Given
    const cachedMaterial = new THREE.MeshStandardMaterial({ opacity: 0.8 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial);
    const model = new THREE.Group();
    model.add(mesh);

    setEmbeddedMaterialsOpacity(model, 0.5);
    const instanceMaterial = mesh.material;
    expect(instanceMaterial.opacity).toBeCloseTo(0.4);

    // When / Then
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

  it("updates LineSegments opacity in place", () => {
    const cachedMaterial = new THREE.LineBasicMaterial({ opacity: 1 });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry(), cachedMaterial);
    const model = new THREE.Group();
    model.add(lines);

    setEmbeddedMaterialsOpacity(model, 0.5);
    const instanceMaterial = lines.material as THREE.Material;

    updateEmbeddedMaterialsOpacity(model, 0.25);

    expect(lines.material).toBe(instanceMaterial);
    expect(instanceMaterial.opacity).toBeCloseTo(0.25);
  });

  it("updates every material in a multi-material mesh in place", () => {
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
    const cloned = mesh.material as THREE.Material[];

    updateEmbeddedMaterialsOpacity(model, 0.5);
    expect(cloned[0].opacity).toBeCloseTo(0.5);
    expect(cloned[1].opacity).toBeCloseTo(0.25);
  });

  it("increments material version only when transparent or depthWrite flip", () => {
    // Given
    const cachedMaterial = new THREE.MeshStandardMaterial({ opacity: 1, transparent: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), cachedMaterial);
    const model = new THREE.Group();
    model.add(mesh);

    setEmbeddedMaterialsOpacity(model, 1);
    const instanceMaterial = mesh.material;
    const versionAfterSetup = instanceMaterial.version;

    // When / Then — same structural flags (still fully opaque) — no shader recompile needed.
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
