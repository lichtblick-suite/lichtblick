/* eslint-disable react/forbid-component-props */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Tabs, Tab, Paper, useTheme, useMediaQuery } from "@mui/material";
import React, { useState } from "react";

// 定义 Props 类型
interface MapFilesTabProps {
  mapFiles: string[]; // 假设 mapFiles 是字符串数组
  setMapName: (mapName: string) => void; // 定义 setMapName 的回调函数类型
  initialValue?: string; // 可选的初始值，默认为字符串
}

function MapFilesTab({ mapFiles, setMapName, initialValue = "" }: MapFilesTabProps) {
  const [value, setValue] = useState(() => {
    // 如果有初始值，找到对应的索引
    if (initialValue) {
      const index = mapFiles.findIndex((map: string) => map === initialValue);
      return index >= 0 ? index : 0;
    }
    return 0;
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleChange = (_event: unknown, newValue: number) => {
    setValue(newValue);
    // 将选中的地图名称传递给父组件
    const selectMapName = mapFiles[newValue];
    setMapName(selectMapName ?? "");
  };

  return (
    <Paper elevation={3} sx={{ width: "100%", marginBottom: 2 }}>
      <div style={{ borderBottom: "1px solid", borderColor: theme.palette.divider }}>
        <Tabs
          value={value}
          onChange={handleChange}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
          allowScrollButtonsMobile
          indicatorColor="primary"
          textColor="primary"
          centered={!isMobile}
          aria-label="map files tabs"
        >
          {mapFiles.map(
            (
              mapFile:
                | string
                | number
                | boolean
                | React.ReactElement
                | Iterable<React.ReactNode>
                | React.ReactPortal
                | null
                | undefined,
              index: React.Key | null | undefined,
            ) => (
              <Tab
                key={index}
                label={mapFile}
                id={`map-tab-${index}`}
                aria-controls={`map-tabpanel-${index}`}
              />
            ),
          )}
        </Tabs>
      </div>

      {/* 可选：显示当前选择的地图名称 */}
      {/* <div style={{ padding: theme.spacing(2) }}>
        <Typography variant="body1">当前选择的地图: {mapFiles[value]}</Typography>
      </div> */}
    </Paper>
  );
}
export default MapFilesTab;
