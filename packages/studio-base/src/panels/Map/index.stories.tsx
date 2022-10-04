// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story, StoryContext } from "@storybook/react";

import {
  NavSatFixMsg,
  NavSatFixPositionCovarianceType,
  NavSatFixService,
  NavSatFixStatus,
} from "@foxglove/studio-base/panels/Map/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import MapPanel from "./index";

const EMPTY_MESSAGE: NavSatFixMsg = {
  latitude: 0,
  longitude: 0,
  altitude: 0,
  status: { status: NavSatFixStatus.STATUS_FIX, service: NavSatFixService.SERVICE_GPS },
  position_covariance: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  position_covariance_type: NavSatFixPositionCovarianceType.COVARIANCE_TYPE_UNKNOWN,
};
const OFFSET_MESSAGE = JSON.parse(JSON.stringify(EMPTY_MESSAGE) ?? "") as NavSatFixMsg;
OFFSET_MESSAGE.latitude += 0.1;
OFFSET_MESSAGE.longitude += 0.1;

const GeoJsonContent = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [2.42477416992186, 1.801374964252865],
          [2.42082595825194, 1.7846897817763],
          [2.4422836303711, 1.78292608704408],
        ],
      },
    },
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [2.44314193725585, 1.77342854582093],
            [2.43953704833984, 1.76596533600783],
            [2.4264907836914, 1.7694934927041],
            [2.42700576782227, 1.77817746896081],
            [2.44314193725585, 1.77342854582093],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: {
        "marker-color": "#7e7e7e",
        "marker-size": "medium",
        "marker-symbol": "1",
      },
      geometry: {
        type: "Point",
        coordinates: [2.43284225463867, 1.78943798147498],
      },
    },
  ],
});

export default {
  title: "panels/Map",
  component: MapPanel,
  decorators: [
    (StoryComponent: Story, { parameters }: StoryContext): JSX.Element => {
      return (
        <PanelSetup
          fixture={parameters.panelSetup?.fixture}
          includeSettings={parameters.includeSettings}
        >
          <StoryComponent />
        </PanelSetup>
      );
    },
  ],
};

export const EmptyState = (): JSX.Element => {
  return <MapPanel />;
};

export const SinglePoint = (): JSX.Element => {
  return <MapPanel />;
};

SinglePoint.parameters = {
  chromatic: {
    delay: 1000,
  },
  panelSetup: {
    fixture: {
      topics: [{ name: "/gps", datatype: "sensor_msgs/NavSatFix" }],
      frame: {
        "/gps": [
          {
            topic: "/gps",
            receiveTime: { sec: 123, nsec: 456 },
            message: EMPTY_MESSAGE,
          },
        ],
      },
    },
  },
};

export const SinglePointWithSettings = (): JSX.Element => {
  return <MapPanel overrideConfig={{ layer: "custom" }} />;
};
SinglePointWithSettings.parameters = {
  ...SinglePoint.parameters,
  includeSettings: true,
};

export const SinglePointWithSettingsOverride = (): JSX.Element => {
  return <MapPanel overrideConfig={{ layer: "custom", topicColors: { "/gps": "#ffc0cb" } }} />;
};
SinglePointWithSettingsOverride.parameters = {
  ...SinglePoint.parameters,
  includeSettings: true,
};

export const MultipleTopics = (): JSX.Element => {
  return <MapPanel />;
};

MultipleTopics.parameters = {
  chromatic: {
    delay: 1000,
  },
  panelSetup: {
    fixture: {
      topics: [
        { name: "/gps", datatype: "sensor_msgs/NavSatFix" },
        { name: "/another-gps-topic", datatype: "sensor_msgs/NavSatFix" },
      ],
      frame: {
        "/gps": [
          {
            topic: "/gps",
            receiveTime: { sec: 123, nsec: 456 },
            message: EMPTY_MESSAGE,
          },
        ],
        "/another-gps-topic": [
          {
            topic: "/another-gps-topic",
            receiveTime: { sec: 123, nsec: 456 },
            message: OFFSET_MESSAGE,
          },
        ],
      },
    },
  },
};

export const SinglePointNoFix = (): JSX.Element => {
  return <MapPanel />;
};

SinglePointNoFix.parameters = {
  chromatic: {
    delay: 1000,
  },
  panelSetup: {
    fixture: {
      topics: [{ name: "/gps", datatype: "sensor_msgs/NavSatFix" }],
      frame: {
        "/gps": [
          {
            topic: "/gps",
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
    },
  },
};

export const SinglePointDiagonalCovariance = (): JSX.Element => {
  return <MapPanel />;
};

SinglePointDiagonalCovariance.parameters = {
  chromatic: {
    delay: 1000,
  },
  panelSetup: {
    fixture: {
      topics: [{ name: "/gps", datatype: "sensor_msgs/NavSatFix" }],
      frame: {
        "/gps": [
          {
            topic: "/gps",
            receiveTime: { sec: 123, nsec: 456 },
            message: {
              latitude: 1,
              longitude: 2,
              altitude: 0,
              status: { status: NavSatFixStatus.STATUS_FIX, service: NavSatFixService.SERVICE_GPS },
              position_covariance: [1, 0, 0, 0, 5000000, 0, 0, 0, 1000000000],
              position_covariance_type:
                NavSatFixPositionCovarianceType.COVARIANCE_TYPE_DIAGONAL_KNOWN,
            },
          },
        ],
      },
    },
  },
};

export const SinglePointFullCovariance = (): JSX.Element => {
  return <MapPanel />;
};

SinglePointFullCovariance.parameters = {
  chromatic: {
    delay: 1000,
  },
  panelSetup: {
    fixture: {
      topics: [{ name: "/gps", datatype: "sensor_msgs/NavSatFix" }],
      frame: {
        "/gps": [
          {
            topic: "/gps",
            receiveTime: { sec: 123, nsec: 456 },
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
    },
  },
};

export const GeoJSON = (): JSX.Element => {
  return <MapPanel overrideConfig={{ topicColors: { "/geo": "#00ffaa", "/gps": "#ffc0cb" } }} />;
};
GeoJSON.parameters = {
  chromatic: {
    delay: 1000,
  },
  panelSetup: {
    fixture: {
      topics: [
        { name: "/gps", datatype: "sensor_msgs/NavSatFix" },
        { name: "/geo", datatype: "foxglove.GeoJSON" },
      ],
      frame: {
        "/gps": [
          {
            topic: "/gps",
            receiveTime: { sec: 123, nsec: 456 },
            datatype: "sensor_msgs/NavSatFix",
            message: {
              latitude: 1.801374964252865,
              longitude: 2.42477416992186,
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
        "/geo": [
          {
            topic: "/geo",
            receiveTime: { sec: 123, nsec: 456 },
            datatype: "foxglove.GeoJSON",
            message: {
              geojson: GeoJsonContent,
            },
          },
        ],
      },
    },
  },
};
