// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { URL } from "whatwg-url";

import { ConnectionManager } from "./ConnectionManager";
import { GetHostname, GetPid } from "./PlatformTypes";
import { Publication } from "./Publication";
import { PublisherLink } from "./PublisherLink";
import { RosFollower } from "./RosFollower";
import { RosFollowerClient } from "./RosFollowerClient";
import { RosMasterClient } from "./RosMasterClient";
import { Subscription } from "./Subscription";
import { TcpConnection } from "./TcpConnection";
import { TcpConnect, TcpServer } from "./TcpTypes";
import { XmlRpcClient, XmlRpcCreateClient, XmlRpcCreateServer } from "./XmlRpcTypes";

export type SubscribeOpts = {
  topic: string;
  type: string;
  md5sum?: string;
  queueSize?: number;
  tcpNoDelay?: boolean;
};

function ToUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } finally {
    //
  }
  return undefined;
}

export class RosNode {
  readonly name: string;
  readonly xmlRpcCreateServer: XmlRpcCreateServer;

  connectionManager: ConnectionManager;
  rosMasterClient: RosMasterClient;
  rosFollower: RosFollower;
  subscriptions = new Map<string, Subscription>();
  publications = new Map<string, Publication>();

  #xmlRpcCreateClient: XmlRpcCreateClient;
  #tcpConnect: TcpConnect;
  #getPid: GetPid;
  #getHostname: GetHostname;
  #hostname: string | undefined;

  constructor(options: {
    name: string;
    xmlRpcClient: XmlRpcClient;
    xmlRpcCreateClient: XmlRpcCreateClient;
    xmlRpcCreateServer: XmlRpcCreateServer;
    tcpConnect: TcpConnect;
    getPid: GetPid;
    getHostname: GetHostname;
    hostname?: string;
    tcpServer?: TcpServer;
  }) {
    this.name = options.name;
    this.connectionManager = new ConnectionManager(options);
    this.rosMasterClient = new RosMasterClient(options);
    this.rosFollower = new RosFollower(this);
    this.xmlRpcCreateServer = options.xmlRpcCreateServer;
    this.#xmlRpcCreateClient = options.xmlRpcCreateClient;
    this.#tcpConnect = options.tcpConnect;
    this.#getPid = options.getPid;
    this.#getHostname = options.getHostname;
    this.#hostname = options.hostname;
  }

  pid(): Promise<number> {
    return this.#getPid();
  }

  async hostname(): Promise<string> {
    if (this.#hostname !== undefined) {
      return this.#hostname;
    }
    this.#hostname = await this.#getHostname();
    return this.#hostname;
  }

  async start(port?: number): Promise<void> {
    return this.rosFollower.start(port);
  }

  shutdown(_msg?: string): void {
    this.rosFollower.close();
    this.subscriptions.clear();
    this.publications.clear();
    this.connectionManager.close();
  }

  async subscribe(options: SubscribeOpts): Promise<Subscription> {
    const localApiUrl = this.rosFollower.url();
    if (localApiUrl === undefined) {
      throw new Error("Local XMLRPC server is not running");
    }

    const { topic, type } = options;
    const md5sum = options.md5sum ?? "*";
    const tcpNoDelay = options.tcpNoDelay ?? false;
    const subscription = new Subscription(topic, md5sum, type);
    this.subscriptions.set(topic, subscription);

    // Register with rosmaster as a subscriber to this topic
    const [status, msg, publishers] = await this.rosMasterClient.registerSubscriber(
      this.name,
      topic,
      type,
      localApiUrl.toString(),
    );

    if (status !== 1) {
      throw new Error(`registerSubscriber() failed. status=${status}, msg="${msg}"`);
    }
    if (!Array.isArray(publishers)) {
      throw new Error(
        `registerSubscriber() did not receive a list of publishers. value=${publishers}`,
      );
    }

    // Register with each publisher
    await Promise.all(
      publishers.map(async (pubUrlStr) => {
        const url = ToUrl(pubUrlStr as string);
        if (url === undefined) {
          return;
        }

        // Create an XMLRPC client to talk to this publisher
        const xmlRpcClient = await this.#xmlRpcCreateClient({ url });
        const rosFollowerClient = new RosFollowerClient({ xmlRpcClient });

        // Call requestTopic on this publisher to register ourselves as a subscriber
        const { address, port } = await RosNode.RequestTopic(this.name, topic, rosFollowerClient);

        // TODO: Don't wait for the TCP connection to connect here. Initiate the connection but
        // allow it to complete later, or fail/timeout and go into a retry loop

        // Establish a TCP connection to this publisher
        const socket = await this.#tcpConnect({ host: address, port });
        const connection = new TcpConnection(socket);
        this.connectionManager.addTcpConnection(connection);

        // Write the initial connection header to the TCP socket
        const header: [string, string][] = [
          ["topic", topic],
          ["md5sum", md5sum],
          ["callerid", this.name],
          ["type", type],
          ["tcp_nodelay", tcpNoDelay ? "1" : "0"],
        ];
        await connection.writeHeader(header);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Hold a reference to this publisher
        const connectionId = this.connectionManager.newConnectionId();
        subscription.publishers.push(
          new PublisherLink(connectionId, rosFollowerClient, connection),
        );
      }),
    );

    return subscription;
  }

  static async RequestTopic(
    name: string,
    topic: string,
    apiClient: RosFollowerClient,
  ): Promise<{ address: string; port: number }> {
    const [status, msg, protocol] = await apiClient.requestTopic(name, topic, [["TCPROS"]]);

    if (status !== 1) {
      throw new Error(`requestTopic("${name}", "${topic}") failed. status=${status}, msg=${msg}`);
    }
    if (!Array.isArray(protocol) || protocol.length < 3 || protocol[0] !== "TCPROS") {
      throw new Error(`TCP not supported by ${apiClient.url()} for topic "${topic}"`);
    }

    return { port: protocol[2] as number, address: protocol[1] as string };
  }
}
