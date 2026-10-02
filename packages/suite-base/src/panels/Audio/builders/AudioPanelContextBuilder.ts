// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/no-extraneous-class */

import { PanelExtensionContext } from "@lichtblick/suite";
import AudioBuilder from "@lichtblick/suite-base/testing/builders/AudioBuilder";

import { AudioConfig } from "../types";

export type AudioPanelTestContext = PanelExtensionContext & {
  subscribeMock: jest.Mock;
};

export default class AudioPanelContextBuilder {
  public static context(configOverride: Partial<AudioConfig> = {}): AudioPanelTestContext {
    const config = AudioBuilder.config(configOverride);
    const subscribeMock = jest.fn();

    return {
      initialState: config,
      panelElement: document.createElement("div"),
      saveState: jest.fn(),
      setDefaultPanelTitle: jest.fn(),
      subscribeMock,
      unsubscribeAll: jest.fn(),
      watch: jest.fn(),
      updatePanelSettingsEditor: jest.fn(),
      onRender: undefined,
      subscribe: subscribeMock,
    } as unknown as AudioPanelTestContext;
  }
}
