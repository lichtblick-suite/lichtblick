// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getEnvVar, getHostname, getNetworkInterfaces } from "@foxglove/ros1/src/nodejs";
import { HttpServerNodejs } from "@foxglove/xmlrpc/dist/HttpServerNodejs";

import { RosMaster } from "../RosMaster";
import { RosNode } from "../RosNode";

async function main() {
  const hostname = RosNode.GetRosHostname(getEnvVar, getHostname, getNetworkInterfaces);
  const port = 11311;
  const httpServer = new HttpServerNodejs();
  const rosMaster = new RosMaster(httpServer);

  await rosMaster.start(hostname, port);
  // eslint-disable-next-line no-restricted-syntax
  console.log(`ROS_MASTER_URI=http://${hostname}:${port}/`);
}

void main();
