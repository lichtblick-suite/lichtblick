// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Feature } from "geojson";
import { produce } from "immer";
import {
  CircleMarker,
  FeatureGroup,
  geoJSON,
  LatLngBounds,
  Layer,
  LayerGroup,
  Map as LeafMap,
  TileLayer,
} from "leaflet";
import * as _ from "lodash-es";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import { makeStyles } from "tss-react/mui";
import { useDebouncedCallback } from "use-debounce";

import { filterMap } from "@lichtblick/den/collection";
import { toSec } from "@lichtblick/rostime";
import {
  MessageEvent,
  PanelExtensionContext,
  SettingsTreeAction,
  Subscription,
  Topic,
} from "@lichtblick/suite";
import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import Stack from "@lichtblick/suite-base/components/Stack";
import FilteredPointLayer from "@lichtblick/suite-base/panels/Map/FilteredPointLayer";
import { MapRotationOverlay } from "@lichtblick/suite-base/panels/Map/MapRotationOverlay";
import { POINT_MARKER_RADIUS } from "@lichtblick/suite-base/panels/Map/constants";
import { getHeadingFromTrack, precedingTrack } from "@lichtblick/suite-base/panels/Map/getHeading";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { darkColor, lightColor, lineColors } from "@lichtblick/suite-base/util/plotColors";

import { buildSettingsTree, Config, validateCustomUrl } from "./config";
import {
  GeoJsonMessage,
  hasFix,
  isGeoJSONMessage,
  isSupportedSchema,
  isValidMapMessage,
  parseGeoJSON,
} from "./support";
import { MapMarkerStyle, MapPanelMessage, Point } from "./types";

type MapPanelProps = {
  context: PanelExtensionContext;
};

const useStyles = makeStyles()({
  // While the map is turned, its controls must not be. Leaflet's control container is
  // pinned back over the panel rectangle and turned the other way. It shares a centre with
  // the oversized square, so undoing the rotation lands it exactly on the panel again. That
  // keeps the zoom buttons and the tile layer's own attribution upright, on screen and in
  // their normal styling, rather than being carried off with the tiles.
  rotatedControls: {
    "& .leaflet-control-container": {
      position: "absolute",
      top: "calc((100% - var(--map-panel-height)) / 2)",
      left: "calc((100% - var(--map-panel-width)) / 2)",
      width: "var(--map-panel-width)",
      height: "var(--map-panel-height)",
      transform: "rotate(var(--map-heading))",
      transformOrigin: "center center",
      // The transform makes this a stacking context, so the z-index Leaflet puts on the
      // controls inside it no longer lifts them above the tile panes. Without this they
      // are positioned correctly but painted underneath the map.
      zIndex: 1000,
    },
  },
});

function MapPanel(props: MapPanelProps): React.JSX.Element {
  const { context } = props;
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");

  const mapContainerRef = useRef<HTMLDivElement>(ReactNull);
  const { classes, cx } = useStyles();

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
      maxNativeZoom: initialConfig.maxNativeZoom ?? 18,
      markerStyle: initialConfig.markerStyle ?? "dot",
      markerColor: initialConfig.markerColor,
      rotateWithHeading: initialConfig.rotateWithHeading ?? false,
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
    () => _.partition(allMapMessages, isGeoJSONMessage),
    [allMapMessages],
  );

  const [currentGeoMessages, currentNavMessages] = useMemo(
    () => _.partition(currentMapMessages, isGeoJSONMessage),
    [currentMapMessages],
  );

  // Panel state management to track the list of available topics
  const [topics, setTopics] = useState<readonly Topic[]>([]);

  // Panel state management to track the current preview time
  const [previewTime, setPreviewTime] = useState<number | undefined>();

  const [currentMap, setCurrentMap] = useState<LeafMap | undefined>(undefined);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    width: panelWidth,
    height: panelHeight,
    ref: sizeRef,
  } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  useEffect(() => {
    // We depend on changes in the resized panel dimensions to tell the Leaflet map to
    // recalculate its size. We do this inside a separate useEffect instead of directly
    // in the map's change callbacks to avoid a react error from calling setState
    // during a render.
    void { panelWidth, panelHeight };
    currentMap?.invalidateSize();
  }, [panelWidth, panelHeight, currentMap, config.rotateWithHeading, config.followTopic]);

  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const eligibleTopics = useMemo(() => {
    return filterMap(topics, (topic) => {
      if (isSupportedSchema(topic.schemaName)) {
        return topic;
      }

      if (topic.convertibleTo) {
        for (const schemaName of topic.convertibleTo) {
          if (isSupportedSchema(schemaName)) {
            return { name: topic.name, schemaName };
          }
        }
      }
      return undefined;
    });
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
                ? _.difference(draft.disabledTopics, [topic])
                : _.union(draft.disabledTopics, [topic]);
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

    if (path[1] === "maxNativeZoom" && input === "select") {
      setConfig((oldConfig) => {
        const zoom = parseInt(String(value));
        return { ...oldConfig, maxNativeZoom: isFinite(zoom) ? zoom : oldConfig.maxNativeZoom };
      });
    }

    if (path[1] === "followTopic" && input === "select") {
      setConfig((oldConfig) => {
        return { ...oldConfig, followTopic: String(value) };
      });
    }

    if (path[1] === "markerStyle" && input === "select") {
      setConfig((oldConfig) => {
        return { ...oldConfig, markerStyle: value as MapMarkerStyle };
      });
    }

    if (path[1] === "rotateWithHeading" && input === "boolean") {
      setConfig((oldConfig) => {
        return { ...oldConfig, rotateWithHeading: value === true };
      });
    }

    if (path[1] === "markerColoring" && input === "select") {
      setConfig((oldConfig) => {
        // Absent means automatic, matching how a topic's own colour override is stored.
        return { ...oldConfig, markerColor: value === "Custom" ? lineColors[0] : undefined };
      });
    }

    if (path[1] === "markerColor" && input === "rgb") {
      setConfig((oldConfig) => {
        return { ...oldConfig, markerColor: value };
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

  useEffect(() => {
    if (config.layer === "custom") {
      customLayer.options.maxNativeZoom = config.maxNativeZoom;
    }
  }, [config.layer, config.maxNativeZoom, customLayer]);

  // Subscribe to eligible and enabled topics
  useEffect(() => {
    const subscriptions: Subscription[] = [];
    for (const topic of eligibleTopics) {
      if (config.disabledTopics.includes(topic.name)) {
        continue;
      }

      subscriptions.push({
        topic: topic.name,
        convertTo: topic.schemaName,
        preload: false,
      });
    }

    context.subscribe(subscriptions);

    const tree = buildSettingsTree(config, eligibleTopics);
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: tree,
    });

    return () => {
      context.unsubscribeAll();
    };
  }, [config, context, eligibleTopics, settingsActionHandler]);

  // Subscribe to eligible and enabled topics for range messages
  useLayoutEffect(() => {
    // Clear previous messages when subscriptions change
    setAllMapMessages([]);

    const unsubscriptions: (() => void)[] = [];
    for (const topic of eligibleTopics) {
      if (config.disabledTopics.includes(topic.name)) {
        continue;
      }
      const unsubscribe = context.unstable_subscribeMessageRange({
        topic: topic.name,
        convertTo: topic.schemaName,
        onNewRangeIterator: async (batchIterator) => {
          for await (const messages of batchIterator) {
            const validMessages = messages.filter(isValidMapMessage);
            setAllMapMessages((prev) => [...prev, ...validMessages]);
          }
        },
      });
      unsubscriptions.push(unsubscribe);
    }

    return () => {
      for (const unsubscribe of unsubscriptions) {
        unsubscribe();
      }
    };
  }, [config, context, eligibleTopics]);

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
      topicLayerMap.set(topic.name, {
        topicGroup,
        allFrames,
        currentFrame,
        baseColor: config.topicColors[topic.name] ?? lineColors[i]!,
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

    // Remove default prefix from the attribution control
    map.attributionControl.setPrefix(false);

    // the map must be initialized with some view before other features work
    map.setView(
      config.center ? [config.center.lat, config.center.lon] : [0, 0],
      config.zoomLevel ?? 10,
    );

    setCurrentMap(map);

    // tell the context we care about updates on these fields
    context.watch("topics");
    context.watch("currentFrame");
    context.watch("previewTime");
    context.watch("colorScheme");

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
          return _.isEqual(oldTopics, renderState.topics) ? oldTopics : (renderState.topics ?? []);
        });
      }

      // Only update the current frame if we have new messages.
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        setCurrentMapMessages(renderState.currentFrame.filter(isValidMapMessage));
      }

      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };

    return () => {
      map.remove();
      context.onRender = undefined;
    };
  }, [config.center, config.zoomLevel, context]);

  const onHover = useCallback(
    (messageEvent?: MessageEvent) => {
      context.setPreviewTime(
        messageEvent == undefined ? undefined : toSec(messageEvent.receiveTime),
      );
    },
    [context],
  );

  const onClick = useCallback(
    (messageEvent: MessageEvent) => {
      context.seekPlayback?.(messageEvent.receiveTime);
    },
    [context],
  );

  /// --- the remaining code is unrelated to the extension api ----- ///

  const [center, setCenter] = useState<Point | undefined>(config.center);
  const [filterBounds, setFilterBounds] = useState<LatLngBounds | undefined>();

  const addGeoFeatureEventHandlers = useCallback(
    (feature: Feature, message: MessageEvent, layer: Layer) => {
      const featureName = feature.properties?.name;
      if (typeof featureName === "string" && featureName.length > 0) {
        layer.bindTooltip(featureName);
      }
      layer.on("mouseover", () => {
        onHover(message);
        layer.openTooltip();
      });
      layer.on("mouseout", () => {
        onHover(undefined);
        layer.closeTooltip();
      });
      layer.on("click", () => {
        onClick(message);
      });
    },
    [onClick, onHover],
  );

  const addGeoJsonMessage = useCallback(
    (message: GeoJsonMessage, group: FeatureGroup) => {
      const parsed = parseGeoJSON(message.message.geojson);
      for (const { object, style } of parsed) {
        geoJSON(object, {
          onEachFeature: (feature: Feature, layer) => {
            addGeoFeatureEventHandlers(feature, message, layer);
          },
          style: config.topicColors[message.topic]
            ? { color: config.topicColors[message.topic], ...style }
            : style,
        }).addTo(group);
      }
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

      return old;
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

      // Push this layer to the back so it renders under the current messages.
      pointLayer.bringToBack();

      allGeoMessages
        .filter((message) => message.topic === topic)
        .forEach((message) => {
          addGeoJsonMessage(message, topicLayer.allFrames);
        });
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

    const navByTopic = _.groupBy(currentNavMessages, (msg) => msg.topic);
    for (const [topic, messages] of Object.entries(navByTopic)) {
      const topicLayer = topicLayers.get(topic);
      if (!topicLayer) {
        continue;
      }

      topicLayer.currentFrame.clearLayers();
      const [fixEvents, noFixEvents] = _.partition(messages, hasFix);

      // Preceding fixes on this topic, oldest first, so an oriented marker can be turned to
      // the direction of travel. Only the current frame is oriented: the historical track
      // stays as dots, where hundreds of arrows would be noise rather than information.
      const frameStartSec = _.min(messages.map((message) => toSec(message.receiveTime)));
      const headingTrack = precedingTrack(
        allNavMessages
          .filter((message) => message.topic === topic)
          .map((message) => ({
            timeSec: toSec(message.receiveTime),
            lat: message.message.latitude,
            lon: message.message.longitude,
          })),
        frameStartSec,
      );

      const pointLayerNoFix = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: noFixEvents,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: darkColor(topicLayer.baseColor),
        hoverColor: darkColor(topicLayer.baseColor),
        showAccuracy: true,
        markerStyle: config.markerStyle,
        markerColor: config.markerColor,
        headingTrack,
      });

      const pointLayerFix = FilteredPointLayer({
        map: currentMap,
        navSatMessageEvents: fixEvents,
        bounds: filterBounds ?? currentMap.getBounds(),
        color: topicLayer.baseColor,
        hoverColor: darkColor(topicLayer.baseColor),
        showAccuracy: true,
        markerStyle: config.markerStyle,
        markerColor: config.markerColor,
        headingTrack,
      });

      topicLayer.currentFrame.addLayer(pointLayerNoFix);
      topicLayer.currentFrame.addLayer(pointLayerFix);
    }

    const geoByTopic = _.groupBy(currentGeoMessages, (msg) => msg.topic);
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
    allNavMessages,
    config.markerColor,
    config.markerStyle,
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

    // Find the point occuring most recently before or at preview time but not after
    // preview time.
    const prevNavMessages = allNavMessages.filter(
      (message) => toSec(message.receiveTime) <= previewTime,
    );
    const event = _.minBy(prevNavMessages, (message) => previewTime - toSec(message.receiveTime));
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
    const zoom = didResetZoomRef.current ? currentMap?.getZoom() : (config.zoomLevel ?? 10);
    currentMap?.setView([center.lat, center.lon], zoom);
    didResetZoomRef.current = true;
  }, [center, config.zoomLevel, currentMap]);

  // Heading-up rotation. The bearing is taken from the followed topic's own fixes, by the
  // same derivation the oriented marker uses, so the map and the marker cannot disagree.
  const rotationActive = config.rotateWithHeading === true && config.followTopic !== "";

  const mapHeading = useMemo(() => {
    if (!rotationActive) {
      return undefined;
    }

    const current = _.findLast(
      currentNavMessages,
      (message) => message.topic === config.followTopic,
    );
    if (!current) {
      return undefined;
    }

    const fixes = allNavMessages
      .filter((message) => message.topic === config.followTopic)
      .map((message) => ({
        timeSec: toSec(message.receiveTime),
        lat: message.message.latitude,
        lon: message.message.longitude,
      }));

    return getHeadingFromTrack(
      { lat: current.message.latitude, lon: current.message.longitude },
      precedingTrack(fixes, toSec(current.receiveTime)),
    );
  }, [allNavMessages, config.followTopic, currentNavMessages, rotationActive]);

  // Hold the last usable bearing. A frame with no fix, or one too short to take a bearing
  // from, should leave the map where it is rather than snapping back to north. The topic it
  // came from is held with it, so switching to another topic starts from north rather than
  // inheriting a bearing the new topic never reported. Assigning during render is safe here
  // because it is idempotent: a repeated render under StrictMode writes the same value.
  const lastHeadingRef = useRef<{ topic: string; heading: number }>({ topic: "", heading: 0 });
  if (mapHeading != undefined) {
    lastHeadingRef.current = { topic: config.followTopic, heading: mapHeading };
  }
  const appliedHeading =
    rotationActive && lastHeadingRef.current.topic === config.followTopic
      ? lastHeadingRef.current.heading
      : 0;

  // Turning a rectangle leaves its corners empty, so while rotating the map lives in a
  // centred square whose side is the panel diagonal and the overflow is clipped away.
  const rotatedSide = Math.ceil(Math.hypot(panelWidth ?? 0, panelHeight ?? 0));


  // Pointer positions no longer line up with the turned tiles, so dragging is disabled and
  // wheel zoom is anchored to the centre, which is the followed vehicle. Leaflet reads the
  // zoom option when the wheel actually turns, so setting it is enough. Re-registering the
  // handler instead, by disabling and re-enabling it, tears down and rebuilds listeners on
  // a map instance that React may already have replaced, which crashed the panel.
  useEffect(() => {
    // A map that has been removed keeps its handler objects but loses its panes, and
    // reaching into one is how a torn-down instance gets resurrected mid-teardown.
    if (currentMap?.getPane("mapPane") == undefined) {
      return;
    }

    if (rotationActive) {
      currentMap.dragging.disable();
    } else {
      currentMap.dragging.enable();
    }

    currentMap.options.scrollWheelZoom = rotationActive ? "center" : true;
  }, [currentMap, rotationActive]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack ref={sizeRef} fullHeight fullWidth position="relative" overflow="hidden">
        {!center && <EmptyState>Waiting for first GPS point...</EmptyState>}
        <Stack
          position="absolute"
          ref={mapContainerRef}
          className={cx({ [classes.rotatedControls]: rotationActive })}
          style={{
            ...(rotationActive
              ? ({
                  width: rotatedSide,
                  height: rotatedSide,
                  left: ((panelWidth ?? 0) - rotatedSide) / 2,
                  top: ((panelHeight ?? 0) - rotatedSide) / 2,
                  transform: `rotate(${-appliedHeading}deg)`,
                  transformOrigin: "center center",
                  "--map-heading": `${appliedHeading}deg`,
                  "--map-panel-width": `${panelWidth ?? 0}px`,
                  "--map-panel-height": `${panelHeight ?? 0}px`,
                } as React.CSSProperties)
              : { inset: 0 }),
            cursor: "auto",
            visibility: center ? "visible" : "hidden",
          }}
        />
        {rotationActive && center && <MapRotationOverlay heading={appliedHeading} />}
      </Stack>
    </ThemeProvider>
  );
}

export default MapPanel;
