import { getIpAddress } from "@lichtblick/suite-base/components/AppBar/VerticalAppBar";
import { isRunningInElectron } from "@lichtblick/suite-base/components/DataSourceDialog/Start";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import Stack from "@lichtblick/suite-base/components/Stack";
import UdpMessageComponent from "@lichtblick/suite-base/components/UdpMessage";
import { Box, Button, Card, Divider, Typography } from "@mui/material";
import * as _ from "lodash-es";
import { useRef, ReactElement, useEffect, useState } from "react";
import request from "umi-request";

const ANIMATION_RESET_DELAY_MS = 1500;

type SystemInfo = {
  rosId: string;
  ip: string;
  version: string;
};
export default function VehiclesStateList(): ReactElement {
  // Don't run the animation when the sidebar first renders
  const skipAnimation = useRef<boolean>(true);
  const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;

  const playerName = useMessagePipeline(selectPlayerName);
  const [nowIPAddr, setIPAddr] = useState<string>("");
  const [codeOnlineState, setCodeOnlineState] = useState<boolean>(false);

  const [sysInfo, setSysInfo] = useState<SystemInfo>({ rosId: "", ip: "", version: "" });

  useEffect(() => {
    console.log("playerName: ", playerName);
    if (playerName != undefined) {
      const currentIp = getIpAddress(playerName);
      if (currentIp != undefined) {
        setIPAddr(currentIp + "");
        setCodeOnlineState(true);
      }
    }
  }, [playerName]);

  useEffect(() => {
    const timeoutId = setTimeout(() => (skipAnimation.current = false), ANIMATION_RESET_DELAY_MS);
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const getSystemInfo = async () => {
      try {
        const response = await request("http://" + nowIPAddr + ":9001/api/sysmessage", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        console.log("Response:", response);
        if (response) {
          setSysInfo(response);
        }
      } catch (error) {
        //   message.error("Failed to update light" + error);
        console.error("Request failed:", error);
      }
    };
    if (nowIPAddr) getSystemInfo();
  }, [nowIPAddr]);
  return (
    <Stack flex="auto" fullWidth overflowX="auto">
      {isRunningInElectron() && (
        <Card variant="outlined">
          <Box sx={{ p: 2 }}>
            <Stack direction="row">
              <Typography gutterBottom variant="h6" component="div">
                在线设备切换
              </Typography>
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography gutterBottom variant="body2">
              当前活跃
            </Typography>

            <>
              <UdpMessageComponent />
            </>
          </Box>
        </Card>
      )}
      {codeOnlineState && (
        <Card variant="outlined">
          <Box sx={{ p: 2 }}>
            <Stack direction="row">
              <Typography gutterBottom variant="h6" component="div">
                当前设备状态
              </Typography>
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography gutterBottom variant="body2">
              软件版本：{sysInfo.version}
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Typography gutterBottom variant="body2">
              系统版本：v22
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Typography gutterBottom variant="body2">
              ROSID: {sysInfo.rosId}
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <Typography gutterBottom variant="body2">
              IP地址：{sysInfo.ip}
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            软件更新
            <Button>检查更新</Button>
          </Box>
        </Card>
      )}
    </Stack>
  );
}
