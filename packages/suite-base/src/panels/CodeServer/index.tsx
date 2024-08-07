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

import { useRef, useEffect, useState, Ref } from "react";

import Panel from "@lichtblick/suite-base/components/Panel";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { useCodeServerSettings } from "./settings";
import { CodeServerConfig } from "./types";

type Props = {
  config: CodeServerConfig;
  saveConfig: SaveConfig<CodeServerConfig>;
};

function CodeServerPanel(props: Props): JSX.Element {
  const { config, saveConfig } = props;
  const { host, port, password } = config;
  useCodeServerSettings(config, saveConfig);
  const parentDivRef = useRef<HTMLDivElement>();
  const iFramRef = useRef<HTMLIFrameElement>();
  const [url, setUrl] = useState<string>("");

  //检测到父元素宽高发生变化时跟随变化
  useEffect(() => {
    iFramRef.current!.width = String(parentDivRef.current?.offsetWidth);
    iFramRef.current!.height = String(parentDivRef.current!.offsetHeight);
  }, [parentDivRef.current?.offsetWidth, parentDivRef.current?.offsetHeight]);

  //网络设置变化时
  useEffect(() => {
    // port变化时赋值url
    const new_url = "http://" + host + ":" + port + "/?password=" + password;
    if (url !== new_url) {
      setUrl(new_url);
    }
  }, [url, host, port, password]);

  //网络设置变化时
  useEffect(() => {
    // 密码变化时重新获取cookie
  }, [password]);

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
      >
        <iframe
          src={url}
          title="Your iFrame"
          ref={iFramRef as Ref<HTMLIFrameElement>}
          loading="lazy"
        />
        {/* <iframe
          src=""
          security="restricted"
          // sandbox=""
          title="Your iFrame"
          ref={iFramRef as Ref<HTMLIFrameElement>}
        /> */}
      </Stack>
    </Stack>
  );
}

const defaultConfig: CodeServerConfig = {
  host: "localhost",
  port: "8080",
  password: "qwer123",
};

export default Panel(
  Object.assign(CodeServerPanel, {
    panelType: "CodeServer",
    defaultConfig,
  }),
);
