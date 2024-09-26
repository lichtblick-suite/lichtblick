import React, { useEffect, useState } from "react";
import { Button, List, ListItem } from "@mui/material";
import TextMiddleTruncate from "@lichtblick/suite-base/components/TextMiddleTruncate";
import { IpcRendererEvent } from "electron"; // 导入正确的类型定义
import {
  DataSourceArgs,
  usePlayerSelection,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useTranslation } from "react-i18next";

// 声明 Electron API 类型
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, func: (event: IpcRendererEvent, ...args: any[]) => void) => void;
        removeAllListeners: (channel: string) => void;
      };
      shell2: {
        openExternal: (url: string) => Promise<void>;
      };
    };
  }
}

export const openCode = (ip: string) => {
  window.electron.shell2
    .openExternal("http://" + ip + ":8080")
    .then(() => {
      console.log("Opened Google in the default browser.");
    })
    .catch((err) => {
      console.error("Failed to open Google in the default browser:", err);
    });
};
const UdpMessageComponent: React.FC = () => {
  const [udpIp, setUdpIp] = useState<string[]>([]);
  const { selectSource } = usePlayerSelection();

  const { t } = useTranslation("openDialog");

  useEffect(() => {
    const handleUdpMessage = (_event: IpcRendererEvent, message: string) => {
      // 现在 message 是你在主进程中发送的实际消息内容
      if (!udpIp.includes(message)) {
        setUdpIp((prevUdpIp) => [...prevUdpIp, message]);
      }
    };
    // 使用暴露的 ipcRenderer
    window.electron.ipcRenderer.on("udp-message", handleUdpMessage);
    return () => {
      window.electron.ipcRenderer.removeAllListeners("udp-message");
    };
  }, [udpIp]);

  const createNewPlayer = async (ip: string) => {
    const newSourceId = "foxglove-websocket"; // 替换为实际的数据源 ID
    const connectionParams: DataSourceArgs = {
      type: "connection",
      params: {
        url: "ws://" + ip + ":8765", // 替换为实际的 URL
      },
    };

    await selectSource(newSourceId, connectionParams);
  };

  return (
    <div>
      <List disablePadding>
        {udpIp.map((message, index) => (
          <ListItem disablePadding key={index}>
            <TextMiddleTruncate text={message} />

            <Button onClick={() => openCode(message)}>{t("open")} Code</Button>
            <Button onClick={() => createNewPlayer(message)}>{t("openConnection")}</Button>
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default UdpMessageComponent;
