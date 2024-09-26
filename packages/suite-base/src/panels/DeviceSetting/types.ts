// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type Codes = {
  i: number;
};
export type DeviceSetting = {
  mqttHost: string;
  port: number;
  save: boolean;
};

export enum LightState {
  RED = 1,
  YELLOW = 3,
  GREEN = 2,
}

export interface Light {
  id: number;
  time: number;
  state: LightState;
  redTime: number;
  greenTime: number;
  yellowTime: number;
}

export interface Device {
  id: number;
  type: string;
  error: string;
  state: string;
}
