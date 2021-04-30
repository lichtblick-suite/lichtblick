// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import dgram from "dgram";
import * as packet from "dns-packet";
import os from "os";

const BROADCAST_IP = "224.0.0.251";
const PORT = 5353;
const MIN_RETRY_MS = 1000;
const RETRY_JITTER_MS = 500;

export type MDnsResponse = {
  answer: packet.StringAnswer;
  rinfo: dgram.RemoteInfo;
};

export function mdns4Request(
  hostname: string,
  timeoutMs = 8000,
): Promise<MDnsResponse | undefined> {
  return new Promise((resolve, reject) => {
    const interfaces = allInterfaces();
    if (interfaces.length === 0) {
      return reject(new Error("No interfaces to send an mDNS request"));
    }

    const finish = (response?: MDnsResponse) => {
      clearTimeout(timeout);
      sockets.forEach(closeSocket);
      resolve(response);
    };

    const sockets = interfaces.map((iface) => mdns4RequestOnIface(hostname, iface, finish));
    const timeout = setTimeout(finish, timeoutMs);
  });
}

function allInterfaces(): string[] {
  const res: string[] = [];
  const networks = os.networkInterfaces();
  for (const net of Object.values(networks)) {
    if (net == undefined) {
      continue;
    }
    for (const iface of net) {
      if (iface.family === "IPv4") {
        res.push(iface.address);
        // Can only addMembership once per interface
        // https://nodejs.org/api/dgram.html#dgram_socket_addmembership_multicastaddress_multicastinterface
        break;
      }
    }
  }
  return res;
}

function mdns4RequestOnIface(
  hostname: string,
  iface: string,
  callback: (res: MDnsResponse) => void,
): dgram.Socket {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  let timeout: NodeJS.Timeout;

  socket.on("message", (data, rinfo) => {
    try {
      const res = packet.decode(data);
      if (Array.isArray(res.answers)) {
        for (const answer of res.answers) {
          if (answer.name === hostname && answer.type === "A") {
            closeSocket(socket);
            return callback({ answer, rinfo });
          }
        }
      }
    } catch {
      // ignore
    }
  });

  socket.on("close", () => {
    clearTimeout(timeout);
  });

  socket.bind(PORT, iface, () => {
    socket.addMembership(BROADCAST_IP, iface);

    const message = packet.encode({ type: "query", questions: [{ type: "A", name: hostname }] });

    const sendMessage = () => {
      socket.send(message, 0, message.length, PORT, BROADCAST_IP);
      timeout = setTimeout(sendMessage, MIN_RETRY_MS + Math.random() * RETRY_JITTER_MS);
    };

    sendMessage();
  });

  return socket;
}

function closeSocket(socket: dgram.Socket) {
  try {
    socket.close();
  } catch {
    // ignore
  }
}
