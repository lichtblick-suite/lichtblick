import { Tabs, Tab } from "@mui/material";
import React, { useState } from "react";

import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import { DummyTable } from "@lichtblick/suite-base/panels/DeviceSetting/components/DummyTable";
import { EtcTable } from "@lichtblick/suite-base/panels/DeviceSetting/components/EtcTable";
import { useDeviceSettings } from "@lichtblick/suite-base/panels/DeviceSetting/settings";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { LightTable } from "./components/LightTable";
import { DeviceSetting } from "./types";

// import { DummyTable } from "@lichtblick/suite-base/panels/DeviceSetting/components/DummyTable";
// import { EtcTable } from "@lichtblick/suite-base/panels/DeviceSetting/components/EtcTable";

type Props = {
  config: DeviceSetting;
  saveConfig: SaveConfig<DeviceSetting>;
};

function DeviceSettingsPanels(props: Props): React.JSX.Element {
  const { config, saveConfig } = props;
  const [tabValue, setTabValue] = useState(0);
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  useDeviceSettings(config, saveConfig);
  return (
    <Stack fullHeight>
      <PanelToolbar />

      <Tabs value={tabValue} centered onChange={handleTabChange} aria-label="device tables">
        <Tab label="红绿灯" />
        <Tab label="闸机" />
        <Tab label="假人" />
        {/* <Tab label="红绿灯调试" /> */}
      </Tabs>

      {tabValue === 0 && <LightTable config={config} />}
      {tabValue === 1 && <EtcTable config={config} />}
      {tabValue === 2 && <DummyTable config={config} />}
      {/* {tabValue === 3 && <LightFlashMode config={config} />} */}
    </Stack>
  );
}

function TeleopPanelAdapter(props: Props) {
  return <DeviceSettingsPanels {...props} />;
}

const defaultConfig: DeviceSetting = {
  mqttHost: "192.168.50.101",
  port: 50082,
  save: false,
};
export default Panel(
  Object.assign(TeleopPanelAdapter, {
    panelType: "DeviceSetting",
    defaultConfig,
  }),
);
