// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import produce from "immer";
import {
  Map as LeafMap,
  TileLayer,
  LatLngBounds,
  CircleMarker,
  FeatureGroup,
  LayerGroup,
  geoJSON,
  Layer,
} from "leaflet";
import { difference, groupBy, isEqual, minBy, partition, union } from "lodash";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import { useDebouncedCallback } from "use-debounce";

import { toSec } from "@foxglove/rostime";
import { PanelExtensionContext, MessageEvent, SettingsTreeAction } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";
import FilteredPointLayer, {
  POINT_MARKER_RADIUS,
} from "@foxglove/studio-base/panels/Map/FilteredPointLayer";
import { Topic } from "@foxglove/studio-base/players/types";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";
import { darkColor, lightColor, lineColors } from "@foxglove/studio-base/util/plotColors";

import { Config, validateCustomUrl, buildSettingsTree } from "./config";
import { hasFix } from "./support";
import { MapPanelMessage, Point } from "./types";

type GeoJsonMessage = MessageEvent<FoxgloveMessages["foxglove.GeoJSON"]>;

type MapPanelProps = {
  context: PanelExtensionContext;
};

function isGeoJSONMessage(msgEvent: MessageEvent<unknown>): msgEvent is GeoJsonMessage {
  const datatype = msgEvent.schemaName;
  return (
    datatype === "foxglove_msgs/GeoJSON" ||
    datatype === "foxglove_msgs/msg/GeoJSON" ||
    datatype === "foxglove.GeoJSON"
  );
}

function topicMessageType(topic: Topic) {
  switch (topic.schemaName) {
    case "sensor_msgs/NavSatFix":
    case "sensor_msgs/msg/NavSatFix":
    case "ros.sensor_msgs.NavSatFix":
    case "foxglove_msgs/LocationFix":
    case "foxglove_msgs/msg/LocationFix":
    case "foxglove.LocationFix":
      return "navsat";
    case "foxglove_msgs/GeoJSON":
    case "foxglove_msgs/msg/GeoJSON":
    case "foxglove.GeoJSON":
      return "geojson";
    default:
      return undefined;
  }
}

function MapPanel(props: MapPanelProps): JSX.Element {
  const { context } = props;

  const mapContainerRef = useRef<HTMLDivElement>(ReactNull);

  const [config, setConfig] = useState<Config>(() => {
    const initialConfig = props.context.initialState as Partial<Config>;
    return {
      center: initialConfig.center,
      customTileUrl: initialConfig.customTileUrl ?? "",
      disabledTopics: initialConfig.disabledTopics ?? [],
      followTopic: initialConfig.followTopic ?? "",
      layer: initialConfig.layer ?? "map",
      topicColors: initialConfig.topicColors ?? {},
      zoomLevel: initialConfig.zoomLevel,
    };
  });

  const [tileLayer] = useState(
    new TileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      maxNativeZoom: 18,
      maxZoom: 24,
    }),
  );

  const [satelliteLayer] = useState(
    new TileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxNativeZoom: 18,
        maxZoom: 24,
      },
    ),
  );

  const [customLayer] = useState(
    new TileLayer("https://example.com/{z}/{y}/{x}", {
      attribution: "",
      maxNativeZoom: 18,
      maxZoom: 24,
    }),
  );

  // Panel state management to update our set of messages
  // We use state to trigger a render on the panel
  const [allMapMessages, setAllMapMessages] = useState<MapPanelMessage[]>([]);
  const [currentMapMessages, setCurrentMapMessages] = useState<MapPanelMessage[]>([]);

  const [allGeoMessages, allNavMessages] = useMemo(
    () => partition(allMapMessages, isGeoJSONMessage),
    [allMapMessages],
  );

  const [currentGeoMessages, currentNavMessages] = useMemo(
    () => partition(currentMapMessages, isGeoJSONMessage),
    [currentMapMessages],
  );

  // Panel state management to track the list of available topics
  const [topics, setTopics] = useState<readonly Topic[]>([]);

  // Panel state management to track the current preview time
  const [previewTime, setPreviewTime] = useState<number | undefined>();

  const [currentMap, setCurrentMap] = useState<LeafMap | undefined>(undefined);

  const onResize = useCallback(() => {
    currentMap?.invalidateSize();
  }, [currentMap]);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { ref: sizeRef } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
    onResize,
  });

  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const eligibleTopics = useMemo(() => {
    return topics.filter(topicMessageType).map((topic) => topic.name);
  }, [topics]);

  const settingsActionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action !== "update") {
      return;
    }

    const { path, input, value } = action.payload;

    if (path[0] === "topics" && input === "boolean") {
      const topic = path[1];
      if (topic) {
        setConfig(
          produce((draft) => {
            draft.disabledTopics =
              value === true
                ? difference(draft.disabledTopics, [topic])
                : union(draft.disabledTopics, [topic]);
          }),
        );
      }
    }

    if (path[0] === "topics" && path[2] === "coloring") {
      const topic = path[1];
      if (topic) {
        setConfig(
          produce((draft) => {
            if (value === "Custom") {
              draft.topicColors[topic] = lineColors[0]!;
            } else {
              delete draft.topicColors[topic];
            }
          }),
        );
      }
    }

    if (path[0] === "topics" && path[2] === "color" && input === "rgb" && value != undefined) {
      const topic = path[1];
      if (topic) {
        setConfig(
          produce((draft) => {
            draft.topicColors[topic] = value;
          }),
        );
      }
    }

    if (path[1] === "layer" && input === "select") {
      setConfig((oldConfig) => {
        return { ...oldConfig, layer: String(value) };
      });
    }

    if (path[1] === "customTileUrl" && input === "string") {
      setConfig((oldConfig) => {
        return { ...oldConfig, customTileUrl: String(value) };
      });
    }

    if (path[1] === "followTopic" && input === "select") {
      setConfig((oldConfig) => {
        return { ...oldConfig, followTopic: String(value) };
      });
    }
  }, []);

  useEffect(() => {
    if (config.layer === "map") {
      currentMap?.addLayer(tileLayer);
      currentMap?.removeLayer(satelliteLayer);
      currentMap?.removeLayer(customLayer);
    } else if (config.layer === "satellite") {
      currentMap?.addLayer(satelliteLayer);
      currentMap?.removeLayer(tileLayer);
      currentMap?.removeLayer(customLayer);
    } else if (config.layer === "custom") {
      currentMap?.addLayer(customLayer);
      currentMap?.removeLayer(tileLayer);
      currentMap?.removeLayer(satelliteLayer);
    }
  }, [config.layer, currentMap, customLayer, satelliteLayer, tileLayer]);

  useEffect(() => {
    if (config.layer === "custom") {
      // validate URL to avoid leaflet map placeholder variable error
      // Ignore urls with an error - the settings tree will inform the user that their valid is invalid
      if (validateCustomUrl(config.customTileUrl)) {
        return;
      }

      customLayer.setUrl(config.customTileUrl);
    }
  }, [config.layer, config.customTileUrl, customLayer]);

  // Subscribe to eligible and enabled topics
  useEffect(() => {
    const eligibleEnabled = difference(eligibleTopics, config.disabledTopics);
    context.subscribe(eligibleEnabled);

    const tree = buildSettingsTree(config, eligibleTopics);
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: tree,
    });

    return () => {
      context.unsubscribeAll();
    };
  }, [config, context, eligibleTopics, settingsActionHandler]);

  type TopicGroups = {
    baseColor: string;
    topicGroup: LayerGroup;
    currentFrame: FeatureGroup;
    allFrames: FeatureGroup;
  };

  // topic layers is a map of topic -> two feature groups
  // A feature group for all messages markers, and a feature group for current frame markers
  const topicLayers = useMemo(() => {
    const topicLayerMap = new Map<string, TopicGroups>();
    let i = 0;
    for (const topic of eligibleTopics) {
      const allFrames = new FeatureGroup();
      const currentFrame = new FeatureGroup();
      const topicGroup = new LayerGroup([allFrames, currentFrame]);
      topicLayerMap.set(topic, {
        topicGroup,
        allFrames,
        currentFrame,
        baseColor: config.topicColors[topic] ?? lineColors[i]!,
      });
      i = (i + 1) % lineColors.length;
    }
    return topicLayerMap;
  }, [config.topicColors, eligibleTopics]);

  useLayoutEffect(() => {
    if (!currentMap) {
      return;
    }

    const topicLayerEntries = [...topicLayers.entries()];
    for (const [topic, featureGroups] of topicLayerEntries) {
      // if the topic does not appear in the disabled topics list, add to map so it displays
      if (!config.disabledTopics.includes(topic)) {
        currentMap.addLayer(featureGroups.topicGroup);
      }
    }

    return () => {
      for (const [_topic, featureGroups] of topicLayerEntries) {
        currentMap.removeLayer(featureGroups.topicGroup);
      }
    };
  }, [config.disabledTopics, currentMap, topicLayers]);

  // During the initial mount we setup our context render handler
  useLayoutEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const map = new LeafMap(mapContainerRef.current);

    // the map must be initialized with some view before other features work
    map.setView(
      config.center ? [config.center.lat, config.center.lon] : [0, 0],
      config.zoomLevel ?? 10,
    );

    setCurrentMap(map);

    // tell the context we care about updates on these fields
    context.watch("topics");
    context.watch("currentFrame");
    context.watch("allFrames");
    context.watch("previewTime");

    // The render event handler updates the state for our messages an triggers a component render
    //
    // The panel must call the _done_ function passed to render indicating the render completed.
    // The panel will not receive render calls until it calls done.
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setPreviewTime(renderState.previewTime);

      if (renderState.topics) {
        // Changing the topic list clears all map layers so we try to preserve reference identity
        // if the contents of the topic list haven't changed.
        setTopics((oldTopics) => {
          return isEqual(oldTopics, renderState.topics) ? oldTopics : renderState.topics ?? [];
        });
      }

      if (renderState.allFrames) {
        setAllMapMessages(renderState.allFrames as MapPanelMessage[]);
      }

      // Only update the current frame if we have new messages.
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        setCurrentMapMessages(renderState.currentFrame as MapPanelMessage[]);
      }
    };

    return () => {
      map.remove();
      context.onRender = undefined;
    };
  }, [config.center, config.zoomLevel, context]);

  const onHover = useCallback(
    (messageEvent?: MessageEvent<unknown>) => {
      context.setPreviewTime(
        messageEvent == undefined ? undefined : toSec(messageEvent.receiveTime),
      );
    },
    [context],
  );

  const onClick = useCallback(
    (messageEvent: MessageEvent<unknown>) => {
      context.seekPlayback?.(toSec(messageEvent.receiveTime));
    },
    [context],
  );

  /// --- the remaining code is unrelated to the extension api ----- ///

  const [center, setCenter] = useState<Point | undefined>(config.center);
  const [filterBounds, setFilterBounds] = useState<LatLngBounds | undefined>();

  const addGeoFeatureEventHandlers = useCallback(
    (message: MessageEvent<unknown>, layer: Layer) => {
      layer.on("mouseover", () => {
        onHover(message);
      });
      layer.on("mouseout", () => {
        onHover(undefined);
      });
      layer.on("click", () => {
        onClick(message);
      });
    },
    [onClick, onHover],
  );

  const addGeoJsonMessage = useCallback(
    (message: GeoJsonMessage, group: FeatureGroup) => {
      const parsed = JSON.parse(message.message.geojson) as Parameters<typeof geoJSON>[0];
      geoJSON(parsed, {
        onEachFeature: (_feature, layer) => addGeoFeatureEventHandlers(message, layer),
        style: config.topicColors[message.topic]
          ? { color: config.topicColors[message.topic] }
          : {},
      }).addTo(group);
    },
    [addGeoFeatureEventHandlers, config.topicColors],
  );

  // calculate center point from blocks if we don't have a center point
  useEffect(() => {
    setCenter((old) => {
      if (!config.followTopic) {
        // When not following a topic center the map from the first message at startup
        if (old) {
          return old;
        }
      }

      for (const messages of [currentNavMessages, allNavMessages]) {
        for (const message of messages) {
          // When re-centering to follow topic, only use the messages of the matching topic
          if (config.followTopic && old) {
            if (message.topic !== config.followTopic) {
              continue;
            }
          }
          return {
            lat: message.message.latitude,
            lon: message.message.longitude,
          };
        }
      }

      return;
    });
  }, [allNavMessages, currentNavMessages, config]);

  useEffect(() => {
    if (!currentMap) {
      return;
    }

    for (const [topic, topicLayer] of topicLayers) {
      topicLayer.allFrames.clearLayers();

      const navMessages = allNavMessages.filter((message) => message.topic === topic);
      const pointLayer = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: navMessages,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: lightColor(topicLayer.baseColor),
        hoverColor: darkColor(topicLayer.baseColor),
        onHover,
        onClick,
      });

      topicLayer.allFrames.addLayer(pointLayer);

      allGeoMessages
        .filter((message) => message.topic === topic)
        .forEach((message) => addGeoJsonMessage(message, topicLayer.allFrames));
    }
  }, [
    addGeoJsonMessage,
    allGeoMessages,
    allNavMessages,
    currentMap,
    filterBounds,
    onClick,
    onHover,
    topicLayers,
  ]);

  // create a filtered marker layer for the current nav messages
  // this effect is added after the allNavMessages so the layer appears above
  useEffect(() => {
    if (!currentMap) {
      return;
    }

    const navByTopic = groupBy(currentNavMessages, (msg) => msg.topic);
    for (const [topic, messages] of Object.entries(navByTopic)) {
      const topicLayer = topicLayers.get(topic);
      if (!topicLayer) {
        continue;
      }

      topicLayer.currentFrame.clearLayers();
      const [fixEvents, noFixEvents] = partition(messages, hasFix);

      const pointLayerNoFix = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: noFixEvents,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: darkColor(topicLayer.baseColor),
        hoverColor: darkColor(topicLayer.baseColor),
        showAccuracy: true,
      });

      const pointLayerFix = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: fixEvents,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: topicLayer.baseColor,
        hoverColor: darkColor(topicLayer.baseColor),
        showAccuracy: true,
      });

      topicLayer.currentFrame.addLayer(pointLayerNoFix);
      topicLayer.currentFrame.addLayer(pointLayerFix);
    }

    const geoByTopic = groupBy(currentGeoMessages, (msg) => msg.topic);
    for (const [topic, messages] of Object.entries(geoByTopic)) {
      const topicLayer = topicLayers.get(topic);
      if (topicLayer) {
        topicLayer.currentFrame.clearLayers();
        for (const message of messages) {
          addGeoJsonMessage(message, topicLayer.currentFrame);
        }
      }
    }
  }, [
    addGeoJsonMessage,
    currentGeoMessages,
    currentMap,
    currentNavMessages,
    filterBounds,
    topicLayers,
  ]);

  // create a marker for the closest gps message to our current preview time
  useEffect(() => {
    if (!currentMap || previewTime == undefined) {
      return;
    }

    // get the point occuring most recently before preview time but not after preview time
    const prevNavMessages = allNavMessages.filter(
      (message) => toSec(message.receiveTime) < previewTime,
    );
    const event = minBy(prevNavMessages, (message) => previewTime - toSec(message.receiveTime));
    if (!event) {
      return;
    }

    const topicLayer = topicLayers.get(event.topic);

    const marker = new CircleMarker([event.message.latitude, event.message.longitude], {
      radius: POINT_MARKER_RADIUS,
      color: topicLayer ? darkColor(topicLayer.baseColor) : undefined,
      stroke: false,
      fillOpacity: 1,
      interactive: false,
    });

    marker.addTo(currentMap);
    return () => {
      marker.remove();
    };
  }, [allNavMessages, currentMap, previewTime, topicLayers]);

  // persist panel config on zoom changes
  useEffect(() => {
    if (!currentMap) {
      return;
    }

    const moveChange = () => {
      context.saveState({
        center: { lat: currentMap.getCenter().lat, lon: currentMap.getCenter().lng },
      });
    };

    const zoomChange = () => {
      context.saveState({ zoomLevel: currentMap.getZoom() });
    };

    currentMap.on("move", moveChange);
    currentMap.on("zoom", zoomChange);
    return () => {
      currentMap.off("move", moveChange);
      currentMap.off("zoom", zoomChange);
    };
  }, [context, currentMap]);

  useEffect(() => {
    context.saveState(config);
  }, [context, config]);

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

  // Update the map view to focus on the centerpoint when it changes
  // Zoom is reset only once
  const didResetZoomRef = useRef(false);
  useEffect(() => {
    if (!center) {
      return;
    }

    // If center updates when following a topic we don't want to keep resetting the zoom.
    const zoom = didResetZoomRef.current ? currentMap?.getZoom() : config.zoomLevel ?? 10;
    currentMap?.setView([center.lat, center.lon], zoom);
    didResetZoomRef.current = true;
  }, [center, config.zoomLevel, currentMap]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <Stack ref={sizeRef} fullHeight fullWidth position="relative">
      {!center && (
        <Stack
          alignItems="center"
          justifyContent="center"
          position="absolute"
          style={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          Waiting for first GPS point...
        </Stack>
      )}
      <Stack
        position="absolute"
        ref={mapContainerRef}
        style={{
          inset: 0,
          cursor: "auto",
          visibility: center ? "visible" : "hidden",
        }}
      />
    </Stack>
  );
}

export default MapPanel;
