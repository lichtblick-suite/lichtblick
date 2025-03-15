/* eslint-disable react/forbid-component-props */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-unused-vars */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable react-hooks/exhaustive-deps */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-explicit-any */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-unnecessary-condition */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Button, Stack } from "@mui/material";
// import { Card } from "antd";
// import { use } from "cytoscape";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import useCallbackWithToast from "@lichtblick/suite-base/hooks/useCallbackWithToast";
import usePublisher from "@lichtblick/suite-base/hooks/usePublisher";
import BatteryIndicator from "@lichtblick/suite-base/panels/VehicleControl/components/BatteryIndicator";
import FileUploadModal from "@lichtblick/suite-base/panels/VehicleControl/components/FileUploadModal";
import MapFilesTab from "@lichtblick/suite-base/panels/VehicleControl/components/MapFilesTab";
import TextCard from "@lichtblick/suite-base/panels/VehicleControl/components/TextCard";
import demap from "@lichtblick/suite-base/panels/VehicleControl/map.png";
import {
  defaultConfig,
  useVehicleControlSettings,
} from "@lichtblick/suite-base/panels/VehicleControl/settings";
import { VehicleControlConfig } from "@lichtblick/suite-base/panels/VehicleControl/types";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import {
  parseAndRenderRfids,
  RFIDInteractionManager,
  convertCoordinates,
  debounce,
} from "./manager/RFIDInteractionManager";

type Props = {
  config: VehicleControlConfig;
  saveConfig: SaveConfig<VehicleControlConfig>;
};
type SandTableMap = {
  map: string;
  json: any;
};

const VehicleControlPanel: React.FC<Props> = ({ config, saveConfig }) => {
  const mountRef = useRef<HTMLDivElement | ReactNull>(ReactNull);
  const sceneRef = useRef<THREE.Scene | ReactNull>(ReactNull);
  const cameraRef = useRef<THREE.PerspectiveCamera | ReactNull>(ReactNull);
  const rendererRef = useRef<THREE.WebGLRenderer | ReactNull>(ReactNull);
  const controlsRef = useRef<OrbitControls | ReactNull>(ReactNull);
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  const batteryPercentageRef = useRef<number | undefined>(0);
  const animationFrameRef = useRef<number>();

  // 在组件顶部添加这些状态
  const [imageLoadStatus, setImageLoadStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const [isSceneReady, setIsSceneReady] = useState(false);

  const [map, setMap] = useState<SandTableMap | undefined>(undefined);
  const [mapName, setMapName] = useState<string>("");
  const [mapFiles, setMapFiles] = useState<string[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const WORLD_WIDTH = 10;
  const { nodeTopicName, nodeDatatype, pathSource, rfidSource, batterySource, update_map } = config;

  const rfidMessages = useMessageDataItem(rfidSource);
  const pathMessages = useMessageDataItem(pathSource);
  const batteryMessages = useMessageDataItem(batterySource);

  const rfidObj = rfidMessages[rfidMessages.length - 1] as {
    queriedData: { value: { data: string } }[];
  };
  const pathObj = pathMessages[pathMessages.length - 1] as {
    queriedData: { value: { target_rfids: number[] } }[];
  };
  const batteryObj = batteryMessages[batteryMessages.length - 1] as {
    queriedData: { value: { percentage: number } }[];
  };

  const interactionManagerRef = useRef<RFIDInteractionManager | undefined>(
    new RFIDInteractionManager(sceneRef.current!),
  );

  const { topics, datatypes } = useDataSourceInfo();
  useVehicleControlSettings(config, saveConfig, topics, datatypes);

  const nodePublish = usePublisher({
    name: "Publish",
    topic: nodeTopicName,
    schemaName: nodeDatatype,
    datatypes,
  });

  // 在现有的useEffect之外添加这个新的useEffect
  useEffect(() => {
    if (!map?.map) {
      console.error("No map image URL available");
      setImageLoadStatus("error");
      return;
    }

    setImageLoadStatus("loading");
    console.log("Testing image load from URL:", map.map);

    // 保存URL以便在UI中使用
    setImageUrl(map.map);

    const testImg = new Image();
    testImg.onload = () => {
      console.log("TEST IMAGE LOADED SUCCESSFULLY:", testImg.width, "x", testImg.height);
      setImageLoadStatus("success");
    };
    testImg.onerror = (err) => {
      console.error("TEST IMAGE LOAD FAILED:", err);
      setImageLoadStatus("error");
    };
    testImg.src = map.map;
  }, [map?.map]);
  useEffect(() => {
    setOpenModal(update_map);
  }, [update_map]);

  useEffect(() => {
    if (imageLoadStatus === "error") {
      //toast.error("Map image load failed. Please check the map image path and try again.");
      // loadMapAndJson();
    }
  }, [imageLoadStatus]);

  const setEndNode = useCallbackWithToast(
    (rfidEnd: number) => {
      if (nodeTopicName) {
        nodePublish({ end_node: rfidEnd, pass_nodes: [] } as Record<string, unknown>);
      } else {
        throw new Error("Invalid topic name");
      }
    },
    [nodeTopicName, nodePublish],
  );

  useEffect(() => {
    try {
      const rfid = rfidObj.queriedData[0]?.value?.data ?? "";
      if (Number.parseInt(rfid) !== 0 && rfid !== "") {
        interactionManagerRef.current?.setCurrentPosition(Number.parseInt(rfid));
      }
      interactionManagerRef.current?.animateCurrentPosition();

      const path = pathObj.queriedData[0]?.value ? pathObj.queriedData[0].value.target_rfids : [];

      interactionManagerRef.current?.highlightRoute(path);
    } catch (error) {
      //console.error("Failed to set end node:", error);
    }
  }, [rfidObj, pathObj]);

  useEffect(() => {
    try {
      const battery = batteryObj.queriedData[0]?.value.percentage;

      if (battery !== batteryPercentageRef.current) {
        batteryPercentageRef.current = battery;
      }
    } catch (error) {
      console.error("Failed to get battery percentage:", error);
    }
  }, [batteryObj]);

  const parseAndRenderPaths = (
    jsonData: { canvas?: { objects?: { name: string; type: string; [key: string]: any }[] } },
    scene: THREE.Scene,
    mapSize: { width: number; height: number },
  ) => {
    if (!jsonData.canvas?.objects) {
      return;
    }

    const pathGroups = jsonData.canvas.objects.filter((obj: any) => obj.name === "path");

    pathGroups.forEach((pathGroup) => {
      const pathObjects = (pathGroup.objects as any[]) || [];
      const group = new THREE.Group();

      // 处理所有路径线段
      pathObjects.forEach(
        (obj: {
          type: string;
          name: string;
          path?: [string, number, number][];
          stroke?: string;
          strokeWidth?: number;
          radius?: number;
          fill?: string;
          left?: number;
          top?: number;
        }) => {
          if (obj.type === "path" && obj.name === "pathLine") {
            // 确保 path 数组存在且至少有两个点
            if (!Array.isArray(obj.path) || obj.path.length < 2) {
              return;
            }

            const points: THREE.Vector3[] = [];

            // 处理路径中的所有点
            obj.path.forEach((pathCmd: [string, number, number]) => {
              // const _command = pathCmd[0];
              const x = pathCmd[1];
              const y = pathCmd[2];

              // 转换坐标
              const { x: worldX, y: worldY } = convertCoordinates(
                Number(x),
                Number(y),
                mapSize,
                WORLD_WIDTH,
              );

              points.push(new THREE.Vector3(worldX, worldY, 0.001));
            });

            // 创建线段几何体
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
              color: obj.stroke ?? "#262626",
              linewidth:
                obj.strokeWidth != undefined && !isNaN(obj.strokeWidth) ? obj.strokeWidth : 4,
              opacity: typeof pathGroup.opacity === "number" ? pathGroup.opacity : 1,
              transparent: true,
            });

            const line = new THREE.Line(geometry, material);
            group.add(line);
          }
        },
      );

      // 添加组的用户数据
      group.userData = {
        id: pathGroup.data.id,
        type: "path",
        startRfid: pathGroup.data.startRfid,
        endRfid: pathGroup.data.endRfid,
      };
      scene.add(group);

      const pathId = Number(pathGroup.data.id);
      if (!isNaN(pathId)) {
        interactionManagerRef.current?.registerPath(pathId, group);
      } else {
        //console.error("Invalid path ID:", pathGroup.data.id);
      }
    });
  };

  // 初始化 Three.js

  const initThreeJS = useCallback(() => {
    if (!map?.map || !map?.json || !mountRef.current) {
      console.error("map or json or mountRef.current is undefined");
      return;
    }
    const sence_map = map.map;

    const mount = mountRef.current;

    // 创建场景
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
      alpha: true,
    });
    // 设置设备像素比
    renderer.setPixelRatio(window.devicePixelRatio || 2);

    // // 启用阴影映射
    // renderer.shadowMap.enabled = true;
    // renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 设置编码，提高颜色表现
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // renderer.toneMappingExposure = 1;

    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 创建控制器
    // 在初始化 useEffect 中，修改 OrbitControls 配置的部分
    const controls = new OrbitControls(camera, renderer.domElement);
    // 禁用旋转
    controls.enableRotate = false;
    // 禁用自动旋转
    controls.autoRotate = false;
    // 启用平移
    controls.enablePan = true;
    // 设置左键用于平移
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      // RIGHT: THREE.MOUSE.DOLLY,
    };
    // 可选：设置缩放限制
    controls.minZoom = 1;
    controls.maxZoom = 5;
    // 设置平移为屏幕空间模式
    controls.screenSpacePanning = true;
    // 设置阻尼效果使移动更平滑
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    controls.minDistance = 3;
    controls.maxDistance = 8;

    // controls.minPan.set(-10, -10, 0);
    // controls.maxPan.set(10, 10, 0);

    controlsRef.current = controls;

    // 添加光源
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    // 加载地图
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(sence_map, (mapTexture) => {
      try {
        // 获取图片的原始宽高比
        const imageAspect = mapTexture.image.width / mapTexture.image.height;

        // 设置基准宽度为10（与原代码保持一致）
        const width = 10;
        // 根据宽高比计算高度
        const height = width / imageAspect;

        const mapGeometry = new THREE.PlaneGeometry(width, height);
        const mapMaterial = new THREE.MeshBasicMaterial({ map: mapTexture });
        // 添加下面这行代码，确保材质正确应用纹理
        mapMaterial.needsUpdate = true; // 修复：明确标记材质需要更新
        // 可选：确保纹理参数正确设置
        mapTexture.encoding = THREE.sRGBEncoding; // 修复：设置正确的编码
        mapTexture.needsUpdate = true; // 修复：明确标记纹理需要更新
        mapTexture.flipY = true; // 修复：确保纹理方向正确

        const mapMesh = new THREE.Mesh(mapGeometry, mapMaterial);
        scene.add(mapMesh);

        interactionManagerRef.current = parseAndRenderRfids(map.json, scene, {
          width: mapTexture.image.width,
          height: mapTexture.image.height,
        });

        parseAndRenderPaths(map.json, scene, {
          width: mapTexture.image.width,
          height: mapTexture.image.height,
        });

        // 可选：调整相机位置以适应新的地图尺寸
        const maxDimension = Math.max(width, height);
        camera.position.z = maxDimension * 0.7; // 调整这个系数以获得合适的视图
        camera.updateProjectionMatrix();

        // 增加强制渲染调用，确保变更立即生效
        renderer.render(scene, camera); // 修复：在加载完成后立即进行一次渲染

        // 在textureLoader.load回调中，最后添加：
        setTimeout(() => {
          // 强制更新材质和重新渲染
          mapMaterial.needsUpdate = true;
          mapTexture.needsUpdate = true;
          // 强制重新渲染几次
          for (let i = 0; i < 5; i++) {
            renderer.render(scene, camera);
          }
          // 标记场景准备完毕
          setIsSceneReady(true);
        }, 1000);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    });

    // 渲染循环
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();
  }, [map]);

  useEffect(() => {
    if (mountRef.current && map) {
      // 先清理旧的场景
      if (rendererRef.current && mountRef.current.contains(rendererRef.current.domElement)) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            }
          }
        });
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // 然后初始化新场景
      initThreeJS();
    }
  }, [mountRef.current, map, initThreeJS]);

  useEffect(() => {
    if (!isSceneReady || !rendererRef.current) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (!cameraRef.current || !rendererRef.current || !interactionManagerRef.current) {
        return;
      }

      try {
        interactionManagerRef.current.handleClick(event, cameraRef.current, rendererRef.current);

        const selectedRfidId = interactionManagerRef.current.getSelectedRfidId();
        if (selectedRfidId) {
          setEndNode(Number(selectedRfidId)).catch(console.error);
        }
      } catch (error) {
        console.error("Click handling error:", error);
      }
    };

    rendererRef.current.domElement.addEventListener("click", handleClick);

    return () => {
      rendererRef.current?.domElement.removeEventListener("click", handleClick);
    };
  }, [isSceneReady, setEndNode, map]);

  useEffect(() => {
    return () => {
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (object.material instanceof THREE.Material) {
              object.material.dispose();
            }
          }
        });
      }

      if (interactionManagerRef.current) {
        interactionManagerRef.current = undefined;
        // interactionManagerRef.current.dispose();
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map]);

  // 创建一个去抖动的 resize 处理函数
  const debouncedResize = useCallback(
    debounce((width: number, height: number) => {
      if (!rendererRef.current || !cameraRef.current) {
        return;
      }

      const renderer = rendererRef.current;
      const camera = cameraRef.current;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }, 1000), // 100ms 的延迟
    [],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }
    if (map == undefined) {
      return;
    }

    // 初始化渲染器和相机
    // const renderer = new THREE.WebGLRenderer({ antialias: true });
    // const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);

    const renderer = rendererRef.current;
    const camera = cameraRef.current;

    // 处理尺寸变化的函数
    const handleResize = (width: number, height: number) => {
      if (!renderer || !camera) {
        return;
      }

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    // 创建 ResizeObserver 实例
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        handleResize(width, height);
      }
    });

    // 监听容器元素的大小变化
    resizeObserver.observe(mount);
    resizeObserverRef.current = resizeObserver;

    // 窗口 resize 事件处理
    const handleWindowResize = () => {
      if (!mount) {
        return;
      }
      debouncedResize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", handleWindowResize);

    // 设置初始尺寸
    debouncedResize(mount.clientWidth, mount.clientHeight);

    // 清理函数
    return () => {
      window.removeEventListener("resize", handleWindowResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      renderer?.dispose();
      debouncedResize.cancel(); // 取消未执行的去抖动函数
    };
  }, [mountRef, cameraRef, rendererRef, debouncedResize, resizeObserverRef, map]);

  const loadMapAndJson = async (fileName: string) => {
    if (!fileName) {
      return;
    }

    try {
      let jsonData = {};
      let mapImageData = null;

      // 读取文件，无论它是什么类型
      const result = await window.electron.fileRenderer.readFile("documents", fileName);

      if (!result.success || !result.data) {
        console.error("Failed to read file:", fileName);
        setMap({ map: demap, json: {} });
        return;
      }

      // 检测文件内容类型
      const isJsonContent = isProbablyJson(result.data);
      const isPngContent = isProbablyPng(result.data);

      console.log(`File content analysis: isJson=${isJsonContent}, isPng=${isPngContent}`);

      if (isJsonContent) {
        // 处理JSON内容
        try {
          const jsonContent = new TextDecoder().decode(result.data);
          jsonData = JSON.parse(jsonContent);
          console.log("Successfully parsed JSON data");

          // 尝试查找匹配的PNG文件
          const pngFileName = derivePngFileName(fileName);
          if (pngFileName) {
            try {
              const pngResult = await window.electron.fileRenderer.readFile(
                "documents",
                pngFileName,
              );

              if (pngResult.success && pngResult.data && isProbablyPng(pngResult.data)) {
                // 转换为base64数据URL
                const base64Image = Buffer.from(pngResult.data).toString("base64");
                mapImageData = `data:image/png;base64,${base64Image}`;
                console.log("Successfully loaded associated PNG file");
              }
            } catch (pngError) {
              console.warn("Error loading associated PNG:", pngError);
            }
          }
        } catch (jsonError) {
          console.error("Error parsing JSON:", jsonError);
        }
      } else if (isPngContent) {
        // 处理PNG内容
        try {
          // 转换为base64数据URL
          const base64Image = Buffer.from(result.data).toString("base64");
          mapImageData = `data:image/png;base64,${base64Image}`;
          console.log("Successfully loaded PNG image");

          // 尝试查找匹配的JSON文件
          const jsonFileName = deriveJsonFileName(fileName);
          if (jsonFileName) {
            try {
              const jsonResult = await window.electron.fileRenderer.readFile(
                "documents",
                jsonFileName,
              );

              if (jsonResult.success && jsonResult.data && isProbablyJson(jsonResult.data)) {
                const jsonContent = new TextDecoder().decode(jsonResult.data);
                jsonData = JSON.parse(jsonContent);
                console.log("Successfully loaded associated JSON file");
              }
            } catch (jsonError) {
              console.warn("Error loading associated JSON:", jsonError);
            }
          }
        } catch (pngError) {
          console.error("Error processing PNG:", pngError);
        }
      } else {
        // 未知文件类型
        console.error("Unknown file content type, neither JSON nor PNG");
      }

      // 如果没有找到地图图像，使用默认图像
      if (!mapImageData) {
        mapImageData = demap;
        console.log("Using default map image");

        return;
      }

      // 更新状态
      setMap({ map: mapImageData, json: jsonData });
    } catch (error) {
      console.error("Error in loadMapAndJson:", error);
      setMap({ map: demap, json: {} });
    }
  };

  // 辅助函数来检测内容类型
  const isProbablyJson = (data: {
    slice: (arg0: number, arg1: number) => AllowSharedBufferSource | undefined;
  }) => {
    try {
      // 尝试将数据转换为字符串并检查是否像JSON
      const str = new TextDecoder().decode(data.slice(0, 100));
      return str.trim().startsWith("{") || str.trim().startsWith("[");
    } catch (e) {
      return false;
    }
  };

  const isProbablyPng = (data: string | any[]) => {
    try {
      // 检查PNG文件标志：第一个8字节应该是固定的PNG头
      if (!data || data.length < 8) {
        return false;
      }

      // PNG文件头标志：89 50 4E 47 0D 0A 1A 0A
      return (
        data[0] === 0x89 &&
        data[1] === 0x50 &&
        data[2] === 0x4e &&
        data[3] === 0x47 &&
        data[4] === 0x0d &&
        data[5] === 0x0a &&
        data[6] === 0x1a &&
        data[7] === 0x0a
      );
    } catch (e) {
      return false;
    }
  };

  // 辅助函数来派生相应的文件名
  const derivePngFileName = (filename: string) => {
    if (filename.toLowerCase().endsWith(".json")) {
      return filename.replace(/\.json$/i, ".png");
    } else if (!filename.includes(".")) {
      return `${filename}.png`;
    }
    return null;
  };

  const deriveJsonFileName = (filename: string) => {
    if (filename.toLowerCase().endsWith(".png")) {
      return filename.replace(/\.png$/i, ".json");
    } else if (!filename.includes(".")) {
      return `${filename}.json`;
    }
    return null;
  };
  useEffect(() => {
    loadMapAndJson(mapName).catch((error) => {
      console.error("Failed to load map and json:", error);
    });
  }, [mapName]);

  useEffect(() => {
    const loadMapFiles = async () => {
      try {
        const result = await window.electron.fileRenderer.listFiles("documents");
        if (result.success && result.data) {
          // 只过滤 .json 文件
          const jsonFiles = result.data.filter((file: string) => file.endsWith(".json"));
          setMapFiles(jsonFiles);
          setMapName(jsonFiles[0]);
        }
      } catch (error) {
        console.error("Failed to load map files:", error);
      }
    };
    loadMapFiles().catch((error) => {
      console.error("Failed to load map files:", error);
    });
  }, []);

  return (
    <Stack>
      <PanelToolbar />
      <div
        style={{
          position: "absolute",
          top: "35px",
          left: "10px",
          zIndex: 1000,
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "10px",
        }}
      >
        <div>Map URL: {imageUrl ? "Available" : "None"}</div>
        <div>Load Status: {imageLoadStatus}</div>
        {imageUrl && (
          <div>
            <div>Testing direct image render:</div>
            <img
              src={imageUrl}
              alt="Map test"
              style={{ width: "100px", height: "auto", border: "1px solid white" }}
              onLoad={() => {
                console.log("Image in DOM loaded");
              }}
              onError={(e) => {
                console.error("Image in DOM failed to load", e);
              }}
            />
          </div>
        )}
      </div>
      {update_map && (
        <Button
          variant="contained"
          component="label"
          color="secondary"
          onClick={() => {
            setOpenModal(true);
          }}
        >
          Upload map
        </Button>
      )}
      <FileUploadModal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
        }}
      />
      <MapFilesTab mapFiles={mapFiles} setMapName={setMapName} initialValue={mapFiles[0]} />
      <Stack
        ref={mountRef}
        flex="auto"
        alignItems="center"
        justifyContent="center"
        gap={2}
        paddingX={3}
        display={isSceneReady ? "block" : "none"}
        sx={{ height: "100vh" }}
      >
        {isSceneReady && (
          <>
            <div
              style={{
                position: "absolute",
                height: "50%",
                width: "40px",
                zIndex: 999,
                right: 0,
                display: "flex",
                justifyContent: "center",
              }}
            />
            <div
              style={{
                position: "absolute",
                height: "auto",
                zIndex: 999,
                right: "10px",
                display: "flex",
                justifyContent: "center",
                flexDirection: "column",
                top: "50px",
              }}
            >
              <BatteryIndicator batteryLevel={(batteryPercentageRef.current ?? 0) * 100} />
              <TextCard
                text={
                  interactionManagerRef.current?.getCurrentPositionRfidId()?.toString() ?? "无位置"
                }
              />
            </div>
          </>
        )}
      </Stack>
    </Stack>
  );
};

export default Panel(
  Object.assign(React.memo(VehicleControlPanel), {
    panelType: "VehicleControl",
    defaultConfig,
  }),
);
