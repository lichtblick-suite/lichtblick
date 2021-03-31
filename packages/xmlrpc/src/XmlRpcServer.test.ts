// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import http from "http";
import { URL } from "url";

import { HttpServerNodejs } from "./HttpServerNodejs";
import { XmlRpcServer } from "./XmlRpcServer";
import { XmlRpcValue } from "./XmlRpcTypes";

describe("XmlRpcServer", () => {
  it("Can receive a chunked request", (done) => {
    let handledMethod = false;
    const server = new XmlRpcServer(new HttpServerNodejs());
    server.setHandler(
      "testMethod",
      (methodName, args): Promise<XmlRpcValue> => {
        handledMethod = true;
        expect(methodName).toEqual("testMethod");
        expect(args).toEqual(["Param A", "Param B"]);
        return Promise.resolve([1, "test", undefined]);
      },
    );
    server.listen().then(() => {
      const port = parseInt(new URL(server.server.url() as string).port);
      expect(port).not.toBeNaN();

      const options = { host: "localhost", port, path: "/", method: "POST" };
      const req = http.request(options);
      const chunk1 =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        "<methodCall>" +
        "<methodName>testMethod</methodName>" +
        "<params>" +
        "<param>" +
        "<value><string>Param A</string></value>" +
        "</param>" +
        "<param>";
      const chunk2 =
        "<value><string>Param B</string></value>" + "</param>" + "</params>" + "</methodCall>";

      req.on("error", (err) => done.fail(err));
      req.on("response", (res) => {
        expect(handledMethod).toEqual(true);
        let resData = "";
        expect(res.statusCode).toEqual(200);
        res.on("data", (chunk: string) => (resData += chunk));
        res.on("end", () => {
          expect(resData).toEqual(
            '<?xml version="1.0"?><methodResponse version="1.0"><params><param><value><array><data><value><int>1</int></value><value><string>test</string></value><value/></data></array></value></param></params></methodResponse>',
          );
          server.close();
          done();
        });
      });

      req.write(chunk1);
      req.write(chunk2);
      req.end();
    });
  });
});
