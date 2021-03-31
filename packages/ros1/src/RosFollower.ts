// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { HttpServer, XmlRpcServer, XmlRpcValue } from "@foxglove/xmlrpc";

import { RosNode } from "./RosNode";
import { RosXmlRpcResponse } from "./XmlRpcTypes";

function CheckArguments(args: XmlRpcValue[], expected: string[]): Error | undefined {
  if (args.length !== expected.length) {
    return new Error(`Expected ${expected.length} arguments, got ${args.length}`);
  }

  for (let i = 0; i < args.length; i++) {
    if (expected[i] !== "*" && typeof args[i] !== expected[i]) {
      return new Error(`Expected "${expected[i]}" for arg ${i}, got "${typeof args[i]}"`);
    }
  }

  return undefined;
}

function TcpRequested(protocols: XmlRpcValue[]): boolean {
  for (const proto of protocols) {
    if (Array.isArray(proto) && proto.length > 0) {
      if (proto[0] === "TCPROS") {
        return true;
      }
    }
  }
  return false;
}

export class RosFollower {
  #rosNode: RosNode;
  #server: XmlRpcServer;

  constructor(rosNode: RosNode, httpServer: HttpServer) {
    this.#rosNode = rosNode;
    this.#server = new XmlRpcServer(httpServer);
  }

  async start(hostname: string, port?: number): Promise<void> {
    await this.#server.listen(port, hostname, 10);

    this.#server.setHandler("getBusStats", this.getBusStats);
    this.#server.setHandler("getBusInfo", this.getBusInfo);
    this.#server.setHandler("shutdown", this.shutdown);
    this.#server.setHandler("getPid", this.getPid);
    this.#server.setHandler("getSubscriptions", this.getSubscriptions);
    this.#server.setHandler("getPublications", this.getPublications);
    this.#server.setHandler("paramUpdate", this.paramUpdate);
    this.#server.setHandler("publisherUpdate", this.publisherUpdate);
    this.#server.setHandler("requestTopic", this.requestTopic);
  }

  close(): void {
    this.#server.close();
  }

  url(): string | undefined {
    return this.#server.url();
  }

  getBusStats = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const publications = this.#rosNode.publications.values();
    const subscriptions = this.#rosNode.subscriptions.values();

    const publishStats: XmlRpcValue[] = Array.from(publications, (pub, __) => pub.getStats());
    const subscribeStats: XmlRpcValue[] = Array.from(subscriptions, (sub, __) => sub.getStats());
    const serviceStats: XmlRpcValue[] = [];

    return Promise.resolve([1, "", [publishStats, subscribeStats, serviceStats]]);
  };

  getBusInfo = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    return Promise.resolve([1, "", ""]);
  };

  shutdown = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    if (args.length !== 1 && args.length !== 2) {
      return Promise.reject(new Error(`Expected 1-2 arguments, got ${args.length}`));
    }

    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] !== "string") {
        return Promise.reject(new Error(`Expected "string" for arg ${i}, got "${typeof args[i]}"`));
      }
    }

    const msg = args[1] as string | undefined;
    this.#rosNode.shutdown(msg);

    return Promise.resolve([1, "", 0]);
  };

  getPid = async (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    return [1, "", this.#rosNode.pid];
  };

  getSubscriptions = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const subs: [string, string][] = [];
    this.#rosNode.subscriptions.forEach((sub) => subs.push([sub.name, sub.dataType]));
    return Promise.resolve([1, "subscriptions", subs]);
  };

  getPublications = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const pubs: [string, string][] = [];
    this.#rosNode.publications.forEach((pub) => pubs.push([pub.name, pub.dataType]));
    return Promise.resolve([1, "publications", pubs]);
  };

  paramUpdate = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string", "string", "*"]);
    if (err) {
      return Promise.reject(err);
    }

    // TODO
    return Promise.reject(new Error("Not implemented"));
  };

  publisherUpdate = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string", "string", "*"]);
    if (err) {
      return Promise.reject(err);
    }

    // TODO
    return Promise.reject(new Error("Not implemented"));
  };

  requestTopic = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string", "string", "*"]);
    if (err) {
      return Promise.reject(err);
    }

    // const topic = args[1] as string;
    const protocols = args[2];
    if (!Array.isArray(protocols) || !TcpRequested(protocols)) {
      return Promise.resolve([0, "unsupported protocol", []]);
    }

    const addr = this.#rosNode.tcpServerAddress();
    if (!addr) {
      return Promise.resolve([0, "cannot receive incoming connections", []]);
    }

    const tcp = ["TCPROS", addr.address, addr.port];
    return Promise.resolve([1, "", tcp]);
  };
}
