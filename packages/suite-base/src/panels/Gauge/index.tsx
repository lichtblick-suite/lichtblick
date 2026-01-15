// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

import { Gauge } from "./Gauge";
import { GaugePanelAdapterProps } from "./types";

function initPanel(crash: ReturnType<typeof useCrash>, context: PanelExtensionContext) {
  return createSyncRoot(
    <CaptureErrorBoundary onError={crash}>
      <ThemeProvider isDark>
        <Gauge context={context} />
      </ThemeProvider>
    </CaptureErrorBoundary>,
    context.panelElement,
  );
}

function GaugePanelAdapter({ config, saveConfig }: GaugePanelAdapterProps) {
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

GaugePanelAdapter.panelType = "Gauge";
GaugePanelAdapter.defaultConfig = {};

export default Panel(GaugePanelAdapter);
