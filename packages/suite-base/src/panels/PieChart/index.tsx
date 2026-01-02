// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2024-2025 Yukihiro Saito <yukky.saito@gmail.com>
// SPDX-License-Identifier: MPL-2.0

import { useMemo } from "react";

import { useCrash } from "@lichtblick/hooks";
import { PanelExtensionContext } from "@lichtblick/suite";
import { CaptureErrorBoundary } from "@lichtblick/suite-base/components/CaptureErrorBoundary";
import Panel from "@lichtblick/suite-base/components/Panel";
import { PanelExtensionAdapter } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { createSyncRoot } from "@lichtblick/suite-base/panels/createSyncRoot";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { PieChart } from "./PieChart";
import { PieChartConfig } from "./types";

function initPanel(crash: ReturnType<typeof useCrash>, context: PanelExtensionContext) {
  return createSyncRoot(
    <CaptureErrorBoundary onError={crash}>
      <ThemeProvider isDark>
        <PieChart context={context} />
      </ThemeProvider>
    </CaptureErrorBoundary>,
    context.panelElement,
  );
}

type PieChartPanelAdapterProps = {
  config: PieChartConfig;
  saveConfig: SaveConfig<PieChartConfig>;
};

function PieChartPanelAdapter(props: PieChartPanelAdapterProps) {
  const crash = useCrash();
  const boundInitPanel = useMemo(() => initPanel.bind(undefined, crash), [crash]);

  return (
    <PanelExtensionAdapter
      config={props.config}
      saveConfig={props.saveConfig}
      initPanel={boundInitPanel}
      highestSupportedConfigVersion={1}
    />
  );
}

PieChartPanelAdapter.panelType = "PieChart";
PieChartPanelAdapter.defaultConfig = {};

export default Panel(PieChartPanelAdapter);
