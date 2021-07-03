// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { HttpServerNodejs } from "@foxglove/xmlrpc/dist/HttpServerNodejs";

import { PublisherLink } from "./PublisherLink";
import { RosMaster } from "./RosMaster";
import { ParamUpdateArgs, RosNode } from "./RosNode";
import { TcpServerNode } from "./nodejs/TcpServerNode";
import { TcpSocketNode } from "./nodejs/TcpSocketNode";

describe("RosNode", () => {
  it("Publishes and subscribes to topics and parameters", async () => {
    const rosMaster = new RosMaster(new HttpServerNodejs());
    await rosMaster.start("localhost");
    const rosMasterUri = rosMaster.url() as string;
    expect(typeof rosMasterUri).toBe("string");

    const nodeA = new RosNode({
      name: "/nodeA",
      hostname: "localhost",
      pid: 1,
      rosMasterUri,
      httpServer: new HttpServerNodejs(),
      tcpSocketCreate: TcpSocketNode.Create,
      tcpServer: await TcpServerNode.Listen({}),
      log: console,
    });

    const nodeB = new RosNode({
      name: "/nodeB",
      hostname: "localhost",
      pid: 2,
      rosMasterUri,
      httpServer: new HttpServerNodejs(),
      tcpSocketCreate: TcpSocketNode.Create,
      tcpServer: await TcpServerNode.Listen({}),
      log: console,
    });

    await nodeA.start();

    const received = new Promise<[unknown, Uint8Array, PublisherLink]>((r) => {
      nodeA
        .subscribe({ topic: "/a", dataType: "std_msgs/Bool" })
        .on("message", (msg, data, pub) => r([msg, data, pub]));
    });

    await nodeB.start();
    await nodeB.advertise({
      topic: "/a",
      dataType: "std_msgs/Bool",
      messageDefinitionText: "bool data",
      latching: true,
    });
    await nodeB.publish("/a", { data: true });

    const [msg, data, pub] = await received;
    expect((msg as { data: boolean }).data).toEqual(true);
    expect(data).toHaveLength(1);
    expect(pub.connection.connected()).toEqual(true);
    expect(pub.connection.getTransportInfo().startsWith("TCPROS connection on port ")).toBe(true);
    expect(pub.connection.stats().bytesReceived).toEqual(143);
    expect(pub.connection.transportType()).toEqual("TCPROS");
    expect(pub.connectionId).toEqual(0);
    expect(pub.subscription.md5sum).toEqual("*");
    expect(pub.subscription.publishers().size).toEqual(1);
    expect(pub.subscription.receivedBytes()).toEqual(143);

    const initParamValue = await nodeB.subscribeParam("a");
    expect(initParamValue).toBeUndefined();
    const paramUpdated = new Promise<ParamUpdateArgs>((r) => {
      nodeB.on("paramUpdate", (args) => r(args));
    });

    await nodeA.setParameter("a", 42);

    const args = await paramUpdated;
    expect(args.callerId).toEqual("/nodeA");
    expect(args.key).toEqual("a");
    expect(args.value).toEqual(42);
    expect(args.prevValue).toBeUndefined();

    nodeB.shutdown();
    nodeA.shutdown();
    await new Promise((r) => setTimeout(r, 100));
    rosMaster.close();
  });
});
