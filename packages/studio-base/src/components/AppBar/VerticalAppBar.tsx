// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppstoreAddOutlined, SettingFilled } from "@ant-design/icons";
import { PanelLeft24Filled, PanelLeft24Regular } from "@fluentui/react-icons";
import { Button, Layout } from "antd";
import React, { useState } from "react";

import { AddPanelMenu } from "@foxglove/studio-base/components/AppBar/AddPanelMenu";
import { DataSource } from "@foxglove/studio-base/components/AppBar/DataSource";
import {
  WorkspaceContextStore,
  useWorkspaceStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@foxglove/studio-base/context/Workspace/useWorkspaceActions";

const { Sider } = Layout;


const VerticalAppBar: React.FC = () => {
  const selectLeftSidebarOpen = (store: WorkspaceContextStore) => store.sidebars.left.open;
  const { sidebarActions } = useWorkspaceActions();
  const { dialogActions } = useWorkspaceActions();
  const leftSidebarOpen = useWorkspaceStore(selectLeftSidebarOpen);
  const [panelAnchorEl, setPanelAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const panelMenuOpen = Boolean(panelAnchorEl);

  return (
    <Sider
      width={60}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        zIndex: 9999,
        // backdropFilter: "blur(10px)",
        boxShadow: "0 0 5px rgba(0, 0, 0, 0.25)",
      }}
    >
      <div>
        <div
          style={{
            position: "absolute",
            top: 40,
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Button
            style={{ boxShadow: "0 0 20px rgba(0, 0, 0, 0.3)" }}
            type="primary"
            shape="circle"
            icon={<DataSource />}
            onClick={() => {
              dialogActions.dataSource.open("connection");
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: 30 + 40 + 40,
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Button
            type="text"
            icon={<AppstoreAddOutlined rev={undefined} />}
            onClick={(event) => {
              setPanelAnchorEl(event.currentTarget);
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            top: 30 + 40 + 40 + 32 + 20,
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Button
            type="text"
            // type="primary"
            icon={leftSidebarOpen ? <PanelLeft24Filled /> : <PanelLeft24Regular />}
            onClick={() =>  sidebarActions.left.setOpen(!leftSidebarOpen)}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* <UserAvatarButton /> */}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Button
          type="text"
          // type="primary"
          icon={<SettingFilled rev={undefined} />}
          onClick={() => dialogActions.preferences.open("general")}
        />
      </div>
      <AddPanelMenu
        anchorEl={panelAnchorEl}
        open={panelMenuOpen}
        handleClose={() => setPanelAnchorEl(undefined)}
      />
    </Sider>
  );
};

export default VerticalAppBar;
