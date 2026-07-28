/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fireEvent, render, screen } from "@testing-library/react";

import { PanelExtensionContext } from "@lichtblick/suite";

import { TacticalMap } from "./TacticalMap";
import { DEFAULT_CONFIG } from "./types";

function makeMockContext(overrides: Partial<PanelExtensionContext> = {}): PanelExtensionContext {
  return {
    initialState: { ...DEFAULT_CONFIG },
    layout: { addPanel: jest.fn() },
    onRender: undefined,
    panelElement: document.createElement("div"),
    saveState: jest.fn(),
    setDefaultPanelTitle: jest.fn(),
    setParameter: jest.fn(),
    setPreviewTime: jest.fn(),
    setSharedPanelState: jest.fn(),
    setVariable: jest.fn(),
    subscribe: jest.fn(),
    subscribeAppSettings: jest.fn(),
    unsubscribeAll: jest.fn(),
    updatePanelSettingsEditor: jest.fn(),
    watch: jest.fn(),
    unstable_subscribeMessageRange: jest.fn(),
    getTopicSchema: jest.fn(),
    getSchema: jest.fn(),
    ...overrides,
  } as unknown as PanelExtensionContext;
}

describe("TacticalMap", () => {
  it("renders a load button and subscribes to nothing until clicked", () => {
    const context = makeMockContext();
    render(<TacticalMap context={context} />);

    expect(screen.getByText("Load Tactical Map")).toBeTruthy();
    expect(context.subscribe).not.toHaveBeenCalled();
    expect(context.watch).not.toHaveBeenCalled();
    expect(context.onRender).toBeUndefined();
  });

  it("subscribes to topics and starts rendering once loaded", () => {
    const context = makeMockContext();
    render(<TacticalMap context={context} />);

    fireEvent.click(screen.getByText("Load Tactical Map"));

    expect(context.subscribe).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ topic: DEFAULT_CONFIG.odomTopic, preload: true }),
        expect.objectContaining({ topic: DEFAULT_CONFIG.zoneReportTopic, preload: true }),
        expect.objectContaining({ topic: DEFAULT_CONFIG.plannedPathTopic, preload: false }),
        expect.objectContaining({ topic: DEFAULT_CONFIG.hazardZoneTopic, preload: false }),
        expect.objectContaining({ topic: DEFAULT_CONFIG.pointCloudTopic, preload: false }),
      ]),
    );
    expect(context.watch).toHaveBeenCalledWith("allFrames");
    expect(context.watch).toHaveBeenCalledWith("currentFrame");
    expect(context.onRender).toBeDefined();
    expect(screen.queryByText("Load Tactical Map")).toBeNull();
  });

  it("unsubscribes on unmount after being loaded", () => {
    const context = makeMockContext();
    const { unmount } = render(<TacticalMap context={context} />);

    fireEvent.click(screen.getByText("Load Tactical Map"));
    unmount();

    expect(context.unsubscribeAll).toHaveBeenCalled();
    expect(context.onRender).toBeUndefined();
  });
});
