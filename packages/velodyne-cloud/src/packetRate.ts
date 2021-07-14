// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Model } from "./VelodyneTypes";

export function packetRate(model: Model): number {
  switch (model) {
    case Model.VLP16:
    case Model.VLP16HiRes:
      return 754;
    case Model.VLP32C:
      return 1507;
    case Model.HDL32E:
      return 1808;
    case Model.HDL64E:
      return 2600;
    case Model.HDL64E_S21:
      // generates 1333312 points per second
      // 1 packet holds 384 points
      return 1333312 / 384;
    case Model.HDL64E_S3:
      // generates 2222220 points per second (half for strongest and half for lastest)
      // 1 packet holds 384 points
      return 2222220 / 384;
    case Model.VLS128:
      // 3 firing cycles in a data packet
      // 3 x 53.3 μs = 0.1599 ms is the accumulation delay per packet
      // 1 packet/0.1599 ms = 6253.9 packets/second
      return 6253.9;
    default:
      return 2600;
  }
}
