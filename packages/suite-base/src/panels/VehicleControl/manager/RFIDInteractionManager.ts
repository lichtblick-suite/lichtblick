// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-explicit-any */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as THREE from "three";

// RFID 交互管理类

export type RfidObject = {
  init?: {
    rfidScale?: number;
  };
  canvas: {
    width: number;
    height: number;
    objects: RfidObject[];
  };
  type: string;
  left: number;
  top: number;
  name: string;
  stroke?: string;
  data: {
    id: number;

    [key: string]: any;
  };
  objects: RfidObject[];
};

export class RFIDInteractionManager {
  #scene: THREE.Scene;
  #raycaster: THREE.Raycaster;
  #mouse: THREE.Vector2;
  #rfidPoints: Map<number, THREE.Mesh>; // 存储 RFID ID 和对应的 Mesh
  #pathGroups: Map<number, THREE.Group>; // 存储路径组
  #defaultColor: string;
  #deafultPathColor: string;
  #selectedRfidId: number | undefined;
  #currentPositionMarker: THREE.Group | undefined = undefined;
  #currentPositionRfidId: number | undefined = undefined;
  #lastPathIds: number[] = [];

  public constructor(
    scene: THREE.Scene,
    defaultColor: string = "#ffffff",
    deafultPathColor: string = "#000000",
  ) {
    this.#scene = scene;
    this.#raycaster = new THREE.Raycaster();
    this.#mouse = new THREE.Vector2();
    this.#rfidPoints = new Map();
    this.#defaultColor = defaultColor;
    this.#selectedRfidId = undefined;
    this.#pathGroups = new Map();
    this.#deafultPathColor = deafultPathColor;
  }

  // 注册 RFID 点
  public registerRfidPoint(rfidId: number, rfidMesh: THREE.Mesh): void {
    this.#rfidPoints.set(rfidId, rfidMesh);
  }
  // 注册路径组
  public registerPath(pathId: number, pathGroup: THREE.Group): void {
    this.#pathGroups.set(pathId, pathGroup);
  }

  // 高亮显示路径
  public highlightPath(pathId: number, color: string = "#FF0000"): void {
    const pathGroup = this.#pathGroups.get(pathId);
    if (!pathGroup) {
      return;
    }

    // 遍历路径组中的所有对象
    pathGroup.traverse((object) => {
      if (object instanceof THREE.Line || object instanceof THREE.Mesh) {
        if (
          object.material instanceof THREE.LineBasicMaterial ||
          object.material instanceof THREE.MeshBasicMaterial
        ) {
          object.material.color.set(color);
        }
      }
    });
  }

  public resetPathColor(): void {
    // console.log("resetPathColor");
    // console.log("this.#lastPathIds", this.#lastPathIds);
    this.#lastPathIds.forEach((pathId) => {
      this.highlightPath(pathId, this.#deafultPathColor);
    });
    this.#lastPathIds = [];
  }

  // 高亮一组 RFID 和它们之间的路径
  public highlightRoute(
    rfidSequence: number[],
    pathColor: string = "#FF0000",
    rfidColor: string = "#FFC5C5",
  ): void {
    // 重置之前的高亮状态
    this.resetAllColors();

    // 重置之前高亮的路径
    this.resetPathColor();

    // 高亮 RFID 点
    rfidSequence.forEach((rfidId) => {
      this.changeRfidColor(rfidId, rfidColor);
    });

    // 找到并高亮相连的路径
    this.#pathGroups.forEach((pathGroup, pathId) => {
      const { startRfid, endRfid } = pathGroup.userData;

      // 检查这条路径是否连接序列中相邻的两个 RFID
      for (let i = 0; i < rfidSequence.length - 1; i++) {
        if (
          (startRfid === rfidSequence[i] && endRfid === rfidSequence[i + 1]) ||
          (endRfid === rfidSequence[i] && startRfid === rfidSequence[i + 1])
        ) {
          this.#lastPathIds.push(pathId);
          this.highlightPath(pathId, pathColor);
          break;
        }
      }
    });
  }

  // 改变 RFID 颜色的方法
  public changeRfidColor(rfidId: number, color: string = "#FFFF00"): void {
    // 首先重置之前选中的 RFID 颜色

    // 设置新选中的 RFID 颜色
    const rfidMesh = this.#rfidPoints.get(rfidId);
    if (rfidMesh && rfidMesh.material instanceof THREE.MeshBasicMaterial) {
      rfidMesh.material.color.set(color);
      this.#selectedRfidId = rfidId;
    }
  }

  public resetRfidColor(rfidId: number): void {
    const previousRfid = this.#rfidPoints.get(rfidId);
    if (previousRfid && previousRfid.material instanceof THREE.MeshBasicMaterial) {
      previousRfid.material.color.set(this.#defaultColor);
    }
  }

  // 处理点击事件
  public handleClick(event: MouseEvent, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    const rect = renderer.domElement.getBoundingClientRect();
    this.#mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.#mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.#raycaster.setFromCamera(this.#mouse, camera);
    const intersects = this.#raycaster.intersectObjects(this.#scene.children, true);

    for (const intersect of intersects) {
      let parent = intersect.object.parent;
      while (parent) {
        if (parent.userData.type === "rfid") {
          // 调用颜色改变方法
          if (typeof parent.userData.id === "number") {
            this.changeRfidColor(parent.userData.id);
          }
          return;
        }
        parent = parent.parent;
      }
    }
  }
  // 设置当前位置
  public setCurrentPosition(rfidId: number): void {
    // console.log("setCurrentPosition", rfidId);
    // console.log("this.#select", this.#selectedRfidId);
    // 如果之前的标记存在，先移除
    if (this.#currentPositionMarker) {
      this.#scene.remove(this.#currentPositionMarker);
      this.#currentPositionMarker = undefined;
    }

    // 如果已经到终点 ，清除路径
    if (rfidId === this.#selectedRfidId) {
      // console.log("到达终点");
      this.resetAllColors();
      this.resetPathColor();
    }

    // 获取目标 RFID 的位置
    const rfidMesh = this.#rfidPoints.get(rfidId);
    if (!rfidMesh) {
      return;
    }

    // 创建新的位置标记
    const markerSize = 0.2; // 可以根据需要调整大小
    this.#currentPositionMarker = this.#createPositionMarker(markerSize);

    // 将标记放置在 RFID 位置
    const worldPosition = new THREE.Vector3();
    rfidMesh.getWorldPosition(worldPosition);

    this.#currentPositionMarker.position.x = worldPosition.x;

    this.#currentPositionMarker.position.y = worldPosition.y;

    // 添加到场景

    this.#scene.add(this.#currentPositionMarker);

    this.#currentPositionRfidId = rfidId;
  }

  // 移除当前位置标记
  public removeCurrentPosition(): void {
    if (this.#currentPositionMarker) {
      this.#scene.remove(this.#currentPositionMarker);
      this.#currentPositionMarker = undefined;
      this.#currentPositionRfidId = undefined;
    }
  }
  // 可以添加一个动画效果
  public animateCurrentPosition(): void {
    if (!this.#currentPositionMarker) {
      return;
    }

    const animate = () => {
      if (!this.#currentPositionMarker) {
        return;
      }

      // 添加呼吸效果
      const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
      this.#currentPositionMarker.scale.set(scale, scale, 1);

      requestAnimationFrame(animate);
    };

    animate();
  }

  // 创建当前位置标记
  #createPositionMarker(size: number): THREE.Group {
    const group = new THREE.Group();

    // 创建蓝色圆片
    const circleGeometry = new THREE.CircleGeometry(size, 32);
    const circleMaterial = new THREE.MeshBasicMaterial({
      color: "#0066FF",
      // transparent: true,
      opacity: 0.8,
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);

    // 创建文字精灵
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      canvas.width = 64;
      canvas.height = 64;

      // 设置文字样式
      context.fillStyle = "#FFFFFF";
      context.font = "bold 40px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";

      // 绘制文字
      context.fillText("A", canvas.width / 2, canvas.height / 2);

      // 创建纹理
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });

      const textSprite = new THREE.Sprite(spriteMaterial);
      textSprite.scale.set(size * 1.5, size * 1.5, 1);
      textSprite.position.z = 0.01; // 略微在圆片上方
      group.add(textSprite);
    }

    group.add(circle);

    // 将整个组放在稍高的 z 位置，确保在 RFID 点上方
    group.position.z = 0.1;

    return group;
  }

  // 重置所有 RFID 颜色
  public resetAllColors(): void {
    this.#rfidPoints.forEach((rfidMesh) => {
      if (rfidMesh.material instanceof THREE.MeshBasicMaterial) {
        rfidMesh.material.color.set(this.#defaultColor);
      }
    });
    this.#selectedRfidId = undefined;
  }

  // 获取当前位置的 RFID ID
  public getCurrentPositionRfidId(): number | undefined {
    return this.#currentPositionRfidId;
  }

  // 获取当前选中的 RFID ID
  public getSelectedRfidId(): number | undefined {
    return this.#selectedRfidId;
  }
}
export const convertCoordinates = (
  canvasX: number,
  canvasY: number,
  mapSize: { width: number; height: number },
  worldWidth: number,
): { x: number; y: number } => {
  // 1. 将画布坐标归一化到 0-1 范围
  const normalizedX = canvasX / mapSize.width;
  const normalizedY = canvasY / mapSize.height;

  // 2. 计算世界空间的高度
  const worldHeight = worldWidth * (mapSize.height / mapSize.width);

  // 3. 转换到Three.js坐标系
  // 将 0-1 范围映射到 -worldWidth/2 到 worldWidth/2
  const worldX = normalizedX * worldWidth - worldWidth / 2;
  // 将 0-1 范围映射到 worldHeight/2 到 -worldHeight/2（注意Y轴方向相反）
  const worldY = -(normalizedY * worldHeight) + worldHeight / 2;

  return { x: worldX, y: worldY };
};

// 在渲染 RFID 的函数中使用
export const parseAndRenderRfids = (
  jsonData: RfidObject | any,
  scene: THREE.Scene,
  mapSize: { width: number; height: number },
): RFIDInteractionManager | undefined => {
  if (!jsonData.canvas.objects) {
    return;
  }

  // 创建交互管理器
  const interactionManager = new RFIDInteractionManager(
    scene,
    "#ffffff",
    jsonData.canvas.objects[0]?.objects[0]?.stroke ?? "#000000",
  );

  const rfidObjects = jsonData.canvas.objects.filter((obj: RfidObject) => obj.name === "rfid");

  const rfidScale = jsonData.init?.rfidScale ?? 1;
  if (typeof rfidScale !== "number" || isNaN(rfidScale) || rfidScale <= 0) {
    throw new Error("Invalid rfidScale value");
  }
  const baseSize = 0.12;
  const rfidSize = baseSize * rfidScale;
  const WORLD_WIDTH = 10;

  rfidObjects.forEach((rfid: any) => {
    const coordinates = convertCoordinates(rfid.left, rfid.top, mapSize, WORLD_WIDTH);

    const { x, y } = coordinates;

    const geometry = new THREE.CircleGeometry(rfidSize, 32);
    const material = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.8,
    });
    const rfidPoint = new THREE.Mesh(geometry, material);
    rfidPoint.position.set(x, y, 0.01);

    const strokeGeometry = new THREE.CircleGeometry(rfidSize * 1.1, 32);
    const strokeMaterial = new THREE.MeshBasicMaterial({
      color: "#050215",
      transparent: false,
      opacity: 0.8,
    });
    const strokeCircle = new THREE.Mesh(strokeGeometry, strokeMaterial);
    strokeCircle.position.set(x, y, 0.005);
    //   // 创建文字纹理的函数
    const createTextSprite = (text: string, color: string = "#003C80FF", fontSize: number = 13) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        return undefined;
      }

      // 设置画布大小
      canvas.width = 256;
      canvas.height = 256;

      // 设置文字样式
      context.font = `${fontSize * 6}px Arial`; // 放大文字以提高清晰度
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = color;

      // 绘制文字
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      // 创建纹理
      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;

      // 创建精灵材质
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });

      // 创建精灵
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(0.5, 0.5, 1); // 调整大小

      return sprite;
    };

    //     // 创建文字精灵
    const textSprite = createTextSprite(rfid.data.id.toString(), "#0000000", 12);

    if (textSprite) {
      // 调整文字位置
      textSprite.position.x = x;
      textSprite.position.y = y;
      textSprite.position.y = textSprite.position.y + 0.001;
      textSprite.position.z = 0.011; // 确保文字在圆点上方
    }

    //     // 将所有元素添加到组中
    //     rfidGroup.add(rfidPoint);
    //     rfidGroup.add(strokeCircle);
    //     if (textSprite) {
    //       rfidGroup.add(textSprite);
    //     }

    //     rfidGroup.userData = {
    //       id: rfid.data.id,
    //       type: "rfid",
    //     };
    //     scene.add(rfidGroup);
    //   });

    const rfidGroup = new THREE.Group();
    rfidGroup.add(rfidPoint);
    rfidGroup.add(strokeCircle);
    if (textSprite) {
      rfidGroup.add(textSprite);
    }

    rfidGroup.userData = {
      id: rfid.data.id,
      type: "rfid",
    };

    scene.add(rfidGroup);

    // 注册 RFID 点到交互管理器
    interactionManager.registerRfidPoint(rfid.data.id, rfidPoint);
  });

  return interactionManager;
};

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  };

  return debounced as T & { cancel: () => void };
}

// 在组件中使用
//   const ThreeScene: React.FC = () => {
//     const interactionManagerRef = useRef<RFIDInteractionManager | null>(null);

//     // 你可以在其他地方通过 interactionManagerRef.current 来访问交互管理器
//     // 例如：
//     const handleSomeAction = () => {
//       // 获取当前选中的 RFID ID
//       const selectedId = interactionManagerRef.current?.getSelectedRfidId();
//       // 手动改变某个 RFID 的颜色
//       interactionManagerRef.current?.changeRfidColor(someId, '#00FF00');
//       // 重置所有颜色
//       interactionManagerRef.current?.resetAllColors();
//     };

//     return (
//       // 渲染代码...
//     );
//   };
