// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { useExtensionRegistry } from "@foxglove/studio-base/context/ExtensionRegistryContext";

const FullPanelId = "builtin.hello";

function HelloWorldPanel(): JSX.Element {
  const registry = useExtensionRegistry();

  const PanelComponent = useMemo(() => {
    const panelRegistration = registry.getRegisteredPanel(FullPanelId);
    return panelRegistration?.registration.component;
  }, [registry]);

  if (!PanelComponent) {
    return (
      <>
        <PanelToolbar floating />
      </>
    );
  }

  return (
    <>
      <PanelToolbar floating />
      <PanelComponent />
    </>
  );
}

HelloWorldPanel.panelType = FullPanelId;
HelloWorldPanel.defaultConfig = {};
HelloWorldPanel.supportsStrictMode = true;

export default Panel(HelloWorldPanel);
