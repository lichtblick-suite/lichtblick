// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import net from "net";
import type { AddressInfo } from "net";

import { TcpConnection } from "./TcpConnection";
import { TcpSocket } from "./TcpTypes";
import { TcpSocketNode } from "./nodejs/TcpSocketNode";

////////////////////////////////////////////////////////////////////////////////

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

function hexToUint8Array(hex: string): Uint8Array {
  const match = hex.match(/[\da-f]{2}/gi);
  if (match == undefined) {
    return new Uint8Array();
  }
  return new Uint8Array(
    match.map((h) => {
      return parseInt(h, 16);
    }),
  );
}

const CLIENT_HEADER = new Map<string, string>([
  ["topic", "/turtle1/color_sensor"],
  ["md5sum", "*"],
  ["callerid", "/test"],
  ["type", "turtlesim/Color"],
  ["tcp_nodelay", "1"],
]);

const HEADER = new Map<string, string>([
  ["callerid", "/turtlesim"],
  ["latching", "0"],
  ["md5sum", "353891e354491c51aabe32df673fb446"],
  ["message_definition", "uint8 r\nuint8 g\nuint8 b\n"],
  ["topic", "/turtle1/color_sensor"],
  ["type", "turtlesim/Color"],
]);
const HEADER_DATA = hexToUint8Array(
  "1300000063616c6c657269643d2f747572746c6573696d0a0000006c61746368696e673d30270000006d643573756d3d33353338393165333534343931633531616162653332646636373366623434362b0000006d6573736167655f646566696e6974696f6e3d75696e743820720a75696e743820670a75696e743820620a1b000000746f7069633d2f747572746c65312f636f6c6f725f73656e736f7214000000747970653d747572746c6573696d2f436f6c6f72",
);

describe("TcpConnection", () => {
  it("ParseHeader", () => {
    const header = TcpConnection.ParseHeader(HEADER_DATA);
    expect(header.size).toEqual(6);
    expect(header).toEqual(HEADER);
  });

  it("SerializeHeader", () => {
    const data = TcpConnection.SerializeHeader(HEADER);
    expect(data).toEqual(HEADER_DATA);
  });

  it("Connects and reads a parsed message", async () => {
    // Create the TCP listening socket
    const server = net.createServer((client) => {
      client.on("data", (data) => {
        data = data.subarray(4);
        expect(data.byteLength).toEqual(102);
        expect(TcpConnection.ParseHeader(data)).toEqual(CLIENT_HEADER);

        client.write(new Uint8Array([0xb6, 0x00, 0x00, 0x00]));
        client.write(HEADER_DATA);
        client.write(new Uint8Array([0x03, 0x00, 0x00, 0x00]));
        client.write(new Uint8Array([0x45, 0x56, 0xff]));
      });
      client.on("error", (err) => {
        throw err;
      });
    });
    await new Promise<void>((resolve) => server.listen(undefined, undefined, undefined, resolve));
    const port = (server.address() as AddressInfo).port;

    // Create the client socket
    const tcpSocketCreate = (options: { host: string; port: number }): Promise<TcpSocket> => {
      return Promise.resolve(new TcpSocketNode(options.host, options.port, new net.Socket()));
    };
    const socket = await tcpSocketCreate({ host: "localhost", port });
    const connection = new TcpConnection(socket, CLIENT_HEADER);
    const p = new Promise((resolve, reject) => {
      connection.on("message", (msg, data: Uint8Array) => {
        expect(data.byteLength).toEqual(3);
        resolve(msg);
      });
      connection.on("error", reject);
    });
    await socket.connect();
    const msg = await p;

    expect(msg).toEqual({ b: 255, g: 86, r: 69 });

    connection.close();
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });
});
