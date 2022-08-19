// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toSec } from "@foxglove/rostime";
import {
  VelodynePacket,
  VelodyneScan,
  VelodyneScanDecoded,
} from "@foxglove/studio-base/types/Messages";
import { Calibration, Model, PointCloud, RawPacket, Transformer } from "@foxglove/velodyne-cloud";

// Converts `velodyne_msgs/VelodyneScan` messages into `VelodyneScanDecoded`
// objects which are an amalgamation of VelodyneScan and PointCloud2 ROS
// messages plus marker-like SceneBuilder annotations
export default class VelodyneCloudConverter {
  private _transformers = new Map<Model, Transformer>();

  public decode(scan: VelodyneScan): VelodyneScanDecoded | undefined {
    if (scan.packets.length === 0) {
      return undefined;
    }

    const firstPacketData = scan.packets[0] as VelodynePacket;
    const model = RawPacket.InferModel(firstPacketData.data);
    if (model == undefined) {
      return undefined;
    }

    const stamp = toSec(scan.header.stamp);
    const maxPoints = RawPacket.MAX_POINTS_PER_PACKET * scan.packets.length;
    const cloud = new PointCloud({ stamp, maxPoints });
    const transformer = this.getTransformer(model);

    for (const packet of scan.packets) {
      transformer.unpack(new RawPacket(packet.data), stamp, toSec(packet.stamp), cloud);
    }

    cloud.trim();

    if (cloud.width === 0 || cloud.height === 0) {
      return undefined;
    }

    return {
      header: scan.header,
      packets: scan.packets,
      fields: cloud.fields,
      height: cloud.height,
      width: cloud.width,
      is_bigendian: cloud.is_bigendian,
      point_step: cloud.point_step,
      row_step: cloud.row_step,
      data: cloud.data,
      is_dense: Number(cloud.is_dense),
      type: 102,
    };
  }

  public getTransformer(model: Model): Transformer {
    let transformer = this._transformers.get(model);
    if (transformer != undefined) {
      return transformer;
    }

    transformer = new Transformer(new Calibration(model));
    this._transformers.set(model, transformer);
    return transformer;
  }
}
