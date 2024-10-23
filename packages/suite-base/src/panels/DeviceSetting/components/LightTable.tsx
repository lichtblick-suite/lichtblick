import request from "umi-request";
import { DeviceSetting, Light, LightState } from "../types";

import { MQTT } from "../mqtt";
import { Button } from "@mui/material"; // 使用 MUI 的 Button
import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import LightEditDialog from "@lichtblick/suite-base/panels/DeviceSetting/components/LightEditDialog";
import { message } from "antd";

type Props = {
  config: DeviceSetting;
  //   saveConfig: SaveConfig<DeviceSetting>;
};
export const LightTable = (props: Props) => {
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
  const saveLightSettings = async (data: Light) => {
    try {
      let sendData = {
        id: data.id,
        greenTime: data.greenTime,
        yellowTime: data.yellowTime,
        redTime: data.redTime,
        time: data.time,
        state: Number(data.state),
      };

      const response = await request("http://" + config.mqttHost + ":8081/setting/light/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: JSON.stringify(sendData),
      });
      console.log("Response:", response);
      if (response.code === 200) {
        message.success("Light updated successfully");
        fetchLightSettings();

        currentMqtt.current.publish(`device/light/update`, JSON.stringify(sendData) || "");
      } else {
        message.error("Failed to update light" + response.message);
      }
      return response;
    } catch (error) {
      //   message.error("Failed to update light" + error);
      message.error("Failed to update light" + error);
      console.error("Request failed:", error);
    }
  };

  const handleOk = (values: Omit<Light, "id">) => {
    if (editingLight) {
      const updatedLight = { ...editingLight, ...values };

      // currentMqtt.current.publish(`device/light/publish/${editingLight.id}`, data);
      saveLightSettings(updatedLight);

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
    }
  };

  const fetchLightSettings = async () => {
    try {
      const response = await request("http://" + config.mqttHost + ":8081/setting/light/get", {
        method: "GET",
      });
      console.log("Response:", response);
      setDeafultData(response.data);
      setData(response.data);
    } catch (error) {
      console.error("Request failed:", error);
    }
  };

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

      currentMqtt.current.subscribe("device/light/data/#", "source", (message: string) => {
        try {
          const parsedMessage: Light = JSON.parse(message);
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
      initMqtt();
    }
    return () => {
      currentMqtt.current.unsubscribe("device/light/data/#", "source");
      currentMqtt.current.pageDrop();
    };
  }, [config]);

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
        onClick={() => setShowEditTable(!showEditTable)}
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
                  <Button variant="contained" onClick={() => showModal(light)}>
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
