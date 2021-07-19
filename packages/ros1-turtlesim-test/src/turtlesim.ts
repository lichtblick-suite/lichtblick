// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosNode } from "@foxglove/ros1";
import {
  getEnvVar,
  getHostname,
  getNetworkInterfaces,
  getPid,
  TcpServerNode,
  TcpSocketNode,
} from "@foxglove/ros1/src/nodejs";
import { HttpServerNodejs } from "@foxglove/xmlrpc/nodejs";

const TURTLESIM_POSE_MSGDEF = `
float32 x
float32 y
float32 theta

float32 linear_velocity
float32 angular_velocity`;

async function main() {
  const name = "/turtlesim";
  let rosNode: RosNode | undefined;

  try {
    const hostname = RosNode.GetRosHostname(getEnvVar, getHostname, getNetworkInterfaces);
    const tcpServer = await TcpServerNode.Listen({ host: hostname });
    rosNode = new RosNode({
      name,
      rosMasterUri: getEnvVar("ROS_MASTER_URI") ?? "http://localhost:11311/",
      hostname,
      pid: getPid(),
      httpServer: new HttpServerNodejs(),
      tcpSocketCreate: TcpSocketNode.Create,
      tcpServer,
      log: console,
    });

    await rosNode.start();

    await rosNode.advertise({
      topic: "/turtle1/pose",
      dataType: "turtlesim/Pose",
      messageDefinitionText: TURTLESIM_POSE_MSGDEF,
    });

    const publish = () => {
      if (rosNode == undefined) {
        return;
      }
      void rosNode.publish("/turtle1/pose", {
        x: 1,
        y: 0,
        theta: Math.PI,
        linear_velocity: 0,
        angular_velocity: 0,
      });
      setTimeout(publish, 100);
    };

    publish();
  } catch (err) {
    const msg = (err as Error).stack ?? `${err}`;
    console.error(msg);
  }
}

void main();
