import mqtt from "../mqtt";
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from "@mui/material";
import { Device, DeviceSetting } from "../types";
type Props = {
  config: DeviceSetting;
  //   saveConfig: SaveConfig<DeviceSetting>;
};
export const DummyTable = (props: Props) => {
  const [count, setValue] = useState<Device[]>();
  const { config } = props;

  useEffect(() => {
    const initMqtt = async () => {
      try {
        await mqtt.init({
          clientId: "web_client_c1",
          host: config.mqttHost,
          post: config.port,
        });
        mqtt.subscribe("device/all", "source", (message: string) => {
          try {
            const parsedMessage = JSON.parse(JSON.parse(message));
            parsedMessage.dummy_.forEach((object: Device) => {
              setValue((prevValue = []) => {
                const updatedValue = prevValue.map((item) =>
                  item.id === object.id ? { ...item, state: object.state } : item,
                );
                if (!updatedValue.some((item) => item.id === object.id)) {
                  updatedValue.push(object);
                }
                return updatedValue;
              });
            });
          } catch (error) {
            console.error("Failed to parse message:", error);
          }
        });
      } catch (error) {
        console.error("Failed to initialize MQTT:", error);
      }
    };

    initMqtt();

    return () => {
      mqtt.unsubscribe("device/all", "source");
      mqtt.drop("source");
    };
  }, []);

  const sendMQTTMessage = (id: number, state: number) => {
    try {
      mqtt.publish("device/dummy", JSON.stringify({ id: id, state: state }) ?? "{}");
    } catch (error) {
      console.error("Failed to send MQTT message:", error);
    }
  };

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>编号</TableCell>
            <TableCell>类型</TableCell>
            <TableCell>错误信息</TableCell>
            <TableCell>状态</TableCell>
            <TableCell>操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {count?.map((record) => (
            <TableRow key={record.id}>
              <TableCell>{record.id}</TableCell>
              <TableCell>{record.type}</TableCell>
              <TableCell>{record.error}</TableCell>
              <TableCell>{record.state}</TableCell>
              <TableCell>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => sendMQTTMessage(record.id, 1)}
                  style={{ marginRight: 8 }}
                >
                  开
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => sendMQTTMessage(record.id, 0)}
                >
                  关
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
