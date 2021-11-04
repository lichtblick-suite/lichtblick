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
const OFFSET_MESSAGE = JSON.parse(JSON.stringify(EMPTY_MESSAGE)) as NavSatFixMsg;
OFFSET_MESSAGE.latitude += 0.1;
OFFSET_MESSAGE.longitude += 0.1;

export default {
  title: "panels/Map",
  component: MapPanel,
  parameters: { colorScheme: "dark" },
  decorators: [
    (StoryComponent: Story, { parameters }: StoryContext): JSX.Element => {
      return (
        <PanelSetup fixture={parameters.panelSetup?.fixture}>
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
