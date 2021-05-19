// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";

import { Client, ClientStats } from "./Client";
import { LoggerService } from "./LoggerService";
import { Publication } from "./Publication";
import { RosTcpMessageStream } from "./RosTcpMessageStream";
import { TcpConnection } from "./TcpConnection";
import { TcpSocket } from "./TcpTypes";
import { concatData } from "./concatData";

export type PublicationLookup = (topic: string) => Publication | undefined;

type TcpClientOpts = {
  socket: TcpSocket;
  address: string;
  port: number;
  nodeName: string;
  getPublication: PublicationLookup;
  log?: LoggerService;
};

export interface TcpClientEvents {
  close: () => void;
  subscribe: (topic: string, destinationCallerId: string) => void;
}

export class TcpClient extends EventEmitter<TcpClientEvents> implements Client {
  private _socket: TcpSocket;
  private _address: string;
  private _port: number;
  private _nodeName: string;
  private _connected = true;
  private _receivedHeader = false;
  private _transportInfo: string;
  private _stats: ClientStats = { bytesSent: 0, bytesReceived: 0, messagesSent: 0 };
  private _getPublication: PublicationLookup;
  private _log?: LoggerService;
  private _transformer: RosTcpMessageStream;

  constructor({ socket, address, port, nodeName, getPublication, log }: TcpClientOpts) {
    super();
    this._socket = socket;
    this._address = address;
    this._port = port;
    this._nodeName = nodeName;
    this._getPublication = getPublication;
    this._log = log;
    this._transformer = new RosTcpMessageStream();
    this._transportInfo = `TCPROS connection to [${address}:${port}]`;
    this._getTransportInfo().then((info) => (this._transportInfo = info));

    socket.on("close", this._handleClose);
    socket.on("error", this._handleError);
    socket.on("data", (chunk) => this._transformer.addData(chunk));

    this._transformer.on("message", this._handleMessage);

    // Wait for the client to send the initial connection header
  }

  transportType(): string {
    return "TCPROS";
  }

  connected(): boolean {
    return this._connected;
  }

  stats(): ClientStats {
    return this._stats;
  }

  async write(data: Uint8Array): Promise<void> {
    this._stats.messagesSent++;
    this._stats.bytesSent += data.length;
    try {
      await this._socket.write(data);
    } catch (err) {
      this._log?.warn?.(`failed to write ${data.length} bytes to ${this.toString()}: ${err}`);
    }
  }

  close(): void {
    this._socket
      .close()
      .catch((err) => this._log?.warn?.(`error closing client socket ${this.toString()}: ${err}`));
  }

  getTransportInfo(): string {
    return this._transportInfo;
  }

  toString(): string {
    return TcpConnection.Uri(this._address, this._port);
  }

  private _getTransportInfo = async (): Promise<string> => {
    const localPort = (await this._socket.localAddress())?.port ?? -1;
    const addr = await this._socket.remoteAddress();
    const fd = (await this._socket.fd()) ?? -1;
    if (addr) {
      const { address, port } = addr;
      const host = address.includes(":") ? `[${address}]` : address;
      return `TCPROS connection on port ${localPort} to [${host}:${port} on socket ${fd}]`;
    }
    return `TCPROS not connected [socket ${fd}]`;
  };

  private async _writeHeader(header: Map<string, string>): Promise<void> {
    const data = TcpConnection.SerializeHeader(header);

    // Serialize the 4-byte length
    const lenBuffer = new ArrayBuffer(4);
    const view = new DataView(lenBuffer);
    view.setUint32(0, data.byteLength, true);

    const payload = concatData([new Uint8Array(lenBuffer), data]);

    this._stats.bytesSent += payload.length;

    // Write the serialized header payload
    try {
      await this._socket.write(payload);
    } catch (err) {
      this._log?.warn?.(
        `failed to write ${payload.length} byte header to ${this.toString()}: ${err}`,
      );
    }
  }

  private _handleClose = () => {
    this._connected = false;
    this.emit("close");
  };

  private _handleError = (err: Error) => {
    this._log?.warn?.(`tcp client ${this.toString()} error: ${err}`);
  };

  private _handleMessage = async (msgData: Uint8Array) => {
    // Check if we have already received the connection header from this client
    if (this._receivedHeader) {
      this._log?.warn?.(`tcp client ${this.toString()} sent ${msgData.length} bytes after header`);
      this._stats.bytesReceived += msgData.byteLength;
      return;
    }

    const header = TcpConnection.ParseHeader(msgData);
    const topic = header.get("topic");
    const destinationCallerId = header.get("callerid");
    const dataType = header.get("type");
    const md5sum = header.get("md5sum") ?? "*";
    const tcpNoDelay = header.get("tcp_nodelay") === "1";

    this._receivedHeader = true;

    this._socket.setNoDelay(tcpNoDelay);

    if (topic == undefined || dataType == undefined || destinationCallerId == undefined) {
      this._log?.warn?.(
        `tcp client ${this.toString()} sent incomplete header. topic="${topic}", type="${dataType}", callerid="${destinationCallerId}"`,
      );
      return this.close();
    }

    // Check if we are publishing this topic
    const pub = this._getPublication(topic);
    if (pub == undefined) {
      this._log?.warn?.(
        `tcp client ${this.toString()} attempted to subscribe to unadvertised topic ${topic}`,
      );
      return this.close();
    }

    this._stats.bytesReceived += msgData.byteLength;

    // Check the dataType matches
    if (pub.dataType !== dataType) {
      this._log?.warn?.(
        `tcp client ${this.toString()} attempted to subscribe to topic ${topic} with type "${dataType}", expected "${
          pub.dataType
        }"`,
      );
      return this.close();
    }

    // Check the md5sum matches
    if (md5sum !== "*" && pub.md5sum !== md5sum) {
      this._log?.warn?.(
        `tcp client ${this.toString()} attempted to subscribe to topic ${topic} with md5sum "${md5sum}", expected "${
          pub.md5sum
        }"`,
      );
      return this.close();
    }

    // Write the response header
    this._writeHeader(
      new Map<string, string>([
        ["callerid", this._nodeName],
        ["latching", pub.latching ? "1" : "0"],
        ["md5sum", pub.md5sum],
        ["message_definition", pub.messageDefinitionText],
        ["topic", pub.name],
        ["type", pub.dataType],
      ]),
    );

    // Immediately send the last published message if latching is enabled
    const latched = pub.latchedMessage(this.transportType());
    if (latched != undefined) {
      this.write(latched);
    }

    this.emit("subscribe", topic, destinationCallerId);
  };
}
