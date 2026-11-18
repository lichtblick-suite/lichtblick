/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import {
  BufferedTelemetrySink,
  getTelemetry,
  setTelemetrySink,
  TelemetryEvent,
} from "@lichtblick/suite-base/util/telemetry";
import { BasicBuilder } from "@lichtblick/test-builders";

import { usePanelLifecycleTelemetry } from "./usePanelLifecycleTelemetry";

type HookProps = { panelId: string | undefined; panelType: string };

function buildHookProps(): { panelId: string; panelType: string } {
  const panelType = BasicBuilder.string();
  return { panelId: `${panelType}!${BasicBuilder.string()}`, panelType };
}

/** Installs an enabled sink and collects the events it records. */
function installSink(): { sink: BufferedTelemetrySink; events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = [];
  const sink = new BufferedTelemetrySink({
    realm: "renderer",
    onEvent: (event) => events.push(event),
  });
  setTelemetrySink(sink);
  return { sink, events };
}

function renderLifecycleHook(initialProps: HookProps) {
  return renderHook(
    ({ panelId, panelType }: HookProps) => {
      usePanelLifecycleTelemetry(panelId, panelType);
    },
    { initialProps },
  );
}

describe("usePanelLifecycleTelemetry", () => {
  let sinks: BufferedTelemetrySink[] = [];

  function setupEnabled() {
    const installed = installSink();
    sinks.push(installed.sink);
    return installed;
  }

  afterEach(() => {
    setTelemetrySink(undefined);
    for (const sink of sinks) {
      sink.dispose();
    }
    sinks = [];
  });

  describe("when telemetry is enabled", () => {
    it("should emit panel.mount on mount and panel.unmount on unmount with the layout id and type", () => {
      // Given
      const { events } = setupEnabled();
      const props = buildHookProps();

      // When
      const { unmount } = renderLifecycleHook(props);
      unmount();

      // Then
      expect(events).toEqual([
        expect.objectContaining({
          name: "panel.mount",
          phase: "instant",
          scope: "panel",
          labels: { panelId: props.panelId, panelType: props.panelType },
        }),
        expect.objectContaining({
          name: "panel.unmount",
          phase: "instant",
          scope: "panel",
          labels: { panelId: props.panelId, panelType: props.panelType },
        }),
      ]);
    });

    it("should not emit again when re-rendered with the same panel id and type", () => {
      // Given
      const { events } = setupEnabled();
      const props = buildHookProps();
      const { rerender } = renderLifecycleHook(props);

      // When
      rerender({ ...props });

      // Then
      expect(events.map((event) => event.name)).toEqual(["panel.mount"]);
    });

    it("should emit unmount for the old id then mount for the new id when the panel id changes", () => {
      // Given
      const { events } = setupEnabled();
      const oldProps = buildHookProps();
      const newProps = buildHookProps();
      const { rerender } = renderLifecycleHook(oldProps);

      // When
      rerender(newProps);

      // Then
      expect(events.map(({ name, labels }) => ({ name, labels }))).toEqual([
        { name: "panel.mount", labels: oldProps },
        { name: "panel.unmount", labels: oldProps },
        { name: "panel.mount", labels: newProps },
      ]);
    });

    it("should not emit when the panel id is undefined", () => {
      // Given
      const { events } = setupEnabled();

      // When
      const { unmount } = renderLifecycleHook({
        panelId: undefined,
        panelType: BasicBuilder.string(),
      });
      unmount();

      // Then
      expect(events).toHaveLength(0);
    });

    it("should not emit panel.unmount when the sink was reset while the panel was mounted", () => {
      // Given
      const { events } = setupEnabled();
      const { unmount } = renderLifecycleHook(buildHookProps());

      // When
      setTelemetrySink(undefined);
      unmount();

      // Then
      expect(events.map((event) => event.name)).toEqual(["panel.mount"]);
    });
  });

  describe("when telemetry is disabled", () => {
    it("should not emit anything on mount or unmount", () => {
      // Given
      const telemetry = getTelemetry();
      const eventSpy = jest.spyOn(telemetry, "event");

      // When
      const { unmount } = renderLifecycleHook(buildHookProps());
      unmount();

      // Then
      expect(telemetry.isEnabled()).toBe(false);
      expect(eventSpy).not.toHaveBeenCalled();
      eventSpy.mockRestore();
    });
  });
});
