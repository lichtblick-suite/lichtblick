// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryContext, StoryObj } from "@storybook/react";
import { userEvent } from "@storybook/testing-library";
import { cloneDeep, tap } from "lodash";
import { useState } from "react";
import { useTimeoutFn } from "react-use";

import {
  NavSatFixMsg,
  NavSatFixPositionCovarianceType,
  NavSatFixService,
  NavSatFixStatus,
} from "@foxglove/studio-base/panels/Map/types";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

import MapPanel from "./index";

const EMPTY_MESSAGE: NavSatFixMsg = {
  latitude: 0,
  longitude: 0,
  altitude: 0,
  status: { status: NavSatFixStatus.STATUS_FIX, service: NavSatFixService.SERVICE_GPS },
  position_covariance: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_UNKNOWN,
};
const OFFSET_MESSAGE = tap(cloneDeep(EMPTY_MESSAGE), (message) => {
  message.latitude += 0.1;
  message.longitude += 0.1;
});

function makeGeoJsonMessage(center: { lat: number; lon: number }) {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [center.lon, center.lat],
            [0.1 + center.lon, center.lat],
            [0.1 + center.lon, 0.1 + center.lat],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Named Polygon",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [center.lon - 0.1, center.lat - 0.1],
              [center.lon + 0.2, center.lat - 0.1],
              [center.lon + 0.2, center.lat],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: {
          name: "Named Point",
          "marker-color": "#7f7e7e",
          "marker-size": "medium",
          "marker-symbol": "1",
        },
        geometry: {
          type: "Point",
          coordinates: [center.lon - 0.1, center.lat + 0.1],
        },
      },
    ],
  };
}

const Wrapper = (StoryComponent: StoryFn, { parameters }: StoryContext): JSX.Element => {
  return (
    <PanelSetup
      fixture={parameters.panelSetup?.fixture}
      includeSettings={parameters.includeSettings}
    >
      <StoryComponent />
    </PanelSetup>
  );
};

export default {
  title: "panels/Map",
  component: MapPanel,
};

export const EmptyState: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],
};

export const SinglePoint: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],

  parameters: {
    chromatic: {
      delay: 1000,
    },
    panelSetup: {
      fixture: {
        topics: [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }],
        frame: {
          "/gps": [
            {
              topic: "/gps",
              schemaName: "sensor_msgs/NavSatFix",
              sizeInBytes: 0,
              receiveTime: { sec: 123, nsec: 456 },
              message: EMPTY_MESSAGE,
            },
          ],
        },
      } as Fixture,
    },
  },
};

export const SinglePointWithMissingValues: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],

  parameters: {
    chromatic: {
      delay: 1000,
    },
    panelSetup: {
      fixture: {
        topics: [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }],
        frame: {
          "/gps": [
            {
              topic: "/gps",
              schemaName: "sensor_msgs/NavSatFix",
              sizeInBytes: 0,
              receiveTime: { sec: 123, nsec: 456 },
              message: {
                ...EMPTY_MESSAGE,
                latitude: undefined,
                longitude: undefined,
              },
            },
          ],
        },
      } as Fixture,
    },
  },
};

export const SinglePointWithNoFix: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],

  parameters: {
    chromatic: {
      delay: 1000,
    },
    panelSetup: {
      fixture: {
        topics: [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }],
        frame: {
          "/gps": [
            {
              topic: "/gps",
              schemaName: "sensor_msgs/NavSatFix",
              sizeInBytes: 0,
              receiveTime: { sec: 123, nsec: 456 },
              message: {
                ...EMPTY_MESSAGE,
                status: {
                  status: NavSatFixStatus.STATUS_NO_FIX,
                  service: NavSatFixService.SERVICE_GPS,
                },
              },
            },
          ],
        },
      } as Fixture,
    },
  },
};

export const SinglePointWithSettings: StoryObj = {
  render: function Story() {
    return <MapPanel overrideConfig={{ layer: "custom" }} />;
  },

  decorators: [Wrapper],

  parameters: {
    ...SinglePoint.parameters,
    includeSettings: true,
  },
};

export const SinglePointWithSettingsOverride: StoryObj = {
  render: function Story() {
    return <MapPanel overrideConfig={{ layer: "custom", topicColors: { "/gps": "#ffc0cb" } }} />;
  },

  decorators: [Wrapper],

  parameters: {
    ...SinglePoint.parameters,
    includeSettings: true,
  },
};

export const MultipleTopics: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],

  parameters: {
    chromatic: {
      delay: 1000,
    },
    decorators: [Wrapper],
    panelSetup: {
      fixture: {
        topics: [
          { name: "/gps", schemaName: "sensor_msgs/NavSatFix" },
          { name: "/another-gps-topic", schemaName: "sensor_msgs/NavSatFix" },
        ],
        frame: {
          "/gps": [
            {
              topic: "/gps",
              schemaName: "sensor_msgs/NavSatFix",
              sizeInBytes: 0,
              receiveTime: { sec: 123, nsec: 456 },
              message: EMPTY_MESSAGE,
            },
          ],
          "/another-gps-topic": [
            {
              topic: "/another-gps-topic",
              schemaName: "sensor_msgs/NavSatFix",
              sizeInBytes: 0,
              receiveTime: { sec: 123, nsec: 456 },
              message: OFFSET_MESSAGE,
            },
          ],
        },
      } as Fixture,
    },
  },
};

export const SinglePointNoFix: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],

  parameters: {
    chromatic: {
      delay: 1000,
    },
    decorators: [Wrapper],
    panelSetup: {
      fixture: {
        topics: [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }],
        frame: {
          "/gps": [
            {
              topic: "/gps",
              schemaName: "sensor_msgs/NavSatFix",
              sizeInBytes: 0,
              receiveTime: { sec: 123, nsec: 456 },
              message: {
                latitude: 0,
                longitude: 0,
                altitude: 0,
                status: {
                  status: NavSatFixStatus.STATUS_NO_FIX,
                  service: NavSatFixService.SERVICE_GPS,
                },
                position_covariance: [1, 0, 0, 0, 1, 0, 0, 0, 1],
                position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_UNKNOWN,
              },
            },
          ],
        },
      } as Fixture,
    },
  },
};

export const SinglePointDiagonalCovariance: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],

  parameters: {
    chromatic: {
      delay: 1000,
    },
    decorators: [Wrapper],
    panelSetup: {
      fixture: {
        topics: [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }],
        frame: {
          "/gps": [
            {
              topic: "/gps",
              schemaName: "sensor_msgs/NavSatFix",
              sizeInBytes: 0,
              receiveTime: { sec: 123, nsec: 456 },
              message: {
                latitude: 1,
                longitude: 2,
                altitude: 0,
                status: {
                  status: NavSatFixStatus.STATUS_FIX,
                  service: NavSatFixService.SERVICE_GPS,
                },
                position_covariance: [1, 0, 0, 0, 5000000, 0, 0, 0, 1000000000],
                position_covariance_type:
                  NavSatFixPositionCovarianceType.COVARIANCE_TYPE_DIAGONAL_KNOWN,
              },
            },
          ],
        },
      } as Fixture,
    },
  },
};

export const SinglePointFullCovariance: StoryObj = {
  render: function Story() {
    return <MapPanel />;
  },

  decorators: [Wrapper],

  parameters: {
    chromatic: {
      delay: 1000,
    },
    decorators: [Wrapper],
    panelSetup: {
      fixture: {
        topics: [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }],
        frame: {
          "/gps": [
            {
              topic: "/gps",
              receiveTime: { sec: 123, nsec: 456 },
              sizeInBytes: 0,
              schemaName: "sensor_msgs/NavSatFix",
              message: {
                latitude: 1,
                longitude: 2,
                altitude: 0,
                status: {
                  status: NavSatFixStatus.STATUS_GBAS_FIX,
                  service: NavSatFixService.SERVICE_GPS,
                },
                position_covariance: [1, 2, 3, 2, 5000000, 6, 3, 6, 1000000000],
                position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_KNOWN,
              },
            },
          ],
        },
      } as Fixture,
    },
  },
};

const GeoCenter = { lat: 0.25, lon: 0.25 };

export const GeoJSON: StoryObj = {
  render: function Story() {
    const topics: Topic[] = [
      { name: "/geo", schemaName: "foxglove.GeoJSON" },
      { name: "/geo2", schemaName: "foxglove.GeoJSON" },
      { name: "/gps", schemaName: "sensor_msgs/NavSatFix" },
    ];

    const [fixture, setFixture] = useState<Fixture>({
      topics,
      frame: {
        "/gps": [
          {
            topic: "/gps",
            receiveTime: { sec: 123, nsec: 456 },
            schemaName: "sensor_msgs/NavSatFix",
            message: EMPTY_MESSAGE,
            sizeInBytes: 10,
          },
        ],
        "/geo": [
          {
            topic: "/geo",
            receiveTime: { sec: 123, nsec: 0 },
            schemaName: "foxglove.GeoJSON",
            message: {
              geojson: JSON.stringify(
                makeGeoJsonMessage({ lat: GeoCenter.lat - 0.2, lon: GeoCenter.lon - 0.2 }),
              ),
            },
            sizeInBytes: 10,
          },
        ],
        "/geo2": [
          {
            topic: "/geo2",
            receiveTime: { sec: 123, nsec: 0 },
            schemaName: "foxglove.GeoJSON",
            message: {
              geojson: JSON.stringify(
                makeGeoJsonMessage({ lat: GeoCenter.lat - 0.1, lon: GeoCenter.lon - 0.1 }),
              ),
            },
            sizeInBytes: 10,
          },
        ],
      },
    });

    // Send a second messaqge on /geo topic. This should replace the previous message but not
    // the /geo2 message.
    useTimeoutFn(() => {
      setFixture({
        topics,
        frame: {
          "/geo": [
            {
              topic: "/geo",
              receiveTime: { sec: 130, nsec: 0 },
              schemaName: "foxglove.GeoJSON",
              message: {
                geojson: JSON.stringify(
                  makeGeoJsonMessage({ lat: GeoCenter.lat + 0.2, lon: GeoCenter.lon + 0.1 }),
                ),
              },
              sizeInBytes: 10,
            },
          ],
        },
      });
    }, 1000);

    return (
      <PanelSetup fixture={fixture} includeSettings>
        <MapPanel
          overrideConfig={{
            topicColors: { "/geo": "#00ffaa", "/geo2": "#aa00ff" },
            center: GeoCenter,
          }}
        />
      </PanelSetup>
    );
  },

  parameters: {
    chromatic: {
      delay: 2000,
    },
    colorScheme: "light",
  },

  play: async () => {
    const followSelect = document.querySelectorAll("div[role=button][aria-haspopup=listbox]")[1];
    if (followSelect) {
      userEvent.click(followSelect);
    }
  },
};
