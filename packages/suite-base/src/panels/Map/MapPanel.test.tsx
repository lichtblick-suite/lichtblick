/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, render } from "@testing-library/react";

import { MessageEvent, PanelExtensionContext, RenderState, Topic } from "@lichtblick/suite";

import MapPanel from "./MapPanel";

const mockGeoJSON = jest.fn();

jest.mock("leaflet", () => {
  class FakeLayer {
    public addTo = jest.fn().mockReturnThis();
    public addLayer = jest.fn();
    public clearLayers = jest.fn();
    public remove = jest.fn();
    public bringToBack = jest.fn();
    public bindTooltip = jest.fn();
    public on = jest.fn();
  }
  return {
    CircleMarker: FakeLayer,
    FeatureGroup: FakeLayer,
    LayerGroup: FakeLayer,
    LatLngBounds: FakeLayer,
    Layer: FakeLayer,
    TileLayer: class {
      public options: Record<string, unknown> = {};
      public setUrl = jest.fn();
    },
    Map: class {
      public attributionControl = { setPrefix: jest.fn() };
      public setView = jest.fn();
      public addLayer = jest.fn();
      public removeLayer = jest.fn();
      public invalidateSize = jest.fn();
      public getBounds = jest.fn();
      public getCenter = jest.fn().mockReturnValue({ lat: 0, lng: 0 });
      public getZoom = jest.fn().mockReturnValue(10);
      public on = jest.fn();
      public off = jest.fn();
      public remove = jest.fn();
    },
    geoJSON: (...args: unknown[]) => {
      mockGeoJSON(...args);
      return { addTo: jest.fn() };
    },
  };
});

jest.mock("@lichtblick/suite-base/panels/Map/FilteredPointLayer", () => ({
  __esModule: true,
  default: () => ({ bringToBack: jest.fn(), addTo: jest.fn() }),
}));

const NAV_TOPIC: Topic = { name: "/gps", schemaName: "sensor_msgs/NavSatFix" };
const GEO_TOPIC: Topic = { name: "/route", schemaName: "foxglove.GeoJSON" };

function geoJsonMessage(name: string, receiveTimeSec: number): MessageEvent {
  return {
    topic: GEO_TOPIC.name,
    schemaName: GEO_TOPIC.schemaName,
    receiveTime: { sec: receiveTimeSec, nsec: 0 },
    sizeInBytes: 0,
    message: {
      geojson: JSON.stringify({
        type: "Feature",
        properties: { name },
        geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
      }),
    },
  };
}

function navMessage(receiveTimeSec: number): MessageEvent {
  return {
    topic: NAV_TOPIC.name,
    schemaName: NAV_TOPIC.schemaName,
    receiveTime: { sec: receiveTimeSec, nsec: 0 },
    sizeInBytes: 0,
    message: { latitude: 1, longitude: 2 },
  };
}

function setup() {
  const subscribe = jest.fn();
  const subscribeMessageRange = jest.fn().mockReturnValue(jest.fn());

  const context = {
    initialState: {},
    saveState: jest.fn(),
    setPreviewTime: jest.fn(),
    seekPlayback: jest.fn(),
    subscribe,
    unsubscribeAll: jest.fn(),
    updatePanelSettingsEditor: jest.fn(),
    unstable_subscribeMessageRange: subscribeMessageRange,
    watch: jest.fn(),
    onRender: undefined,
  } as unknown as PanelExtensionContext;

  const utils = render(<MapPanel context={context} />);

  const emitRender = (renderState: RenderState) => {
    act(() => {
      context.onRender?.(renderState, () => {});
    });
  };

  return { subscribe, subscribeMessageRange, emitRender, ...utils };
}

/** Names of the GeoJSON features handed to leaflet, in the order they were drawn. */
function drawnFeatureNames(): string[] {
  return mockGeoJSON.mock.calls.map(
    (call) => (call[0] as { properties?: { name?: string } }).properties?.name ?? "",
  );
}

describe("MapPanel", () => {
  beforeEach(() => {
    mockGeoJSON.mockClear();
  });

  it("should not range subscribe to GeoJSON topics", () => {
    // GIVEN a panel showing one location fix topic and one GeoJSON topic
    const { subscribe, subscribeMessageRange, emitRender } = setup();

    // WHEN the topic list arrives
    emitRender({ topics: [NAV_TOPIC, GEO_TOPIC] });

    // THEN only the location fix topic is accumulated over the whole recording, because ranging
    // over GeoJSON would draw every historical and not-yet-reached message at once (#1243).
    const rangedTopics = subscribeMessageRange.mock.calls.map(
      (call) => (call[0] as { topic: string }).topic,
    );
    expect(rangedTopics).toEqual([NAV_TOPIC.name]);

    // ...while both topics are still subscribed for the current frame
    const subscribed = (subscribe.mock.calls.at(-1)?.[0] as { topic: string }[] | undefined)?.map(
      (subscription) => subscription.topic,
    );
    expect(subscribed).toEqual([NAV_TOPIC.name, GEO_TOPIC.name]);
  });

  it("should draw only the newest GeoJSON message of a frame", () => {
    // GIVEN a panel with a GeoJSON topic
    const { emitRender } = setup();
    emitRender({ topics: [GEO_TOPIC] });
    mockGeoJSON.mockClear();

    // WHEN a frame carries several messages on that topic
    emitRender({
      currentFrame: [geoJsonMessage("old", 1), geoJsonMessage("newer", 2), geoJsonMessage("newest", 3)],
    });

    // THEN only the last one is drawn, since each message replaces the previous one
    expect(drawnFeatureNames()).toEqual(["newest"]);
  });

  it("should replace the drawn GeoJSON when a newer message arrives", () => {
    // GIVEN a panel that has drawn a GeoJSON message
    const { emitRender } = setup();
    emitRender({ topics: [GEO_TOPIC] });
    emitRender({ currentFrame: [geoJsonMessage("first", 1)] });
    mockGeoJSON.mockClear();

    // WHEN a later message arrives on the same topic
    emitRender({ currentFrame: [geoJsonMessage("second", 2)] });

    // THEN only the newer one is drawn
    expect(drawnFeatureNames()).toEqual(["second"]);
  });

  it("should not draw GeoJSON collected by the range subscription", async () => {
    // GIVEN a panel with both kinds of topic
    const { subscribeMessageRange, emitRender } = setup();
    emitRender({ topics: [NAV_TOPIC, GEO_TOPIC] });
    mockGeoJSON.mockClear();

    // WHEN the range subscription for the location fix topic yields a batch that also happens to
    // contain GeoJSON messages
    const subscribeArgs = subscribeMessageRange.mock.calls[0]![0] as {
      onNewRangeIterator: (iterator: AsyncIterable<MessageEvent[]>) => Promise<void>;
    };
    await act(async () => {
      await subscribeArgs.onNewRangeIterator(
        (async function* () {
          yield [navMessage(1), geoJsonMessage("historical", 1)];
        })(),
      );
    });

    // THEN nothing from the historical range is drawn as GeoJSON
    expect(drawnFeatureNames()).toEqual([]);
  });
});
