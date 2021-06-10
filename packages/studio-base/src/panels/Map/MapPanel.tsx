// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Map as LeafMap } from "leaflet";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";

import { PanelExtensionContext, MessageEvent } from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { Topic } from "@foxglove/studio-base/players/types";

import FilteredPointMarkers from "./FilteredPointMarkers";
import { NavSatFixMsg, Point } from "./types";

// Persisted panel state
type Config = {
  zoomLevel?: number;
};

type MapPanelProps = {
  context: PanelExtensionContext;
};

function MapPanel(props: MapPanelProps): JSX.Element {
  const { context } = props;

  const [config] = useState<Config>(props.context.initialState as Config);

  // Panel state management to update our set of messages
  // We use state to trigger a render on the panel
  const [navMessages, setNavMessages] = useState<readonly MessageEvent<unknown>[]>([]);
  const [allNavMessages, setAllNavMessages] = useState<readonly MessageEvent<unknown>[]>([]);

  // Panel state management to track the list of available topics
  const [topics, setTopics] = useState<readonly Topic[]>([]);

  // Subscribe to relevant topics
  useEffect(() => {
    // The map only supports sensor_msgs/NavSatFix
    const eligibleTopics = topics
      .filter((topic) => topic.datatype === "sensor_msgs/NavSatFix")
      .map((topic) => topic.name);

    context.subscribe(eligibleTopics);

    return () => {
      context.unsubscribeAll();
    };
  }, [context, topics]);

  // The panel must indicate when it has finished rendering from a "render" call
  // Here we track this callback in a ref and invoke it within the render function as an example
  // For components that render off-screen or have delayed rendering, they would invoke this once
  // they have rendered the latest set of messages or updates.
  const doneRenderRef = useRef<(() => void) | undefined>(undefined);

  // During the initial mount we setup our context render handler
  useLayoutEffect(() => {
    // tell the context we care about updates on these fields
    context.watch("topics");
    context.watch("currentFrame");
    context.watch("allFrames");

    // The render event handler updates the state for our messages an triggers a component render
    //
    // The panel must call the _done_ function passed to render indicating the render completed.
    // The panel will not receive render calls until it calls done.
    context.onRender = (renderState, done) => {
      doneRenderRef.current = done;

      if (renderState.topics) {
        setTopics(renderState.topics);
      }

      if (renderState.currentFrame) {
        setNavMessages(renderState.currentFrame);
      }

      if (renderState.allFrames) {
        setAllNavMessages(renderState.allFrames);
      }
    };

    // Remove any subscriptions if the effect happens to change
    return () => {
      context.onRender = undefined;
    };
  }, [context]);

  // Trigger the done callback from the render event handler if we are rendering as a result of a
  // panel context render event.
  // This is done in an effect to indicate render is done after painting
  useEffect(() => {
    doneRenderRef.current?.();
    doneRenderRef.current = undefined;
  });

  /// --- the remaining code is unrelated to the extension api ----- ///

  const [center, setCenter] = useState<Point | undefined>();

  // calculate center point from blocks if we don't have a center point
  useEffect(() => {
    setCenter((old) => {
      // set center only once
      if (old) {
        return old;
      }

      for (const messageEvent of allNavMessages) {
        const lat = (messageEvent.message as NavSatFixMsg).latitude;
        const lon = (messageEvent.message as NavSatFixMsg).longitude;
        const point: Point = {
          lat,
          lon,
        };

        return point;
      }

      return;
    });
  }, [allNavMessages]);

  // calculate center point from streaming messages if we don't have a center point
  useEffect(() => {
    setCenter((old) => {
      // set center only once
      if (old) {
        return old;
      }

      for (const messageEvent of navMessages) {
        const point: Point = {
          lat: (messageEvent.message as NavSatFixMsg).latitude,
          lon: (messageEvent.message as NavSatFixMsg).longitude,
        };

        return point;
      }

      return;
    });
  }, [navMessages]);

  const [currentMap, setCurrentMap] = useState<LeafMap | undefined>(undefined);

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

  if (!center) {
    return <EmptyState>Waiting for first gps point...</EmptyState>;
  }

  return (
    <MapContainer
      whenCreated={setCurrentMap}
      preferCanvas
      style={{ width: "100%", height: "100%" }}
      center={[center.lat, center.lon]}
      zoom={config.zoomLevel ?? 10}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxNativeZoom={18}
        maxZoom={24}
      />
      <FilteredPointMarkers allPoints={allNavMessages} currentPoints={navMessages} />
    </MapContainer>
  );
}

export default MapPanel;
