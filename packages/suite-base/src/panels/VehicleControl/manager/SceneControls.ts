// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * @license
 * Copyright (c) 2023 Your Company. All rights reserved.
 * This code is licensed under the MIT License.
 */
export class SceneControls {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private boundingBox: THREE.Box3;
  private imageSize: { width: number; height: number };
  private padding: number = 50; // 边界padding，可调整

  public constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    imageWidth: number,
    imageHeight: number,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.imageSize = { width: imageWidth, height: imageHeight };

    // 创建边界盒
    this.boundingBox = new THREE.Box3(
      new THREE.Vector3(-imageWidth / 2, -imageHeight / 2, 0),
      new THREE.Vector3(imageWidth / 2, imageHeight / 2, 0),
    );

    // 设置控制器限制
    this.setupControlLimits();
  }

  private setupControlLimits() {
    // 禁用旋转
    this.controls.enableRotate = false;

    // 设置缩放限制
    this.controls.enableZoom = true;
    this.controls.minZoom = 0.5; // 最小缩放
    this.controls.maxZoom = 3; // 最大缩放

    // 添加事件监听
    this.controls.addEventListener("change", () => {
      this.enforceBounds();
    });
  }

  // 强制执行边界限制
  private enforceBounds() {
    const cameraPosition = this.camera.position.clone();
    let changed = false;

    // 计算当前视野范围
    const fov = (this.camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(fov / 2) * Math.abs(cameraPosition.z);
    const visibleWidth = visibleHeight * this.camera.aspect;

    // 计算允许的边界
    const maxX = this.imageSize.width / 2 + this.padding;
    const maxY = this.imageSize.height / 2 + this.padding;
    const minX = -maxX;
    const minY = -maxY;

    // 限制X轴移动
    if (cameraPosition.x > maxX) {
      cameraPosition.x = maxX;
      changed = true;
    }
    if (cameraPosition.x < minX) {
      cameraPosition.x = minX;
      changed = true;
    }

    // 限制Y轴移动
    if (cameraPosition.y > maxY) {
      cameraPosition.y = maxY;
      changed = true;
    }
    if (cameraPosition.y < minY) {
      cameraPosition.y = minY;
      changed = true;
    }

    // 如果位置被调整，更新相机位置
    if (changed) {
      this.camera.position.copy(cameraPosition);
    }
  }

  // 重置视图
  public resetView() {
    this.camera.position.set(0, 0, this.calculateInitialZoom());
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  // 计算初始缩放级别
  private calculateInitialZoom(): number {
    const fov = (this.camera.fov * Math.PI) / 180;
    const imageAspect = this.imageSize.width / this.imageSize.height;
    const screenAspect = window.innerWidth / window.innerHeight;

    let distance;
    if (imageAspect > screenAspect) {
      distance = this.imageSize.width / 2 / (Math.tan(fov / 2) * this.camera.aspect);
    } else {
      distance = this.imageSize.height / 2 / Math.tan(fov / 2);
    }

    return distance;
  }
}
