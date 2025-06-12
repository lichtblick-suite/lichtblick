// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { useCrash } from "@lichtblick/hooks";
import { PanelExtensionContext } from "@lichtblick/suite";
import { CaptureErrorBoundary } from "@lichtblick/suite-base/components/CaptureErrorBoundary";
import Panel from "@lichtblick/suite-base/components/Panel";
import { PanelExtensionAdapter } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { createSyncRoot } from "@lichtblick/suite-base/panels/createSyncRoot";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { Indicator } from "./Indicator";
import { IndicatorConfig } from "./types";

function initPanel(crash: ReturnType<typeof useCrash>, context: PanelExtensionContext) {
  return createSyncRoot(
    <CaptureErrorBoundary onError={crash}>
      <ThemeProvider isDark>
        <Indicator context={context} />
      </ThemeProvider>
    </CaptureErrorBoundary>,
    context.panelElement,
  );
}

type IndicatorPanelAdapterProps = {
  config: IndicatorConfig;
  saveConfig: SaveConfig<IndicatorConfig>;
};

function IndicatorLightPanelAdapter({ config, saveConfig }: IndicatorPanelAdapterProps) {
  const crash = useCrash();
  const boundInitPanel = useMemo(() => initPanel.bind(undefined, crash), [crash]);
  return (
    <PanelExtensionAdapter
      config={config}
      saveConfig={saveConfig}
      initPanel={boundInitPanel}
      highestSupportedConfigVersion={1}
    />
  );
}

export default Panel(
  Object.assign(IndicatorLightPanelAdapter, {
    panelType: "Indicator",
    defaultConfig: {},
  }),
);
