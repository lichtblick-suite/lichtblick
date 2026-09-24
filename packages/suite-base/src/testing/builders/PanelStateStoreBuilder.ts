// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import { defaults } from "@lichtblick/test-builders";

class PanelStateStoreBuilder {
  public static panelStateStore(props: Partial<PanelStateStore> = {}): PanelStateStore {
    return defaults<PanelStateStore>(props, {
      sequenceNumbers: {},
      settingsTrees: {},
      defaultTitles: {},
      incrementSequenceNumber: jest.fn(),
      updateSettingsTree: jest.fn(),
      updateDefaultTitle: jest.fn(),
    });
  }
}

export default PanelStateStoreBuilder;
