// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const Calibration = require("../dist/src/Calibration").Calibration;
const Model = require("../dist/src/VelodyneTypes").Model;
const HDL32E_PACKET1 = require("../dist/fixtures/packets").HDL32E_PACKET1;
const PointCloud = require("../dist/src/PointCloud").PointCloud;
const RawPacket = require("../dist/src/RawPacket").RawPacket;
const Transformer = require("../dist/src/Transformer").Transformer;

const calibration = new Calibration(Model.HDL32E);
const transform = new Transformer(calibration);

for (let i = 0; i < 500; i++) {
  const raw = new RawPacket(HDL32E_PACKET1);
  const count = transform.validPoints(raw);
  const cloud = new PointCloud({ stamp: 0, count: count * 100 });
  for (let j = 0; j < 100; j++) {
    transform.unpack(raw, 0, 0, cloud);
  }
}
