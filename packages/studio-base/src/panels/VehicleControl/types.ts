// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Codes = {
  i: number;
};
export type VehicleControlConfig = {
  car_id: number;
  lights: boolean;
  rain: boolean;
  run: boolean;
  pass_mode: boolean;
  nodeTopicName: string;
  nodeDatatype: string;
  runTopicName: string;
  runDatatype: string;
  rfidSource: string;
  pathSource: string;
};
