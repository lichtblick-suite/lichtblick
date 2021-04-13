// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter, ListenerFn } from "eventemitter3";

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

export declare interface RosFollower {
  on(
    event: "paramUpdate",
    listener: (paramKey: string, paramValue: XmlRpcValue, callerId: string) => void,
  ): this;
  on(
    event: "publisherUpdate",
    listener: (topic: string, publishers: string[], callerId: string) => void,
  ): this;
  on(event: string, listener: ListenerFn): this;
}

export class RosFollower extends EventEmitter {
  private _rosNode: RosNode;
  private _server: XmlRpcServer;

  constructor(rosNode: RosNode, httpServer: HttpServer) {
    super();
    this._rosNode = rosNode;
    this._server = new XmlRpcServer(httpServer);
  }

  async start(hostname: string, port?: number): Promise<void> {
    await this._server.listen(port, hostname, 10);

    this._server.setHandler("getBusStats", this.getBusStats);
    this._server.setHandler("getBusInfo", this.getBusInfo);
    this._server.setHandler("shutdown", this.shutdown);
    this._server.setHandler("getPid", this.getPid);
    this._server.setHandler("getSubscriptions", this.getSubscriptions);
    this._server.setHandler("getPublications", this.getPublications);
    this._server.setHandler("paramUpdate", this.paramUpdate);
    this._server.setHandler("publisherUpdate", this.publisherUpdate);
    this._server.setHandler("requestTopic", this.requestTopic);
  }

  close(): void {
    this._server.close();
  }

  url(): string | undefined {
    return this._server.url();
  }

  getBusStats = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const publications = this._rosNode.publications.values();
    const subscriptions = this._rosNode.subscriptions.values();

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
    this._rosNode.shutdown(msg);

    return Promise.resolve([1, "", 0]);
  };

  getPid = async (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    return [1, "", this._rosNode.pid];
  };

  getSubscriptions = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const subs: [string, string][] = [];
    this._rosNode.subscriptions.forEach((sub) => subs.push([sub.name, sub.dataType]));
    return Promise.resolve([1, "subscriptions", subs]);
  };

  getPublications = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string"]);
    if (err) {
      return Promise.reject(err);
    }

    const pubs: [string, string][] = [];
    this._rosNode.publications.forEach((pub) => pubs.push([pub.name, pub.dataType]));
    return Promise.resolve([1, "publications", pubs]);
  };

  paramUpdate = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string", "string", "*"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, paramKey, paramValue] = args as [string, string, XmlRpcValue];
    this.emit("paramUpdate", paramKey, paramValue, callerId);

    return Promise.resolve([1, "", 0]);
  };

  publisherUpdate = (_: string, args: XmlRpcValue[]): Promise<RosXmlRpcResponse> => {
    const err = CheckArguments(args, ["string", "string", "*"]);
    if (err) {
      return Promise.reject(err);
    }

    const [callerId, topic, publishers] = args as [string, string, string[]];
    if (!Array.isArray(publishers)) {
      return Promise.reject(new Error(`invalid publishers list`));
    }
    this.emit("publisherUpdate", topic, publishers, callerId);

    return Promise.resolve([1, "", 0]);
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

    const addr = this._rosNode.tcpServerAddress();
    if (!addr) {
      return Promise.resolve([0, "cannot receive incoming connections", []]);
    }

    const tcp = ["TCPROS", addr.address, addr.port];
    return Promise.resolve([1, "", tcp]);
  };
}
