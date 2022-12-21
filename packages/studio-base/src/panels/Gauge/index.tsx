// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PanelExtensionContext } from "@foxglove/studio";
import Panel from "@foxglove/studio-base/components/Panel";
import { PanelExtensionAdapter } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { Gauge } from "./Gauge";
import helpContent from "./index.help.md";
import { Config } from "./types";

function initPanel(context: PanelExtensionContext) {
  const root = createRoot(context.panelElement);
  root.render(
    <StrictMode>
      <ThemeProvider isDark>
        <Gauge context={context} />
      </ThemeProvider>
    </StrictMode>,
  );
  return () => {
    root.unmount();
  };
}

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

function GaugePanelAdapter(props: Props) {
  return (
    <PanelExtensionAdapter
      config={props.config}
      saveConfig={props.saveConfig}
      help={helpContent}
      initPanel={initPanel}
    />
  );
}

GaugePanelAdapter.panelType = "Gauge";
GaugePanelAdapter.defaultConfig = {};

export default Panel(GaugePanelAdapter);
