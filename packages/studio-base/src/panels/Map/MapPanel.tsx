// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Map as LeafMap,
  TileLayer,
  Control,
  LatLngBounds,
  CircleMarker,
  FeatureGroup,
  LayersControlEvent,
  LayerGroup,
} from "leaflet";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatest } from "react-use";
import { useDebouncedCallback } from "use-debounce";

import { toSec } from "@foxglove/rostime";
import { PanelExtensionContext, MessageEvent } from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import FilteredPointLayer, {
  POINT_MARKER_RADIUS,
} from "@foxglove/studio-base/panels/Map/FilteredPointLayer";
import { Topic } from "@foxglove/studio-base/players/types";

import { NavSatFixMsg, NavSatFixStatus, Point } from "./types";

const COLOR_HISTORY = "#6771ef";
const COLOR_ACTIVE_FIX = "#ec1515";
const COLOR_ACTIVE_NO_FIX = "#5f0909";

// Persisted panel state
type Config = {
  zoomLevel?: number;
  disabledTopics?: [];
};

type MapPanelProps = {
  context: PanelExtensionContext;
};

function MapPanel(props: MapPanelProps): JSX.Element {
  const { context } = props;

  const mapContainerRef = useRef<HTMLDivElement>(ReactNull);

  const [config] = useState<Config>(props.context.initialState as Config);

  // Panel state management to update our set of messages
  // We use state to trigger a render on the panel
  const [navMessages, setNavMessages] = useState<readonly MessageEvent<NavSatFixMsg>[]>([]);
  const [allNavMessages, setAllNavMessages] = useState<readonly MessageEvent<NavSatFixMsg>[]>([]);

  // Panel state management to track the list of available topics
  const [topics, setTopics] = useState<readonly Topic[]>([]);

  // Disabled topics is the set of topics the user has unchecked in the layer control
  // Track disabled topics rather than enabled so any new topics display by default
  const [disabledTopics, setDisabledTopics] = useState(
    () => new Set<string>(config.disabledTopics),
  );

  // Panel state management to track the current preview time
  const [previewTime, setPreviewTime] = useState<number | undefined>();

  const [currentMap, setCurrentMap] = useState<LeafMap | undefined>(undefined);

  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const eligibleTopics = useMemo(() => {
    return topics
      .filter(
        (topic) =>
          topic.datatype === "sensor_msgs/NavSatFix" ||
          topic.datatype === "sensor_msgs/msg/NavSatFix",
      )
      .map((topic) => topic.name);
  }, [topics]);

  // Subscribe to eligible and enabled topics
  useEffect(() => {
    const eligibleEnabled = eligibleTopics.filter((topic) => !disabledTopics.has(topic));
    context.subscribe(eligibleEnabled);
    return () => {
      context.unsubscribeAll();
    };
  }, [context, disabledTopics, eligibleTopics]);

  type TopicGroups = {
    topicGroup: LayerGroup;
    currentFrame: FeatureGroup;
    allFrames: FeatureGroup;
  };

  // topic layers is a map of topic -> two feature groups
  // A feature group for all messages markers, and a feature group for current frame markers
  const topicLayers = useMemo(() => {
    const topicLayerMap = new Map<string, TopicGroups>();
    for (const topic of eligibleTopics) {
      const allFrames = new FeatureGroup();
      const currentFrame = new FeatureGroup();
      const topicGroup = new LayerGroup([allFrames, currentFrame]);
      topicLayerMap.set(topic, {
        topicGroup,
        allFrames,
        currentFrame,
      });
    }
    return topicLayerMap;
  }, [eligibleTopics]);

  // layer controls for user selection between map, satellite and topics
  const layerControl = useMemo(() => new Control.Layers(), []);

  // toggling layers changes the disabledTopics list, but we don't want to re-run this effect
  // because the layer controls have already updated the map with active/inactive layers
  const disabledTopicsLatest = useLatest(disabledTopics);
  useLayoutEffect(() => {
    if (!currentMap) {
      return;
    }

    const topicLayerEntries = [...topicLayers.entries()];
    for (const entry of topicLayerEntries) {
      const topic = entry[0];
      const featureGroups = entry[1];
      layerControl.addOverlay(featureGroups.topicGroup, topic);

      // if the topic does not appear in the disabled topics list, add to map so it displays
      if (!disabledTopicsLatest.current.has(topic)) {
        currentMap.addLayer(featureGroups.topicGroup);
      }
    }

    return () => {
      for (const entry of topicLayerEntries) {
        const featureGroups = entry[1];

        layerControl.removeLayer(featureGroups.topicGroup);
        currentMap.removeLayer(featureGroups.topicGroup);
      }
    };
  }, [currentMap, disabledTopicsLatest, layerControl, topicLayers]);

  // During the initial mount we setup our context render handler
  useLayoutEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const tileLayer = new TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      maxNativeZoom: 18,
      maxZoom: 24,
    });

    const satelliteLayer = new TileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxNativeZoom: 18,
        maxZoom: 24,
      },
    );

    const map = new LeafMap(mapContainerRef.current, {
      // sets the tile layer as the default
      layers: [tileLayer],
    });

    // the map must be initialized with some view before other features work
    map.setView([0, 0], 10);

    // layer controls for user selection between satellite and map
    layerControl.addBaseLayer(tileLayer, "map");
    layerControl.addBaseLayer(satelliteLayer, "satellite");
    layerControl.setPosition("topleft");
    layerControl.addTo(map);

    setCurrentMap(map);

    // tell the context we care about updates on these fields
    context.watch("topics");
    context.watch("currentFrame");
    context.watch("allFrames");
    context.watch("previewTime");

    // layer is added (checked) - remove from disabled list
    map.on("overlayadd", (ev: LayersControlEvent) => {
      const topic = ev.name;
      setDisabledTopics((prevDisabled) => {
        if (!prevDisabled.has(topic)) {
          return prevDisabled;
        }
        prevDisabled.delete(topic);
        return new Set(prevDisabled);
      });
    });

    // layer is removed (unckecked) - add to disabled topics list
    map.on("overlayremove", (ev: LayersControlEvent) => {
      const topic = ev.name;
      setDisabledTopics((prevDisabled) => {
        if (prevDisabled.has(topic)) {
          return prevDisabled;
        }
        prevDisabled.add(topic);
        return new Set(prevDisabled);
      });
    });

    // The render event handler updates the state for our messages an triggers a component render
    //
    // The panel must call the _done_ function passed to render indicating the render completed.
    // The panel will not receive render calls until it calls done.
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setPreviewTime(renderState.previewTime);

      if (renderState.topics) {
        setTopics(renderState.topics);
      }

      // if there is no current frame, we keep the last frame we've seen
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        setNavMessages(renderState.currentFrame as readonly MessageEvent<NavSatFixMsg>[]);
      }

      if (renderState.allFrames) {
        setAllNavMessages(renderState.allFrames as readonly MessageEvent<NavSatFixMsg>[]);
      }
    };

    return () => {
      map.remove();
      context.onRender = undefined;
    };
  }, [context, layerControl]);

  const onHover = useCallback(
    (messageEvent?: MessageEvent<NavSatFixMsg>) => {
      context.setPreviewTime(
        messageEvent == undefined ? undefined : toSec(messageEvent.receiveTime),
      );
    },
    [context],
  );

  const onClick = useCallback(
    (messageEvent: MessageEvent<NavSatFixMsg>) => {
      context.seekPlayback?.(toSec(messageEvent.receiveTime));
    },
    [context],
  );

  /// --- the remaining code is unrelated to the extension api ----- ///

  const [center, setCenter] = useState<Point | undefined>();
  const [filterBounds, setFilterBounds] = useState<LatLngBounds | undefined>();

  // calculate center point from blocks if we don't have a center point
  useEffect(() => {
    setCenter((old) => {
      // set center only once
      if (old) {
        return old;
      }

      for (const messageEvent of allNavMessages) {
        const lat = messageEvent.message.latitude;
        const lon = messageEvent.message.longitude;
        const point: Point = {
          lat,
          lon,
        };

        return point;
      }

      for (const messageEvent of navMessages) {
        const point: Point = {
          lat: messageEvent.message.latitude,
          lon: messageEvent.message.longitude,
        };

        return point;
      }

      return;
    });
  }, [allNavMessages, navMessages]);

  useEffect(() => {
    if (!currentMap) {
      return;
    }

    // Group messages by topic to render into layers by topic
    const byTopic = new Map<string, MessageEvent<NavSatFixMsg>[]>();
    for (const msgEvent of allNavMessages) {
      const msgEvents = byTopic.get(msgEvent.topic) ?? [];
      msgEvents.push(msgEvent);
      byTopic.set(msgEvent.topic, msgEvents);
    }

    for (const [topic, events] of byTopic) {
      const topicLayer = topicLayers.get(topic);
      if (!topicLayer) {
        // If we get a message for a topic we did not subscribe to - something bad has happened.
        // We'll pretend like it didn't happen and move along.
        continue;
      }

      const pointLayer = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: events,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: COLOR_HISTORY,
        onHover,
        onClick,
      });

      topicLayer.allFrames.clearLayers();
      topicLayer.allFrames.addLayer(pointLayer);
    }
  }, [allNavMessages, currentMap, filterBounds, onClick, onHover, topicLayers]);

  // create a filtered marker layer for the current nav messages
  // this effect is added after the allNavMessages so the layer appears above
  useEffect(() => {
    if (!currentMap) {
      return;
    }

    // Group messages by topic to render into layers by topic
    const byTopic = new Map<string, MessageEvent<NavSatFixMsg>[]>();
    for (const msgEvent of navMessages) {
      const msgEvents = byTopic.get(msgEvent.topic) ?? [];
      msgEvents.push(msgEvent);
      byTopic.set(msgEvent.topic, msgEvents);
    }

    for (const [topic, events] of byTopic) {
      const topicLayer = topicLayers.get(topic);
      if (!topicLayer) {
        // If we get a message for a topic we did not subscribe to - something bad has happened.
        // We'll pretend like it didn't happen and move along.
        continue;
      }

      const hasFix = (ev: MessageEvent<NavSatFixMsg>) =>
        ev.message.status.status !== NavSatFixStatus.STATUS_NO_FIX;
      const noFixEvents = events.filter((ev) => !hasFix(ev));
      const fixEvents = events.filter(hasFix);

      const pointLayerNoFix = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: noFixEvents,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: COLOR_ACTIVE_NO_FIX,
        showAccuracy: true,
      });
      const pointLayerFix = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: fixEvents,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: COLOR_ACTIVE_FIX,
        showAccuracy: true,
      });

      // clear any previous layers to only display the current frame
      topicLayer.currentFrame.clearLayers();
      topicLayer.currentFrame.addLayer(pointLayerNoFix);
      topicLayer.currentFrame.addLayer(pointLayerFix);
    }
  }, [currentMap, filterBounds, navMessages, topicLayers]);

  // create a marker for the closest gps message to our current preview time
  useEffect(() => {
    if (!currentMap || previewTime == undefined) {
      return;
    }

    // get the point occuring most recently before preview time but not after preview time
    let point: Point | undefined;
    let stampDelta = Number.MAX_VALUE;
    for (const msgEvent of allNavMessages) {
      const stamp = toSec(msgEvent.receiveTime);
      const delta = previewTime - stamp;
      if (delta < stampDelta && delta >= 0) {
        stampDelta = delta;
        point = {
          lat: msgEvent.message.latitude,
          lon: msgEvent.message.longitude,
        };
      }
    }
    if (!point) {
      return;
    }

    const marker = new CircleMarker([point.lat, point.lon], {
      radius: POINT_MARKER_RADIUS,
      color: "yellow",
      stroke: false,
      fillOpacity: 1,
      interactive: false,
    });

    marker.addTo(currentMap);
    return () => {
      marker.remove();
    };
  }, [allNavMessages, currentMap, filterBounds, previewTime]);

  // persist panel config on zoom changes
  useEffect(() => {
    if (!currentMap) {
      return;
    }

    const zoomChange = () => {
      context.saveState({
        zoomLevel: currentMap.getZoom(),
      });
    };

    currentMap.on("zoom", zoomChange);
    return () => {
      currentMap.off("zoom", zoomChange);
    };
  }, [context, currentMap]);

  useEffect(() => {
    context.saveState({
      disabledTopics: Array.from(disabledTopics),
    });
  }, [context, disabledTopics]);

  // we don't want to invoke filtering on every user map move so we rate limit to 100ms
  const moveHandler = useDebouncedCallback(
    (map: LeafMap) => {
      setFilterBounds(map.getBounds());
    },
    100,
    // maxWait equal to debounce timeout makes the debounce act like a throttle
    // Without a maxWait - invocations of the debounced invalidate reset the countdown
    // resulting in no invalidation when scales are constantly changing (playback)
    { leading: false, maxWait: 100 },
  );

  // setup handler for map move events to re-filter points
  // this also handles zoom changes
  useEffect(() => {
    if (!currentMap) {
      return;
    }

    const handler = () => moveHandler(currentMap);
    currentMap.on("move", handler);
    return () => {
      currentMap.off("move", handler);
    };
  }, [currentMap, moveHandler]);

  // Update the map view when centerpoint changes
  useEffect(() => {
    if (!center) {
      return;
    }

    currentMap?.setView([center.lat, center.lon], config.zoomLevel ?? 10);
  }, [center, config.zoomLevel, currentMap]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {!center && <EmptyState>Waiting for first GPS point...</EmptyState>}
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", visibility: center ? "visible" : "hidden" }}
      />
    </div>
  );
}

export default MapPanel;
