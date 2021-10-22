// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Point = {
  lat: number;
  lon: number;
};

export type Matrix3x3 = [number, number, number, number, number, number, number, number, number];

// https://docs.ros.org/en/api/sensor_msgs/html/msg/NavSatFix.html

export enum NavSatFixPositionCovarianceType {
  COVARIANCE_TYPE_UNKNOWN = 0,
  COVARIANCE_TYPE_APPROXIMATED = 1,
  COVARIANCE_TYPE_DIAGONAL_KNOWN = 2,
  COVARIANCE_TYPE_KNOWN = 3,
}

export enum NavSatFixStatus {
  STATUS_NO_FIX = -1, // unable to fix position
  STATUS_FIX = 0, // unaugmented fix
  STATUS_SBAS_FIX = 1, // with satellite-based augmentation
  STATUS_GBAS_FIX = 2, // with ground-based augmentation
}

// Bits defining which Global Navigation Satellite System signals were
// used by the receiver.
export enum NavSatFixService {
  SERVICE_GPS = 1,
  SERVICE_GLONASS = 2,
  SERVICE_COMPASS = 4, // includes BeiDou.
  SERVICE_GALILEO = 8,
}

export type NavSatFixMsg = {
  latitude: number;
  longitude: number;
  altitude?: number;
  status: { status: NavSatFixStatus; service: NavSatFixService };
  position_covariance: Matrix3x3;
  position_covariance_type: NavSatFixPositionCovarianceType;
};
