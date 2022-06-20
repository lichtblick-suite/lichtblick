// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable no-underscore-dangle */

import * as THREE from "three";
import { clamp } from "three/src/math/MathUtils";

import type { Renderer } from "../../Renderer";
import { rgbaEqual } from "../../color";
import { arrowHeadSubdivisions, arrowShaftSubdivisions, DetailLevel } from "../../lod";
import { getRotationTo } from "../../math";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { releaseStandardMaterial, standardMaterial } from "./materials";

// const SHAFT_LENGTH = 1;
// const SHAFT_DIAMETER = 0.1;
// const HEAD_LENGTH = 0.3;
// const HEAD_DIAMETER = 0.2;
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
  private static _shaftLod: DetailLevel | undefined;
  private static _headLod: DetailLevel | undefined;
  private static _shaftGeometry: THREE.CylinderGeometry | undefined;
  private static _headGeometry: THREE.ConeGeometry | undefined;
  private static _shaftEdgesGeometry: THREE.EdgesGeometry | undefined;
  private static _headEdgesGeometry: THREE.EdgesGeometry | undefined;

  shaftMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.Material>;
  headMesh: THREE.Mesh<THREE.ConeGeometry, THREE.Material>;
  shaftOutline: THREE.LineSegments | undefined;
  headOutline: THREE.LineSegments | undefined;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    // Shaft mesh
    const material = standardMaterial(marker.color, renderer.materialCache);
    this.shaftMesh = new THREE.Mesh(RenderableArrow.shaftGeometry(renderer.maxLod), material);
    this.shaftMesh.castShadow = true;
    this.shaftMesh.receiveShadow = true;
    this.add(this.shaftMesh);

    // Head mesh
    this.headMesh = new THREE.Mesh(RenderableArrow.headGeometry(renderer.maxLod), material);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.add(this.headMesh);

    // Shaft outline
    this.shaftOutline = new THREE.LineSegments(
      RenderableArrow.shaftEdgesGeometry(renderer.maxLod),
      renderer.materialCache.outlineMaterial,
    );
    this.shaftOutline.userData.picking = false;
    this.shaftMesh.add(this.shaftOutline);

    // Head outline
    this.headOutline = new THREE.LineSegments(
      RenderableArrow.headEdgesGeometry(renderer.maxLod),
      renderer.materialCache.outlineMaterial,
    );
    this.headOutline.userData.picking = false;
    this.headMesh.add(this.headOutline);

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    releaseStandardMaterial(this.userData.marker.color, this.renderer.materialCache);
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    if (!rgbaEqual(marker.color, prevMarker.color)) {
      releaseStandardMaterial(prevMarker.color, this.renderer.materialCache);
      this.shaftMesh.material = standardMaterial(marker.color, this.renderer.materialCache);
      this.headMesh.material = this.shaftMesh.material;
    }

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

  static shaftGeometry(lod: DetailLevel): THREE.CylinderGeometry {
    if (!RenderableArrow._shaftGeometry || lod !== RenderableArrow._shaftLod) {
      const subdivs = arrowShaftSubdivisions(lod);
      RenderableArrow._shaftGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subdivs, 1, false);
      RenderableArrow._shaftGeometry.rotateZ(-Math.PI / 2);
      RenderableArrow._shaftGeometry.computeBoundingSphere();
      RenderableArrow._shaftLod = lod;
    }
    return RenderableArrow._shaftGeometry;
  }

  static headGeometry(lod: DetailLevel): THREE.ConeGeometry {
    if (!RenderableArrow._headGeometry || lod !== RenderableArrow._headLod) {
      const subdivs = arrowHeadSubdivisions(lod);
      RenderableArrow._headGeometry = new THREE.ConeGeometry(0.5, 1, subdivs, 1, false);
      RenderableArrow._headGeometry.rotateZ(-Math.PI / 2);
      RenderableArrow._headGeometry.computeBoundingSphere();
      RenderableArrow._headLod = lod;
    }
    return RenderableArrow._headGeometry;
  }

  static shaftEdgesGeometry(lod: DetailLevel): THREE.EdgesGeometry {
    if (!RenderableArrow._shaftEdgesGeometry) {
      const geometry = RenderableArrow.shaftGeometry(lod);
      RenderableArrow._shaftEdgesGeometry = new THREE.EdgesGeometry(geometry, 40);

      // We only want the outline of the base of the shaft, not the top of the
      // cylinder where it connects to the cone. Create a new position buffer
      // attribute with the first half of the vertices discarded
      const positionsAttrib = RenderableArrow._shaftEdgesGeometry.getAttribute("position");
      const positions = Array.from(positionsAttrib.array);
      const newCount = (positions.length / 3 / 2) * 3;
      const newVertices = positions.slice(newCount, positions.length);
      const newPositionsAttrib = new THREE.Float32BufferAttribute(newVertices, 3);
      RenderableArrow._shaftEdgesGeometry.setAttribute("position", newPositionsAttrib);

      RenderableArrow._shaftEdgesGeometry.computeBoundingSphere();
    }
    return RenderableArrow._shaftEdgesGeometry;
  }

  static headEdgesGeometry(lod: DetailLevel): THREE.EdgesGeometry {
    if (!RenderableArrow._headEdgesGeometry) {
      const geometry = RenderableArrow.headGeometry(lod);
      RenderableArrow._headEdgesGeometry = new THREE.EdgesGeometry(geometry, 40);
      RenderableArrow._headEdgesGeometry.computeBoundingSphere();
    }
    return RenderableArrow._headEdgesGeometry;
  }
}
