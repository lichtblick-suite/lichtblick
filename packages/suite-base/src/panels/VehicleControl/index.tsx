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
import React, { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import useCallbackWithToast from "@lichtblick/suite-base/hooks/useCallbackWithToast";
import usePublisher from "@lichtblick/suite-base/hooks/usePublisher";
import { SceneControls } from "@lichtblick/suite-base/panels/VehicleControl/manager/SceneControls";
import map from "@lichtblick/suite-base/panels/VehicleControl/map.png";
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
import json from "./map.json";

type Props = {
  config: VehicleControlConfig;
  saveConfig: SaveConfig<VehicleControlConfig>;
};

const VehicleControlPanel: React.FC<Props> = ({ config, saveConfig }) => {
  const mountRef = useRef<HTMLDivElement | ReactNull>(ReactNull);
  const sceneRef = useRef<THREE.Scene | ReactNull>(ReactNull);
  const cameraRef = useRef<THREE.PerspectiveCamera | ReactNull>(ReactNull);
  const rendererRef = useRef<THREE.WebGLRenderer | ReactNull>(ReactNull);
  const controlsRef = useRef<OrbitControls | ReactNull>(ReactNull);
  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  const sceneControlsRef = useRef<SceneControls | undefined>(undefined);
  const animationFrameRef = useRef<number>();
  const WORLD_WIDTH = 10;
  const {
    // lights,
    // run,
    // pass_mode,
    nodeTopicName,
    nodeDatatype,
    runTopicName,
    runDatatype,
    pathSource,
    rfidSource,
  } = config;

  const rfidMessages = useMessageDataItem(rfidSource);
  const pathMessages = useMessageDataItem(pathSource);

  const rfidObj = rfidMessages[rfidMessages.length - 1] as {
    queriedData: { value: { data: string } }[];
  };
  const pathObj = pathMessages[pathMessages.length - 1] as {
    queriedData: { value: { target_rfids: number[] } }[];
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

  const runPublish = usePublisher({
    name: "RunPublish",
    topic: runTopicName,
    schemaName: runDatatype,
    datatypes,
  });

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
      console.error("Failed to set end node:", error);
    }
  }, [rfidObj, pathObj]);

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
        console.error("Invalid path ID:", pathGroup.data.id);
      }
    });
  };
  const highlightRoute = () => {
    if (!interactionManagerRef.current) {
      return;
    }

    // 示例：高亮显示经过 RFID 38, 39, 40 的路线
    const rfidSequence = [1, 10, 8];
    interactionManagerRef.current.highlightRoute(rfidSequence);
  };

  const setRun = useCallbackWithToast(
    ({ state }: { state: boolean }) => {
      runPublish({ timestamp: Date.now(), is_run: state, message: "manual" });
    },
    [runPublish],
  );

  // 初始化 Three.js
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

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
    textureLoader.load(map, (mapTexture) => {
      // 获取图片的原始宽高比
      const imageAspect = mapTexture.image.width / mapTexture.image.height;

      // 设置基准宽度为10（与原代码保持一致）
      const width = 10;
      // 根据宽高比计算高度
      const height = width / imageAspect;

      const mapGeometry = new THREE.PlaneGeometry(width, height);
      const mapMaterial = new THREE.MeshBasicMaterial({ map: mapTexture });
      const mapMesh = new THREE.Mesh(mapGeometry, mapMaterial);
      scene.add(mapMesh);
      // parseAndRenderRfids(json, scene, {
      //   width: mapTexture.image.width,
      //   height: mapTexture.image.height,
      // });

      interactionManagerRef.current = parseAndRenderRfids(json, scene, {
        width: mapTexture.image.width,
        height: mapTexture.image.height,
      });

      parseAndRenderPaths(json, scene, {
        width: mapTexture.image.width,
        height: mapTexture.image.height,
      });

      // 可选：调整相机位置以适应新的地图尺寸
      const maxDimension = Math.max(width, height);
      camera.position.z = maxDimension * 0.7; // 调整这个系数以获得合适的视图
      camera.updateProjectionMatrix();

      const sceneControls = new SceneControls(
        camera,
        controls,
        mapTexture.image.width,
        mapTexture.image.height,
      );

      sceneControlsRef.current = sceneControls;

      // 重置到初始视图
      // sceneControls.resetView();

      // const cleanup = parseAndRenderRfids(
      //   json,
      //   scene,
      //   {
      //     width: mapTexture.image.width,
      //     height: mapTexture.image.height,
      //   },
      //   camera,
      //   renderer,
      // );
    });

    // 渲染循环
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 处理窗口大小变化
    // const handleResize = () => {
    //   if (!mountRef.current || !renderer || !camera) {
    //     return;
    //   }

    //   const width = mountRef.current.clientWidth;
    //   const height = mountRef.current.clientHeight;

    //   camera.aspect = width / height;
    //   camera.updateProjectionMatrix();
    //   renderer.setSize(width, height);
    // };

    // window.addEventListener("resize", handleResize);

    return () => {
      // window.removeEventListener("resize", handleResize);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (mount && rendererRef.current) {
        mount.removeChild(rendererRef.current.domElement);
      }

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();
      controls.dispose();
    };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (cameraRef.current && rendererRef.current) {
        interactionManagerRef.current?.handleClick(event, cameraRef.current, rendererRef.current);
      }

      const selectedRfidId = interactionManagerRef.current?.getSelectedRfidId();
      if (selectedRfidId != undefined) {
        setEndNode(Number(selectedRfidId)).catch((error) => {
          console.error("Failed to set end node:", error);
        });
      }
    };

    if (rendererRef.current) {
      rendererRef.current.domElement.addEventListener("click", handleClick);
    }
  }, [setEndNode, interactionManagerRef, cameraRef, rendererRef]);

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
  }, [mountRef, cameraRef, rendererRef, debouncedResize, resizeObserverRef]);

  useEffect(() => {
    if (config.run) {
      setRun({ state: true }).catch((error) => {
        console.error("Failed to set run state:", error);
      });
    }
  }, [config.run, setRun]);

  const setCurrentPosition = (rfidId: number) => {
    interactionManagerRef.current?.setCurrentPosition(rfidId);
    // 可选：启动动画
    interactionManagerRef.current?.animateCurrentPosition();
  };

  // 移动到下一个位置（示例）

  return (
    <Stack>
      <PanelToolbar />
      {config.lights && (
        <>
          <Button variant="contained" component="label">
            Upload JSON
            <input type="file" accept=".json" style={{ display: "none" }} />
          </Button>
          <Button variant="contained" component="label" color="secondary">
            Upload Image
            <input type="file" accept="image/*" style={{ display: "none" }} />
          </Button>
        </>
      )}
      <Stack
        ref={mountRef}
        flex="auto"
        alignItems="center"
        justifyContent="center"
        gap={2}
        paddingX={3}
        // eslint-disable-next-line react/forbid-component-props
        sx={{ height: "100vh" }}
      >
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
        >
          {/* <Slider
            orientation="vertical"
            onChange={(_, value) => {
              if (typeof value === "number") {
                setZoom(value);
              }
            }}
            min={0.2}
            max={5}
            step={0.01}
            value={zoom}
          /> */}
        </div>
        <div
          style={{
            position: "absolute",
            height: "auto",
            zIndex: 999,
            left: "30px",
            display: "flex",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <button onClick={highlightRoute}>显示路线</button>
          <button
            onClick={() => {
              setCurrentPosition(1);
            }}
          >
            设置当前位置1
          </button>

          <button
            onClick={() => {
              setCurrentPosition(10);
            }}
          >
            设置当前位置10
          </button>

          <button
            onClick={() => {
              setCurrentPosition(8);
            }}
          >
            设置当前位置8
          </button>
          {config.pass_mode && (
            <>
              <Button size="large" variant="contained" color="secondary">
                Submit
              </Button>
              <br />
              <Button size="large" variant="contained" color="secondary">
                Clean
              </Button>
            </>
          )}
        </div>
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
