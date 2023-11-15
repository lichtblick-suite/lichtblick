// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";
import { useTranslation } from "react-i18next";

import Panel from "@foxglove/studio-base/components/Panel";
import { PanelExtensionAdapter } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { useAppContext } from "@foxglove/studio-base/context/AppContext";
import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import PanelCatalogContext, {
  PanelCatalog,
  PanelInfo,
} from "@foxglove/studio-base/context/PanelCatalogContext";
import * as panels from "@foxglove/studio-base/panels";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

type PanelProps = {
  config: unknown;
  saveConfig: SaveConfig<unknown>;
};

export default function PanelCatalogProvider(props: PropsWithChildren): React.ReactElement {
  const { t } = useTranslation("panels");

  const { extraPanels } = useAppContext();
  const extensionPanels = useExtensionCatalog((state) => state.installedPanels);

  const wrappedExtensionPanels = useMemo<PanelInfo[]>(() => {
    return Object.values(extensionPanels ?? {}).map((panel) => {
      const panelType = `${panel.extensionName}.${panel.registration.name}`;
      const PanelWrapper = (panelProps: PanelProps) => {
        return (
          <>
            <PanelExtensionAdapter
              config={panelProps.config}
              saveConfig={panelProps.saveConfig}
              initPanel={panel.registration.initPanel}
            />
          </>
        );
      };
      PanelWrapper.panelType = panelType;
      PanelWrapper.defaultConfig = {};
      return {
        category: "misc",
        title: panel.registration.name,
        type: panelType,
        module: async () => ({ default: Panel(PanelWrapper) }),
        extensionNamespace: panel.extensionNamespace,
      };
    });
  }, [extensionPanels]);

  // Re-call the function when the language changes to ensure that the panel's information is successfully translated
  const builtinPanelsInfo = useMemo(() => panels.getBuiltin(t), [t]);

  const allPanels = useMemo(() => {
    return [...builtinPanelsInfo, ...wrappedExtensionPanels, ...(extraPanels ?? [])];
  }, [wrappedExtensionPanels, builtinPanelsInfo, extraPanels]);

  const panelsByType = useMemo(() => {
    const byType = new Map<string, PanelInfo>();

    for (const panel of allPanels) {
      const type = panel.type;
      byType.set(type, panel);
    }
    return byType;
  }, [allPanels]);

  const provider = useMemo<PanelCatalog>(() => {
    return {
      getPanels() {
        return allPanels;
      },
      getPanelByType(type: string) {
        return panelsByType.get(type);
      },
    };
  }, [panelsByType, allPanels]);

  return (
    <PanelCatalogContext.Provider value={provider}>{props.children}</PanelCatalogContext.Provider>
  );
}
