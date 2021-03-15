// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosNode } from "@foxglove/ros1";
import { PlatformNode, TcpSocketNode, XmlRpcNode } from "@foxglove/ros1-nodejs";

async function main() {
  const name = "/testclient";
  let rosNode: RosNode | undefined;

  try {
    const url = await PlatformNode.GetDefaultRosMasterUri();
    const xmlRpcClient = await XmlRpcNode.XmlRpcCreateClient({ url });
    rosNode = new RosNode({
      name,
      xmlRpcClient,
      xmlRpcCreateClient: XmlRpcNode.XmlRpcCreateClient,
      xmlRpcCreateServer: XmlRpcNode.XmlRpcCreateServer,
      tcpConnect: TcpSocketNode.Connect,
      getPid: PlatformNode.GetPid,
      getHostname: PlatformNode.GetHostname,
    });

    await rosNode.start();

    const sub = await rosNode.subscribe({
      topic: "/turtle1/color_sensor",
      type: "turtlesim/Color",
    });
    // eslint-disable-next-line no-restricted-syntax
    console.dir(sub.getStats());
  } catch (err) {
    const msg = (err as Error).stack ?? `${err}`;
    console.error(msg);
  } finally {
    rosNode?.shutdown();
  }
}

main();
