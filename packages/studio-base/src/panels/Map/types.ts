// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Point = {
  lat: number;
  lon: number;
};

// https://docs.ros.org/en/api/sensor_msgs/html/msg/NavSatFix.html

export type NavSatFixMsg = {
  latitude: number;
  longitude: number;
};
