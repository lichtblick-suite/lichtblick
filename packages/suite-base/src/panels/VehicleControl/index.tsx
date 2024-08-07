// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { Button } from "@mui/material";
import { Slider } from "antd";
import { fabric } from "fabric";
import { useRef, useEffect, useState, Ref } from "react";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import useCallbackWithToast from "@lichtblick/suite-base/hooks/useCallbackWithToast";
import usePublisher from "@lichtblick/suite-base/hooks/usePublisher";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import map from "./map.json";
import image from "./map.png";
import { defaultConfig, useVehicleControlSettings } from "./settings";
import { VehicleControlConfig } from "./types";

type Props = {
  config: VehicleControlConfig;
  saveConfig: SaveConfig<VehicleControlConfig>;
};
interface RfidData {
  data: string;
}

interface pathData {
  target_rfids: number[];
  timestamp: number;
}

//指针
interface Pointer {
  x: number;
  y: number;
}
const id = "my_canvas";

//画布拖拽相关
let isDragging: boolean = false; //拖拽开关

//按下时的绝对坐标
let absolutePointer: Pointer = { x: NaN, y: NaN };

//触摸开始
let touch: boolean = false;

//触摸开始时的绝对坐标
let touchStartPointer: Pointer = { x: NaN, y: NaN };

function VehicleControlPanel(props: Props): JSX.Element {
  const { config, saveConfig } = props;
  const {
    run,
    car_id,
    pass_mode,
    nodeTopicName,
    nodeDatatype,
    runTopicName,
    runDatatype,
    pathSource,
    rfidSource,
  } = config;
  const { topics, datatypes } = useDataSourceInfo();
  useVehicleControlSettings(config, saveConfig, topics, datatypes);
  const parentDivRef = useRef<HTMLDivElement>();

  const rfidMessages = useMessageDataItem(rfidSource);
  const pathMessages = useMessageDataItem(pathSource);

  const rfidObj = rfidMessages[rfidMessages.length - 1];
  const pathObj = pathMessages[pathMessages.length - 1];

  const [runSwitch, setRunSwitch] = useState<boolean>(false);

  //终点发布信息
  const nodePublish = usePublisher({
    name: "Publish",
    topic: nodeTopicName,
    schemaName: nodeDatatype,
    datatypes,
  });

  // 发布终点
  const setEndNode = useCallbackWithToast(
    (rfidEnd: number) => {
      if (nodeTopicName) {
        nodePublish({ end_node: rfidEnd, pass_nodes: [] } as Record<string, unknown>);
      } else {
        throw new Error(`called _publish() when input was invalid`);
      }
    },
    [nodeTopicName, nodePublish],
  );

  // 画板
  const [canvas, setCanvas] = useState<fabric.Canvas | undefined>();
  const [init, setInit] = useState<boolean>(false);

  //检测到父元素宽高发生变化时跟随变化
  useEffect(() => {
    if (canvas && parentDivRef.current) {
      canvas.setWidth(parentDivRef.current.offsetWidth);
      canvas.setHeight(parentDivRef.current.offsetHeight);
      canvas.renderAll();
    }
  }, [parentDivRef.current?.offsetWidth, parentDivRef.current?.offsetHeight, canvas]);

  //画板初始化
  useEffect(() => {
    if (!canvas && parentDivRef.current) {
      const newCanvas = new fabric.Canvas(id, {
        width: parentDivRef.current.offsetWidth, //初始宽度
        height: parentDivRef.current.offsetHeight, //初始高度
        backgroundColor: "#fff", // 初始背景色
        fireMiddleClick: true, //启用中键 button为2
        selection: false,
      });
      setCanvas(newCanvas);
      setInit(true);
    }
    //为实现加载后执行一次，必须为空数组，这违反了eslint策略，故而注释
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 途径点列表
  const [passList, setPassList] = useState<{ id: number; left: number; top: number }[]>([]);

  // 途径点发布
  const setPassNodeList = useCallbackWithToast(() => {
    if (nodeTopicName && passList.length > 0) {
      nodePublish({ end_node: passList[passList.length - 1], pass_nodes: passList } as Record<
        string,
        unknown
      >);
    } else {
      throw new Error(`called _publish() when input was invalid`);
    }
  }, [nodeTopicName, passList, nodePublish]);

  //画板加载与静态事件写入 init为true时执行一次
  useEffect(() => {
    //加载
    if (init && canvas) {
      //画板反序列化
      canvas.loadFromJSON(map.canvas, () => {
        canvas.setBackgroundImage(image, canvas.renderAll.bind(canvas));
        //像素选择
        canvas.perPixelTargetFind = true;

        //鼠标样式设置为默认
        canvas.hoverCursor = "default";

        const objects = canvas.getObjects();
        //为不同对象添加特性
        for (let index = 0; index < objects.length; index++) {
          const element = objects[index]!;
          // 锁定位置 选择锁定
          element.lockMovementX = true;
          element.lockMovementY = true;
          element.hasControls = false;
          if (element.name === "path") {
            element.selectable = false;
          }
          if (element.name === "rfid") {
            element.hoverCursor = "pointer";
          }
        }
      });
      //滚轮缩放事件
      canvas.on("mouse:wheel", (opt: fabric.IEvent<WheelEvent>) => {
        //获取滚动数值
        const delta = opt.e.deltaY;
        //获取原本倍数
        let value = canvas.getZoom();
        //获取新的倍数
        value *= 0.999 ** delta;
        //设置最大最小缩放倍数
        if (value > 5) {
          value = 5;
        }
        if (value < 0.2) {
          value = 0.2;
        }
        setZoom(value);

        //使用鼠标位置为中心缩放
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, value);
        //阻止滚轮原本作用
        opt.e.preventDefault();
        //不出边框
        opt.e.stopPropagation();
      });
      //鼠标点击事件
      canvas.on("mouse:down", async (opt: fabric.IEvent<MouseEvent>) => {
        const evt = opt.e;
        //记录绝对指针
        absolutePointer = { x: evt.clientX, y: evt.clientY };
        const element = opt.target;
        switch (opt.button) {
          case 1:
            if (element) {
              const rfid = element.data.id as number;
              if (element.name === "rfid") {
                if (pass_mode) {
                  //绘制矩形
                  const circle = new fabric.Circle({
                    radius: 10,
                    strokeWidth: 2,
                    stroke: "#fff",
                    originX: "center",
                    originY: "center",
                    fill: "#ff9e00",
                    width: 40,
                    height: 30,
                  });
                  //绘制文本
                  const text = new fabric.IText(rfid.toString(), {
                    fontSize: 13,
                    fill: "#fff",
                    originX: "center",
                    originY: "center",
                  });
                  //组合
                  const group = new fabric.Group([circle, text], {
                    left: element.left,
                    top: element.top,
                    originX: "center",
                    originY: "center",
                    scaleX: 3,
                    scaleY: 3,
                    name: "car_rfid_pass",
                    data: { car_id, rfid },
                    selectable: false,
                  });
                  //添加
                  setPassList([...passList, { id: rfid, left: element.left!, top: element.top! }]);
                  canvas.add(group);
                  canvas.requestRenderAll();
                } else {
                  await setEndNode(rfid).then().catch();
                }
                canvas.discardActiveObject();
              }
            }
            break;
          case 2:
            //直接拖拽
            //开启拖拽
            isDragging = true;
            break;
          default:
            break;
        }
      });
      //鼠标移动事件
      canvas.on("mouse:move", (opt: fabric.IEvent<MouseEvent>) => {
        const evt = opt.e;
        //画布拖拽
        if (!touch && isDragging) {
          const vpt = canvas.viewportTransform;
          if (vpt) {
            vpt[4] += evt.clientX - absolutePointer.x; //水平位移（x轴）
            vpt[5] += evt.clientY - absolutePointer.y; //垂直位移（y轴）
          }
          //下一帧渲染
          canvas.requestRenderAll();
          //记录绝对指针
          absolutePointer = { x: evt.clientX, y: evt.clientY };
        }
      });
      // 鼠标按键抬起事件
      canvas.on("mouse:up", () => {
        if (isDragging) {
          canvas.setViewportTransform(canvas.viewportTransform!);
          isDragging = false;
        }
      });
      setInit(false);
    }
  }, [init, canvas, setEndNode, pass_mode, car_id, passList]);

  // 动态事件写入
  useEffect(() => {
    if (canvas) {
      // 鼠标点击事件
      canvas.off("mouse:down");
      canvas.on("mouse:down", async (opt: fabric.IEvent<MouseEvent>) => {
        const evt = opt.e;
        //记录绝对指针
        absolutePointer = { x: evt.clientX, y: evt.clientY };
        const element = opt.target;
        switch (opt.button) {
          case 1:
            if (element) {
              const rfid = element.data.id as number;
              if (element.name === "rfid") {
                if (pass_mode) {
                  //添加
                  setPassList([...passList, { id: rfid, left: element.left!, top: element.top! }]);
                } else {
                  await setEndNode(rfid).then().catch();
                }
                canvas.discardActiveObject();
              }
            }
            break;
          case 2:
            //直接拖拽
            //开启拖拽
            isDragging = true;
            break;
          default:
            break;
        }
      });
    }
    // 为了避免监听过度迭代，这违反了hook规则，故而注释
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car_id, pass_mode, setEndNode]);

  // 绘制途径点
  useEffect(() => {
    console.log(passList);
    //绘制矩形
    if (canvas) {
      passList.forEach((info) => {
        const circle = new fabric.Circle({
          radius: 10,
          strokeWidth: 2,
          stroke: "#fff",
          originX: "center",
          originY: "center",
          fill: "#ff9e00",
          width: 40,
          height: 30,
        });
        //绘制文本
        const text = new fabric.IText(info.id.toString(), {
          fontSize: 13,
          fill: "#fff",
          originX: "center",
          originY: "center",
        });
        //组合
        const group = new fabric.Group([circle, text], {
          left: info.left,
          top: info.top,
          originX: "center",
          originY: "center",
          scaleX: 3,
          scaleY: 3,
          name: "car_rfid_pass",
          data: { car_id, rfid: info.id },
          selectable: false,
        });

        canvas.add(group);
        canvas.requestRenderAll();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passList]);

  // 滑动条缩放
  const [zoom, setZoom] = useState<number>(1);
  const changeZoom = (value: number) => {
    let number = value;
    if (canvas && value !== zoom) {
      if (value <= 0) {
        number = 0.2;
      } else if (value > 5) {
        number = 5;
      } else {
        number = value;
      }
      setZoom(number);
      canvas.zoomToPoint({ x: canvas.width! / 2, y: canvas.height! / 2 }, number);
    }
  };

  //触摸拖拽事件
  const touchStart = (opt: React.TouchEvent<HTMLDivElement>) => {
    if (canvas) {
      //一个手指触摸
      if (opt.targetTouches.length === 1) {
        const evt = opt.targetTouches[0]!;
        //记录绝对指针
        touchStartPointer = { x: evt.clientX, y: evt.clientY };

        //触摸开始
        touch = true;
        //开启拖拽
        isDragging = true;
      }
    }
  };
  const touchMove = (opt: React.TouchEvent<HTMLDivElement>) => {
    if (canvas) {
      //一个手指触摸
      if (isDragging && opt.targetTouches.length === 1) {
        const evt = opt.targetTouches[0]!;
        const vpt = canvas.viewportTransform;
        const x = evt.clientX - touchStartPointer.x;
        const y = evt.clientY - touchStartPointer.y;
        if ((Math.abs(x) > 2 || Math.abs(y) > 2) && vpt) {
          vpt[4] += evt.clientX - touchStartPointer.x; //水平位移（x轴）
          vpt[5] += evt.clientY - touchStartPointer.y; //垂直位移（y轴）
          //下一帧渲染
          canvas.requestRenderAll();
        }
        //记录绝对指针
        touchStartPointer = { x: evt.clientX, y: evt.clientY };
      }
    }
  };
  const touchEnd = (opt: React.TouchEvent<HTMLDivElement>) => {
    if (canvas) {
      //一个手指触摸
      if (isDragging && opt.targetTouches.length === 1) {
        canvas.setViewportTransform(canvas.viewportTransform!);
        touch = false;
        isDragging = false;
      }
    }
  };

  // 小车路径绘制
  useEffect(() => {
    // 起点绘制
    const carRfidStart = (carid: number, rfid: number) => {
      if (canvas) {
        const objects = canvas.getObjects("group");
        //新建新的车辆起点图标
        const obj = objects.filter((element) => {
          return element.name === "rfid" && element.data.id === rfid;
        })[0];
        if (obj) {
          //绘制矩形
          const circle = new fabric.Circle({
            radius: 12,
            strokeWidth: 3,
            stroke: "#fff",
            originX: "center",
            originY: "center",
            fill: "#0077d9",
            width: 40,
            height: 30,
          });
          //绘制文本
          const text = new fabric.IText(carid.toString(), {
            fontSize: 20,
            fill: "#fff",
            originX: "center",
            originY: "center",
          });
          //组合
          const group = new fabric.Group([circle, text], {
            left: obj.left,
            top: obj.top,
            originX: "center",
            originY: "center",
            name: "car_rfid_start",
            data: { car_id: carid, rfid },
            scaleX: 3,
            scaleY: 3,
            selectable: false,
          });
          //添加
          canvas.add(group);
        }
      }
    };
    // 路径点绘制
    const carRfidPath = (carid: number, rfid: number) => {
      if (canvas) {
        const objects = canvas.getObjects("group");
        //新建新的车辆路径点图标
        const obj = objects.filter((element) => {
          return element.name === "rfid" && element.data.id === rfid;
        })[0];
        if (obj) {
          //绘制矩形
          const circle = new fabric.Circle({
            radius: 10,
            strokeWidth: 2,
            stroke: "#fff",
            originX: "center",
            originY: "center",
            fill: "#ff9e00",
            width: 40,
            height: 30,
          });
          //绘制文本
          const text = new fabric.IText(carid.toString(), {
            fontSize: 20,
            fill: "#fff",
            originX: "center",
            originY: "center",
          });
          //组合
          const group = new fabric.Group([circle, text], {
            left: obj.left,
            top: obj.top,
            originX: "center",
            originY: "center",
            name: "car_rfid_path",
            data: { car_id: carid, rfid },
            scaleX: 3,
            scaleY: 3,
            selectable: false,
          });
          //添加
          canvas.add(group);
        }
      }
    };
    // 终点绘制
    const carRfidEnd = (carid: number, rfid: number) => {
      if (canvas) {
        const objects = canvas.getObjects("group");
        //新建新的车辆终点图标
        const obj = objects.filter((element) => {
          return element.name === "rfid" && element.data.id === rfid;
        })[0];
        if (obj) {
          //绘制矩形
          const circle = new fabric.Circle({
            radius: 12,
            strokeWidth: 3,
            stroke: "#fff",
            originX: "center",
            originY: "center",
            fill: "#f80f32",
            width: 40,
            height: 30,
          });
          //绘制文本
          const text = new fabric.IText(carid.toString(), {
            fontSize: 20,
            fill: "#fff",
            originX: "center",
            originY: "center",
          });
          //组合
          const group = new fabric.Group([circle, text], {
            left: obj.left,
            top: obj.top,
            originX: "center",
            originY: "center",
            name: "car_rfid_end",
            data: { car_id: carid, rfid },
            selectable: false,
            scaleX: 3,
            scaleY: 3,
          });
          //添加
          canvas.add(group);
        }
      }
    };
    // 删除
    const carRfidDelete = (carid: number) => {
      if (canvas) {
        const objects = canvas.getObjects("group");
        //检查是否存在旧的地点数据
        const olds = objects.filter((element) => {
          return element.name !== "car_rfid_pass" && element.data.car_id === carid;
        });
        canvas.remove(...olds);
      }
    };
    // 路径绘制
    const pathDarw = (carid: number, rfidList: number[]) => {
      if (canvas) {
        let startRfid = rfidList[0];
        let endRfid;
        const objects = canvas.getObjects("group").filter((ele) => {
          return ele.name === "path";
        });

        for (let i = 1; i < rfidList.length; i++) {
          endRfid = rfidList[i];
          for (let j = 0; j < objects.length; j++) {
            const element = objects[j]! as fabric.Group;
            if (element.data.startRfid === startRfid && element.data.endRfid === endRfid) {
              const objectList: fabric.Object[] = [];
              for (let z = 0; z < element.getObjects().length; z++) {
                const obj = element.getObjects()[z];
                if (obj && obj.type === "circle") {
                  const circle = fabric.util.object.clone(obj) as fabric.Circle;
                  circle.set({ fill: "#ff9e00", radius: 4 });
                  objectList.push(circle);
                }
                if (obj && obj.type === "path") {
                  const path = fabric.util.object.clone(obj) as fabric.Path;
                  path.set({ stroke: "#ff9e00", strokeWidth: 8 });
                  objectList.push(path);
                }
              }
              const group = new fabric.Group(objectList, {
                top: element.top,
                left: element.left,
                name: "car_path",
                data: { car_id: carid },
                selectable: false,
                lockMovementX: true,
                lockMovementY: true,
                hasControls: false,
              });
              canvas.add(group);
              startRfid = endRfid;
            }
          }
        }
      }
    };
    const carRfidList = (carid: number, carRfid: number, rfidList?: number[]) => {
      if (canvas) {
        carRfidDelete(carid);
        if (rfidList && rfidList.length !== 0 && carRfid !== rfidList[rfidList.length - 1]) {
          let path = rfidList;
          if (rfidList[0] !== carRfid) {
            path = rfidList.slice(rfidList.indexOf(carRfid));
          }
          pathDarw(carid, path);
          path.forEach((rfid) => {
            carRfidPath(carid, rfid);
          });
          carRfidEnd(carid, rfidList[rfidList.length - 1]!);
        }
        carRfidStart(carid, carRfid);
        canvas.renderAll();
      }
    };
    if (rfidObj?.queriedData[0]) {
      const rfid = Number.parseInt((rfidObj.queriedData[0].value as RfidData).data);
      if (!isNaN(rfid)) {
        if (pathObj?.queriedData[0]) {
          const path = (pathObj.queriedData[0].value as pathData).target_rfids;
          carRfidList(car_id, rfid, path);
        } else {
          carRfidList(car_id, rfid);
        }
      }
    }
  }, [rfidObj, pathObj, canvas, car_id]);

  // 清理全部途径点
  const cleanPassNodeList = () => {
    if (canvas) {
      const objects = canvas.getObjects("group");
      const olds = objects.filter((element) => {
        return element.name === "car_rfid_pass";
      });
      canvas.remove(...olds);
      setPassList([]);
    }
  };

  //设置更改事件
  useEffect(() => {
    if (canvas) {
      if (!pass_mode) {
        const objects = canvas.getObjects("group");
        const olds = objects.filter((element) => {
          return element.name === "car_rfid_pass";
        });
        canvas.remove(...olds);
        setPassList([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pass_mode]);

  // 运行发布信息
  const runPublish = usePublisher({
    name: "RunPublish",
    topic: runTopicName,
    schemaName: runDatatype,
    datatypes,
  });
  // 发布运行
  const setRun = useCallbackWithToast(
    ({ state }: { state: boolean }) => {
      runPublish({ timestamp: Date.now(), is_run: state, message: "manual" } as Record<
        string,
        unknown
      >);
    },
    [runPublish],
  );
  // 运行按钮
  useEffect(() => {
    if (!runSwitch) {
      setRunSwitch(true);
    } else {
      void setRun({ state: run }).then().catch();
    }
    // 为了达成第一次不运行发布，故而不监听runSwitch，这违反了hook规则，故而注释
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, setRun]);
  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack
        ref={parentDivRef as Ref<HTMLDivElement>}
        flex="auto"
        alignItems="center"
        justifyContent="center"
        fullHeight
        gap={2}
        paddingX={3}
        onTouchStart={touchStart}
        onTouchMove={touchMove}
        onTouchEnd={touchEnd}
      >
        <div
          style={{
            position: "absolute",
            height: "50%",
            width: "40px",
            zIndex: "999",
            right: "0",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Slider vertical onChange={changeZoom} min={0.2} max={5} step={0.01} value={zoom} />
        </div>

        <div
          style={{
            position: "absolute",
            height: "auto",
            zIndex: "999",
            left: "30px",
            display: "flex",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          {pass_mode ? (
            <Button size="large" variant="contained" color="secondary" onClick={setPassNodeList}>
              submit
            </Button>
          ) : undefined}
          <br />
          {pass_mode ? (
            <Button size="large" variant="contained" color="secondary" onClick={cleanPassNodeList}>
              clean
            </Button>
          ) : undefined}
        </div>
        <canvas id={id} width={500} height={500}></canvas>
      </Stack>
    </Stack>
  );
}

export default Panel(
  Object.assign(React.memo(VehicleControlPanel), {
    panelType: "VehicleControl",
    defaultConfig,
  }),
);
