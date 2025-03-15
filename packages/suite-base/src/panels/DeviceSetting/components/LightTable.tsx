// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Button } from "@mui/material"; // 使用 MUI 的 Button
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { message } from "antd";
import { useState, useEffect, useRef, useCallback } from "react";
import request from "umi-request";

import LightEditDialog from "@lichtblick/suite-base/panels/DeviceSetting/components/LightEditDialog";

import { MQTT } from "../mqtt";
import { DeviceSetting, Light, LightState } from "../types";

type Props = {
  config: DeviceSetting;
  //   saveConfig: SaveConfig<DeviceSetting>;
};
export const LightTable: React.FC<Props> = (props: Props): React.JSX.Element => {
  const { config } = props;
  const [data, setData] = useState<Light[]>([]);
  const [deafultData, setDeafultData] = useState<Light[]>([]);
  const currentMqtt = useRef<MQTT>(MQTT.getInstance());
  const [editingLight, setEditingLight] = useState<Light>({
    id: 0,
    state: LightState.RED,
    time: 0,
    greenTime: 0,
    yellowTime: 0,
    redTime: 0,
  });
  const [isModalVisible, setIsModalVisible] = useState(false);

  const [showEditTable, setShowEditTable] = useState(false);

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingLight({
      id: 0,
      state: LightState.RED,
      time: 0,
      greenTime: 0,
      yellowTime: 0,
      redTime: 0,
    });
  };
  const saveLightSettings = async (lightData: Light) => {
    try {
      const sendData = {
        id: lightData.id,
        greenTime: lightData.greenTime,
        yellowTime: lightData.yellowTime,
        redTime: lightData.redTime,
        time: lightData.time,
        state: Number(lightData.state),
      };
      const response = await request("http://" + config.mqttHost + ":9002/setting/light/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(sendData),
      });

      if (response.code === 200) {
        message.success("Light updated successfully");
        fetchLightSettings().catch((error: unknown) => {
          console.error("Failed to update light:", error);
        });
        currentMqtt.current.publish(`device/light/update`, JSON.stringify(sendData) ?? "");
      } else {
        const errorMessage =
          typeof response.message === "string" ? response.message : "Unknown error";
        message.error(`Failed to update light: ${errorMessage}`);
      }
    } catch (error) {
      message.error("Failed to update light", error);
      console.error("Request failed:", error);
    }
  };

  const handleOk = (values: Omit<Light, "id">) => {
    const updatedLight = { ...editingLight, ...values };

    // currentMqtt.current.publish(`device/light/publish/${editingLight.id}`, data);
    saveLightSettings(updatedLight).catch((error: unknown) => {
      console.error("Failed to update light:", error);
    });

    //   message.success("Light updated successfully");
    setIsModalVisible(false);
    setEditingLight({
      id: 0,
      state: LightState.RED,
      time: 0,
      greenTime: 0,
      yellowTime: 0,
      redTime: 0,
    });
  };

  const fetchLightSettings = useCallback(async () => {
    try {
      const response = await request("http://" + config.mqttHost + ":9002/setting/light/get", {
        method: "GET",
      });
      setDeafultData(response.data as Light[]);
      setData(response.data as Light[]);
    } catch (error) {
      console.error("Request failed:", error);
    }
  }, [config.mqttHost, setDeafultData, setData]);

  const showModal = (record: Light) => {
    setEditingLight(record);
    setIsModalVisible(true);
  };
  useEffect(() => {
    const initMqtt = async () => {
      await fetchLightSettings();
      await currentMqtt.current.init({
        clientId: "web_client_c1",
        host: config.mqttHost,
        post: config.port,
      });

      currentMqtt.current.subscribe("device/light/data/#", "source", (mqttMessage: string) => {
        try {
          const parsedMessage: Light = JSON.parse(mqttMessage);
          //   console.log(parsedMessage);

          setData((prevValue = []) => {
            return prevValue.map((item) =>
              item.id === parsedMessage.id
                ? {
                    ...item,
                    time: parsedMessage.time,
                    state: parsedMessage.state,
                    redTime: item.redTime,
                    greenTime: item.greenTime,
                    yellowTime: item.yellowTime,
                  }
                : item,
            );
          });
        } catch (error) {
          console.error("Failed to parse message:", error);
        }
      });
    };
    if (config.save) {
      currentMqtt.current.destroy();
      initMqtt().catch((error: unknown) => {
        console.error("Failed to initialize MQTT:", error);
        currentMqtt.current.destroy();
      });
    }
    // 缓存 currentMqtt.current 到局部变量
    const mqttInstance = currentMqtt.current;

    return () => {
      mqttInstance.unsubscribe("device/light/data/#", "source");

      mqttInstance.pageDrop(); // 使用缓存的变量
    };
  }, [config, fetchLightSettings]);

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>编号</TableCell>
            <TableCell>时间</TableCell>
            <TableCell>状态</TableCell>
            {/* <TableCell>红灯时间</TableCell>
            <TableCell>绿灯时间</TableCell>
            <TableCell>黄灯时间</TableCell>
            <TableCell>操作</TableCell> */}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((light) => (
            <TableRow key={light.id}>
              <TableCell>{light.id}</TableCell>
              <TableCell>{light.time}</TableCell>
              <TableCell>
                {light.state === 1 && "RED"}
                {light.state === 2 && "GREEN"}
                {light.state === 3 && "YELLOW"}
                {isNaN(Number(light.state)) && light.state}
              </TableCell>
              {/* <TableCell>{light.redTime}</TableCell>
              <TableCell>{light.greenTime}</TableCell>
              <TableCell>{light.yellowTime}</TableCell>
              <TableCell>
                <Button variant="contained" onClick={() => showModal(light)}>
                  编辑
                </Button>
              </TableCell> */}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button
        onClick={() => {
          setShowEditTable(!showEditTable);
        }}
        // eslint-disable-next-line react/forbid-component-props
        sx={{ marginTop: "20px", width: "100%" }}
      >
        展示/隐藏 编辑红绿灯
      </Button>
      {showEditTable && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>编号</TableCell>
              <TableCell>时间</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>红灯时间</TableCell>
              <TableCell>绿灯时间</TableCell>
              <TableCell>黄灯时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deafultData.map((light) => (
              <TableRow key={light.id}>
                <TableCell>{light.id}</TableCell>
                <TableCell>{light.time}</TableCell>
                <TableCell>
                  {light.state === 1 && "RED"}
                  {light.state === 2 && "GREEN"}
                  {light.state === 3 && "YELLOW"}
                  {isNaN(Number(light.state)) && light.state}
                </TableCell>
                <TableCell>{light.redTime}</TableCell>
                <TableCell>{light.greenTime}</TableCell>
                <TableCell>{light.yellowTime}</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    onClick={() => {
                      showModal(light);
                    }}
                  >
                    编辑
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <LightEditDialog
        isModalVisible={isModalVisible}
        editingLight={editingLight}
        handleCancel={handleCancel}
        handleOk={handleOk}
      />
    </TableContainer>
  );
};
