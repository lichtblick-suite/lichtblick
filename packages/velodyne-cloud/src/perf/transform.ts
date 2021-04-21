// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Calibration } from "../Calibration";
import { PointCloud } from "../PointCloud";
import { RawPacket } from "../RawPacket";
import { Transformer } from "../Transformer";
import { Model } from "../VelodyneTypes";
import { HDL32E_PACKET1 } from "../fixtures/packets";

const calibration = new Calibration(Model.HDL32E);
const transform = new Transformer(calibration);

for (let i = 0; i < 500; i++) {
  const raw = new RawPacket(HDL32E_PACKET1);
  const maxPoints = RawPacket.MAX_POINTS_PER_PACKET * 100;
  const cloud = new PointCloud({ stamp: 0, maxPoints });
  for (let j = 0; j < 100; j++) {
    transform.unpack(raw, 0, 0, cloud);
  }
}
