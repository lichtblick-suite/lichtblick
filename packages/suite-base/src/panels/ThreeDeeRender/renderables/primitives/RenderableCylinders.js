// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import * as THREE from "three";
import { toNanoSec } from "@lichtblick/rostime";
import { RenderablePrimitive } from "./RenderablePrimitive";
import { DARK_OUTLINE, LIGHT_OUTLINE, makeRgba, rgbToThreeColor, stringToRgba } from "../../color";
import { MeshStandardMaterialWithInstanceOpacity } from "../materials/MeshStandardMaterialWithInstanceOpacity";
const tempColor = new THREE.Color();
const tempVec3 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const tempMat4 = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const tempRgba = makeRgba();
export class RenderableCylinders extends RenderablePrimitive {
    // Each RenderableCylinders needs its own geometry because we attach additional custom attributes to it.
    #mesh;
    #geometry;
    // actual shared geometry across instances, only copy -- do not modify
    // stored for ease of use
    #sharedEdgesGeometry;
    #instanceOpacity;
    #instanceTopScale;
    #instanceBottomScale;
    #outlineMaterial = new CylinderOutlineMaterial();
    #material = new CylinderMaterial();
    #pickingMaterial = new CylinderPickingMaterial();
    /**
     * The initial count passed to `mesh`'s constructor, i.e. the maximum number of instances it can
     * render before we need to create a new mesh object
     */
    #maxInstances;
    #outlineGeometry;
    #outline;
    constructor(renderer) {
        super("", renderer);
        this.#geometry = renderer.sharedGeometry
            .getGeometry(`${this.constructor.name}-cylinder`, createGeometry)
            .clone();
        this.#maxInstances = 16;
        this.#mesh = new THREE.InstancedMesh(this.#geometry, this.#material, this.#maxInstances);
        this.#mesh.frustumCulled = false;
        this.#mesh.userData.pickingMaterial = this.#pickingMaterial;
        this.#instanceOpacity = new THREE.InstancedBufferAttribute(new Float32Array(this.#maxInstances), 1);
        this.#instanceBottomScale = new THREE.InstancedBufferAttribute(new Float32Array(this.#maxInstances), 1);
        this.#instanceTopScale = new THREE.InstancedBufferAttribute(new Float32Array(this.#maxInstances), 1);
        this.#geometry.setAttribute("instanceOpacity", this.#instanceOpacity);
        this.#geometry.setAttribute("instanceBottomScale", this.#instanceBottomScale);
        this.#geometry.setAttribute("instanceTopScale", this.#instanceTopScale);
        this.#mesh.count = 0;
        this.add(this.#mesh);
        this.#sharedEdgesGeometry = renderer.sharedGeometry.getGeometry(`${this.constructor.name}-edges`, () => createEdgesGeometry(this.#geometry));
        this.#outlineGeometry = new THREE.InstancedBufferGeometry();
        this.#outlineGeometry.copy(this.#sharedEdgesGeometry);
        this.#outlineGeometry.setAttribute("instanceMatrix", this.#mesh.instanceMatrix);
        this.#outlineGeometry.setAttribute("instanceBottomScale", this.#instanceBottomScale);
        this.#outlineGeometry.setAttribute("instanceTopScale", this.#instanceTopScale);
        this.#outline = new THREE.LineSegments(this.#outlineGeometry, this.#outlineMaterial);
        this.#outline.frustumCulled = false;
        this.#outline.userData.picking = false;
        this.add(this.#outline);
    }
    setColorScheme(colorScheme) {
        this.#outlineMaterial.color.copy(colorScheme === "dark" ? DARK_OUTLINE : LIGHT_OUTLINE);
        this.#outlineMaterial.needsUpdate = true;
    }
    #ensureCapacity(numCubes) {
        if (numCubes > this.#maxInstances) {
            const newCapacity = Math.trunc(numCubes * 1.5) + 16;
            this.#maxInstances = newCapacity;
            this.#instanceOpacity = new THREE.InstancedBufferAttribute(new Float32Array(this.#maxInstances), 1);
            this.#instanceBottomScale = new THREE.InstancedBufferAttribute(new Float32Array(this.#maxInstances), 1);
            this.#instanceTopScale = new THREE.InstancedBufferAttribute(new Float32Array(this.#maxInstances), 1);
            this.#geometry.setAttribute("instanceOpacity", this.#instanceOpacity);
            this.#geometry.setAttribute("instanceBottomScale", this.#instanceBottomScale);
            this.#geometry.setAttribute("instanceTopScale", this.#instanceTopScale);
            this.#mesh.removeFromParent();
            this.#mesh.dispose();
            this.#mesh = new THREE.InstancedMesh(this.#geometry, this.#material, this.#maxInstances);
            this.#mesh.frustumCulled = false;
            this.#mesh.userData.pickingMaterial = this.#pickingMaterial;
            this.add(this.#mesh);
            // THREE.js doesn't correctly recompute the new max instance count when dynamically
            // reassigning the attribute of InstancedBufferGeometry, so we just create a new geometry
            this.#outlineGeometry.dispose();
            this.#outlineGeometry = new THREE.InstancedBufferGeometry();
            this.#outlineGeometry.copy(this.#sharedEdgesGeometry);
            this.#outlineGeometry.instanceCount = newCapacity;
            this.#outlineGeometry.setAttribute("instanceMatrix", this.#mesh.instanceMatrix);
            this.#outlineGeometry.setAttribute("instanceBottomScale", this.#instanceBottomScale);
            this.#outlineGeometry.setAttribute("instanceTopScale", this.#instanceTopScale);
            this.#outline.geometry = this.#outlineGeometry;
        }
    }
    #updateMesh(cylinders) {
        let isTransparent = false;
        this.#ensureCapacity(cylinders.length);
        const overrideColor = this.userData.settings.color
            ? stringToRgba(tempRgba, this.userData.settings.color)
            : undefined;
        let i = 0;
        for (const cylinder of cylinders) {
            const color = overrideColor ?? cylinder.color;
            if (color.a < 1) {
                isTransparent = true;
            }
            this.#mesh.setColorAt(i, rgbToThreeColor(tempColor, color));
            this.#instanceOpacity.setX(i, color.a);
            this.#instanceBottomScale.setX(i, cylinder.bottom_scale);
            this.#instanceTopScale.setX(i, cylinder.top_scale);
            this.#mesh.setMatrixAt(i, tempMat4.compose(tempVec3.set(cylinder.pose.position.x, cylinder.pose.position.y, cylinder.pose.position.z), tempQuat.set(cylinder.pose.orientation.x, cylinder.pose.orientation.y, cylinder.pose.orientation.z, cylinder.pose.orientation.w), tempVec3_2.set(cylinder.size.x, cylinder.size.y, cylinder.size.z)));
            i++;
        }
        if (this.#material.transparent !== isTransparent) {
            this.#material.transparent = isTransparent;
            this.#material.depthWrite = !isTransparent;
            this.#material.needsUpdate = true;
        }
        if (this.#mesh.count === 0 && cylinders.length > 0) {
            // needed to make colors work: https://discourse.threejs.org/t/instancedmesh-color-doesnt-work-when-initial-count-is-0/41355
            this.#material.needsUpdate = true;
        }
        this.#mesh.count = cylinders.length;
        this.#outlineGeometry.instanceCount = cylinders.length;
        this.#mesh.instanceMatrix.needsUpdate = true;
        this.#instanceOpacity.needsUpdate = true;
        this.#instanceBottomScale.needsUpdate = true;
        this.#instanceTopScale.needsUpdate = true;
        // may be null if we were initialized with count 0 and still have 0 primitives
        if (this.#mesh.instanceColor) {
            this.#mesh.instanceColor.needsUpdate = true;
        }
    }
    dispose() {
        this.#mesh.dispose();
        this.#geometry.dispose();
        this.#material.dispose();
        this.#pickingMaterial.dispose();
        this.#outlineMaterial.dispose();
        this.#outlineGeometry.dispose();
    }
    update(topic, entity, settings, receiveTime) {
        super.update(topic, entity, settings, receiveTime);
        if (entity) {
            const lifetimeNs = toNanoSec(entity.lifetime);
            this.userData.expiresAt = lifetimeNs === 0n ? undefined : receiveTime + lifetimeNs;
            this.#updateMesh(entity.cylinders);
            this.#outline.visible = settings.showOutlines ?? true;
        }
    }
    updateSettings(settings) {
        this.update(this.userData.topic, this.userData.entity, settings, this.userData.receiveTime);
    }
}
function createGeometry() {
    const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    cylinderGeometry.rotateX(Math.PI / 2);
    cylinderGeometry.computeBoundingSphere();
    return cylinderGeometry;
}
function createEdgesGeometry(geometry) {
    const cylinderEdgesGeometry = new THREE.EdgesGeometry(geometry, 40);
    cylinderEdgesGeometry.computeBoundingSphere();
    return cylinderEdgesGeometry;
}
/** Modify the given vertex shader so it transforms positions to support bottom_scale and top_scale. */
function makeCylinderVertexShader(source) {
    return source
        .replace("#include <color_pars_vertex>", `
  #include <color_pars_vertex>
  attribute float instanceBottomScale, instanceTopScale;
  `)
        .replace("#include <begin_vertex>", `
  #include <begin_vertex>
  transformed.xy *= mix(instanceBottomScale, instanceTopScale, transformed.z + 0.5);
  `);
}
class CylinderMaterial extends MeshStandardMaterialWithInstanceOpacity {
    constructor() {
        super({ metalness: 0, roughness: 1, dithering: true });
    }
    onBeforeCompile(shader, renderer) {
        super.onBeforeCompile(shader, renderer);
        shader.vertexShader = makeCylinderVertexShader(shader.vertexShader);
    }
}
class CylinderOutlineMaterial extends THREE.LineBasicMaterial {
    constructor() {
        super();
        this.defines ??= {};
        this.defines.USE_INSTANCING = true;
    }
    onBeforeCompile(shader, renderer) {
        super.onBeforeCompile(shader, renderer);
        shader.vertexShader = makeCylinderVertexShader(shader.vertexShader);
    }
}
class CylinderPickingMaterial extends THREE.ShaderMaterial {
    constructor() {
        super({
            vertexShader: makeCylinderVertexShader(THREE.ShaderChunk.meshbasic_vert),
            fragmentShader: `
          uniform vec4 objectId;
          void main() {
            gl_FragColor = objectId;
          }
        `,
            uniforms: {
                objectId: { value: [NaN, NaN, NaN, NaN] },
            },
        });
    }
}
