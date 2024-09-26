import { MQTT } from "../mqtt";
import { useEffect, useRef, useState } from "react";

import { TextField, Button, Box, Typography } from "@mui/material";
import { DeviceSetting } from "@lichtblick/suite-base/panels/DeviceSetting/types";
type Props = {
  config: DeviceSetting;
  //   saveConfig: SaveConfig<DeviceSetting>;
};
const LightFlashMode = (props: Props) => {
  const { config } = props;
  const currentMqtt = useRef<MQTT>(MQTT.getInstance());
  useEffect(() => {
    const initMqtt = async () => {
      try {
        await currentMqtt.current.init({
          clientId: "web_client_c1",
          host: config.mqttHost,
          post: config.port,
        });
      } catch (error) {
        console.error("MQTT初始化失败:", error);
      }
    };

    initMqtt();
  }, []);
  // 定义表单状态
  const [formData, setFormData] = useState({
    originalId: "",
    currentIp: "",
    setId: "",
  });

  // 处理输入变化
  const handleChange = (e: { target: { name: any; value: any } }) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // 提交表单
  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault(); // 防止页面刷新
    console.log("提交的表单数据:", formData);
    const sendData = {
      state: 5,
      id: Number(formData.setId),
    };
    currentMqtt.current.publish(
      "device/set/cfg/" + formData.currentIp,
      JSON.stringify(sendData) || "",
    );
    // 你可以在这里添加更多的提交逻辑，例如发送到服务器
  };

  return (
    <>
      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{
          display: "flex",
          flexDirection: "column",
          maxWidth: 400,
          margin: "0 auto",
          gap: 2,
          padding: 4,
          border: "1px solid #ccc",
          borderRadius: 2,
          boxShadow: 1,
        }}
        noValidate
        autoComplete="off"
      >
        <Typography variant="h5" component="div" textAlign="center">
          红绿灯配置
        </Typography>
        <TextField
          label="当前IP"
          variant="outlined"
          name="currentIp"
          value={formData.currentIp}
          onChange={handleChange}
          required
        />
        <Button color="primary" type="submit">
          OTA模式
        </Button>

        <TextField
          label="原ID"
          variant="outlined"
          name="originalId"
          value={formData.originalId}
          onChange={handleChange}
          required
        />

        <TextField
          label="当前IP"
          variant="outlined"
          name="currentIp"
          value={formData.currentIp}
          onChange={handleChange}
          required
        />

        <TextField
          label="设置ID"
          variant="outlined"
          name="setId"
          value={formData.setId}
          onChange={handleChange}
          required
        />

        <Button variant="contained" color="primary" type="submit">
          提交
        </Button>
      </Box>
    </>
  );
};
export default LightFlashMode;
