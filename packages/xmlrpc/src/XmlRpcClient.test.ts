// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import http from "http";
import type { AddressInfo } from "net";

import { XmlRpcClient } from "./XmlRpcClient";

describe("XmlRpcClient", () => {
  it("Can call a method on a live server", (done) => {
    const server = http
      .createServer((_, res) => {
        res.writeHead(200, { "Content-Type": "text/xml" });
        const data =
          '<?xml version="2.0" encoding="UTF-8"?>' +
          "<methodResponse>" +
          "<params>" +
          "<param><value><string>more.listMethods</string></value></param>" +
          "</params>" +
          "</methodResponse>";
        res.write(data);
        res.end();
      })
      .listen(undefined, "localhost", async () => {
        const port = (server.address() as AddressInfo).port;
        const client = new XmlRpcClient(`http://localhost:${port}`);
        const res = await client.methodCall("listMethods");
        expect(res).toEqual("more.listMethods");
        server.close();
        done();
      });
  });

  it("Can call a method with a chunked response", (done) => {
    const server = http
      .createServer((_, res) => {
        res.writeHead(200, { "Content-Type": "text/xml" });
        const chunk1 =
          '<?xml version="2.0" encoding="UTF-8"?>' +
          "<methodResponse>" +
          "<params>" +
          "<param><value><array><data>" +
          "<value><string>system.listMethods</string></value>" +
          "<value><string>system.methodSignature</string></value>";
        const chunk2 =
          "<value><string>xmlrpc_dialect</string></value>" +
          "</data></array></value></param>" +
          "</params>" +
          "</methodResponse>";
        res.write(chunk1);
        res.write(chunk2);
        res.end();
      })
      .listen(undefined, "localhost", async () => {
        const port = (server.address() as AddressInfo).port;
        const client = new XmlRpcClient(`http://localhost:${port}/`);
        const res = await client.methodCall("listMethods");
        expect(res).toEqual(["system.listMethods", "system.methodSignature", "xmlrpc_dialect"]);
        server.close();
        done();
      });
  });

  it("Can call a method with UTF8 encoding", (done) => {
    const server = http
      .createServer((_, res) => {
        res.writeHead(200, { "Content-Type": "text/xml" });
        const data =
          '<?xml version="2.0" encoding="UTF-8"?>' +
          "<methodResponse>" +
          "<params>" +
          "<param><value><string>here is mr. Snowman: ☃</string></value></param>" +
          "</params>" +
          "</methodResponse>";
        res.write(data);
        res.end();
      })
      .listen(undefined, "localhost", async () => {
        const port = (server.address() as AddressInfo).port;
        const client = new XmlRpcClient(`http://localhost:${port}`);
        const res = await client.methodCall("listMethods");
        expect(res).toEqual("here is mr. Snowman: ☃");
        server.close();
        done();
      });
  });

  it("Can call a method with ISO-8859-1 encoding", () => {
    let requestBody = "";
    const server = http
      .createServer((req, res) => {
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          requestBody += chunk;
        });
        res.writeHead(200, { "Content-Type": "text/xml" });
        const data =
          '<?xml version="2.0" encoding="UTF-8"?>' +
          "<methodResponse>" +
          "<params>" +
          "<param><value><string>ok</string></value></param>" +
          "</params>" +
          "</methodResponse>";
        res.write(data);
        res.end();
      })
      .listen(undefined, "localhost", async () => {
        const port = (server.address() as AddressInfo).port;
        const client = new XmlRpcClient(`http://localhost:${port}`);
        await client.methodCall("multiByte", ["ö"]);
        const data =
          '<?xml version="1.0"?>' +
          "<methodCall>" +
          "<methodName>multiByte</methodName>" +
          "<params><param><value><string>ö</string></value></param></params>" +
          "</methodCall>";
        expect(requestBody).toEqual(data);
        server.close();
      });
  });
});
