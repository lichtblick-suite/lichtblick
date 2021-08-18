// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type Config = {
  topic?: string;
  publishRate: number;
  upButton: {
    field: string;
    value: number;
  };
  downButton: {
    field: string;
    value: number;
  };
  leftButton: {
    field: string;
    value: number;
  };
  rightButton: {
    field: string;
    value: number;
  };
};
