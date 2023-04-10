// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { clamp } from "three/src/math/MathUtils";

import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";
import type { IRenderer } from "../../IRenderer";
import { rgbToThreeColor } from "../../color";
import { arrowHeadSubdivisions, arrowShaftSubdivisions, DetailLevel } from "../../lod";
import { getRotationTo } from "../../math";
import { Marker } from "../../ros";

const SHAFT_LENGTH = 0.77;
const SHAFT_DIAMETER = 1.0;
const HEAD_LENGTH = 0.23;
const HEAD_DIAMETER = 2.0;

const HEAD_LENGTH_PROPORTION = 0.23;

const UNIT_X = new THREE.Vector3(1, 0, 0);

const tempStart = new THREE.Vector3();
const tempEnd = new THREE.Vector3();
const tempDirection = new THREE.Vector3();

export class RenderableArrow extends RenderableMarker {
  public shaftMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  public headMesh: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>;
  private shaftOutline: THREE.LineSegments;
  private headOutline: THREE.LineSegments;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    const shaftGeometry = this.renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-shaft-${renderer.maxLod}`,
      () => createShaftGeometry(renderer.maxLod),
    );
    const headGeometry = this.renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-head-${renderer.maxLod}`,
      () => createHeadGeometry(renderer.maxLod),
    );
    const shaftEdgesGeometry = this.renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-shaftedges-${renderer.maxLod}`,
      () => createShaftEdgesGeometry(shaftGeometry),
    );
    const headEdgesGeometry = this.renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-headedges-${renderer.maxLod}`,
      () => createHeadEdgesGeometry(headGeometry),
    );
    // Shaft mesh
    this.shaftMesh = new THREE.Mesh(shaftGeometry, makeStandardMaterial(marker.color));
    this.shaftMesh.castShadow = true;
    this.shaftMesh.receiveShadow = true;
    this.add(this.shaftMesh);

    // Head mesh
    this.headMesh = new THREE.Mesh(headGeometry, makeStandardMaterial(marker.color));
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.add(this.headMesh);

    // Shaft outline
    this.shaftOutline = new THREE.LineSegments(shaftEdgesGeometry, renderer.outlineMaterial);
    this.shaftOutline.userData.picking = false;
    this.shaftMesh.add(this.shaftOutline);

    // Head outline
    this.headOutline = new THREE.LineSegments(headEdgesGeometry, renderer.outlineMaterial);
    this.headOutline.userData.picking = false;
    this.headMesh.add(this.headOutline);

    this.update(marker, receiveTime);
  }

  public override dispose(): void {
    this.shaftMesh.material.dispose();
    this.headMesh.material.dispose();
    super.dispose();
  }

  public override update(newMarker: Marker, receiveTime: bigint | undefined): void {
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

    const transparent = marker.color.a < 1;
    if (transparent !== this.shaftMesh.material.transparent) {
      this.shaftMesh.material.transparent = transparent;
      this.shaftMesh.material.depthWrite = !transparent;
      this.shaftMesh.material.needsUpdate = true;
      this.headMesh.material.transparent = transparent;
      this.headMesh.material.depthWrite = !transparent;
      this.headMesh.material.needsUpdate = true;
    }

    rgbToThreeColor(this.shaftMesh.material.color, marker.color);
    this.shaftMesh.material.opacity = marker.color.a;
    this.headMesh.material.color.set(this.shaftMesh.material.color);
    this.headMesh.material.opacity = marker.color.a;

    const settings = this.getSettings();

    this.shaftOutline.visible = settings?.showOutlines ?? true;
    this.headOutline.visible = settings?.showOutlines ?? true;

    // Adapted from <https://github.com/ros-visualization/rviz/blob/noetic-devel/src/rviz/default_plugin/markers/arrow_marker.cpp
    if (marker.points.length === 2) {
      const pointA = marker.points[0]!;
      const pointB = marker.points[1]!;
      tempStart.set(pointA.x, pointA.y, pointA.z);
      tempEnd.set(pointB.x, pointB.y, pointB.z);

      tempDirection.subVectors(tempEnd, tempStart);
      const distance = tempDirection.length();

      let headLength = HEAD_LENGTH_PROPORTION * distance;
      if (marker.scale.z !== 0) {
        const length = marker.scale.z;
        headLength = clamp(length, 0, distance);
      }
      const shaftLength = distance - headLength;
      const shaftDiameter = marker.scale.x;
      const headDiameter = marker.scale.y;

      this.shaftMesh.scale.set(shaftLength, shaftDiameter, shaftDiameter);
      this.headMesh.scale.set(headLength, headDiameter, headDiameter);
      this.scale.set(1, 1, 1);
      this.shaftMesh.position.set(pointA.x, pointA.y, pointA.z);
      this.shaftMesh.position.addScaledVector(tempDirection, 0.5 * (shaftLength / distance));
      this.headMesh.position.set(pointB.x, pointB.y, pointB.z);
      this.headMesh.position.addScaledVector(tempDirection, -0.5 * (headLength / distance));

      const rotation = getRotationTo(UNIT_X, tempDirection);
      this.shaftMesh.setRotationFromQuaternion(rotation);
      this.headMesh.rotation.copy(this.shaftMesh.rotation);
    } else {
      this.shaftMesh.scale.set(SHAFT_LENGTH, SHAFT_DIAMETER, SHAFT_DIAMETER);
      this.headMesh.scale.set(HEAD_LENGTH, HEAD_DIAMETER, HEAD_DIAMETER);
      this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);

      const halfShaftLength = SHAFT_LENGTH / 2;
      const halfHeadLength = HEAD_LENGTH / 2;
      this.shaftMesh.position.set(halfShaftLength, 0, 0);
      this.headMesh.position.set(halfShaftLength * 2 + halfHeadLength, 0, 0);
      this.shaftMesh.rotation.set(0, 0, 0);
      this.headMesh.rotation.set(0, 0, 0);
    }
  }
}

function createShaftGeometry(lod: DetailLevel): THREE.CylinderGeometry {
  const subdivs = arrowShaftSubdivisions(lod);
  const shaftGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subdivs, 1, false);
  shaftGeometry.rotateZ(-Math.PI / 2);
  shaftGeometry.computeBoundingSphere();
  return shaftGeometry;
}

function createHeadGeometry(lod: DetailLevel): THREE.ConeGeometry {
  const subdivs = arrowHeadSubdivisions(lod);
  const headGeometry = new THREE.ConeGeometry(0.5, 1, subdivs, 1, false);
  headGeometry.rotateZ(-Math.PI / 2);
  headGeometry.computeBoundingSphere();
  return headGeometry;
}

function createShaftEdgesGeometry(shaftGeometry: THREE.CylinderGeometry): THREE.EdgesGeometry {
  const shaftEdgesGeometry = new THREE.EdgesGeometry(shaftGeometry, 40);

  // We only want the outline of the base of the shaft, not the top of the
  // cylinder where it connects to the cone. Create a new position buffer
  // attribute with the first half of the vertices discarded
  const positionsAttrib = shaftEdgesGeometry.getAttribute("position") as THREE.BufferAttribute;
  const positions = Array.from(positionsAttrib.array);
  const newCount = (positions.length / 3 / 2) * 3;
  const newVertices = positions.slice(newCount, positions.length);
  const newPositionsAttrib = new THREE.Float32BufferAttribute(newVertices, 3);
  shaftEdgesGeometry.setAttribute("position", newPositionsAttrib);
  shaftEdgesGeometry.computeBoundingSphere();
  return shaftEdgesGeometry;
}

function createHeadEdgesGeometry(headGeometry: THREE.ConeGeometry): THREE.EdgesGeometry {
  const headEdgesGeometry = new THREE.EdgesGeometry(headGeometry, 40);
  headEdgesGeometry.computeBoundingSphere();
  return headEdgesGeometry;
}
