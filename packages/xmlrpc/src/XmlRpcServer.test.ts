// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import http from "http";
import { URL } from "url";

import { HttpServerNodejs } from "./HttpServerNodejs";
import { XmlRpcFault } from "./XmlRpcFault";
import { XmlRpcServer } from "./XmlRpcServer";
import { XmlRpcValue } from "./XmlRpcTypes";

describe("XmlRpcServer", () => {
  it("Can receive a chunked request", (done) => {
    let handledMethod = false;
    const server = new XmlRpcServer(new HttpServerNodejs());
    server.setHandler("testMethod", async (methodName, args): Promise<XmlRpcValue> => {
      handledMethod = true;
      expect(methodName).toEqual("testMethod");
      expect(args).toEqual(["Param A", "Param B"]);
      return Promise.resolve([1, "test", undefined]);
    });
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

  it("serializes faults", async () => {
    const server = new XmlRpcServer(new HttpServerNodejs());
    server.setHandler("testMethod1", async (methodName, _args): Promise<XmlRpcValue> => {
      expect(methodName).toEqual("testMethod1");
      throw new Error("Example error");
    });
    server.setHandler("testMethod2", async (methodName, _args): Promise<XmlRpcValue> => {
      expect(methodName).toEqual("testMethod2");
      throw new XmlRpcFault("Example error", 123);
    });

    await server.listen();
    const port = parseInt(new URL(server.server.url() as string).port);
    expect(port).not.toBeNaN();

    const options = { host: "localhost", port, path: "/", method: "POST" };

    try {
      // Generic error produces generic fault code
      await new Promise<void>((resolve, reject) => {
        const req = http.request(options);
        req.on("error", (err) => reject(err));
        req.on("response", (res) => {
          let resData = "";
          expect(res.statusCode).toEqual(200);
          res.on("data", (chunk: string) => (resData += chunk));
          res.on("end", () => {
            resolve(
              (async () => {
                expect(resData).toContain(
                  `<?xml version="1.0"?><methodResponse version="1.0"><fault><value><struct><member>` +
                    `<name>faultCode</name><value><int>-32500</int></value></member>` +
                    `<member><name>faultString</name><value><string>Error: Example error`,
                );
              })(),
            );
          });
        });

        req.write(`
          <?xml version="1.0" encoding="UTF-8"?>
          <methodCall>
            <methodName>testMethod1</methodName>
          </methodCall>
        `);
        req.end();
      });

      // Custom XmlRpcFault code is passed through
      await new Promise<void>((resolve, reject) => {
        const req = http.request(options);
        req.on("error", (err) => reject(err));
        req.on("response", (res) => {
          let resData = "";
          expect(res.statusCode).toEqual(200);
          res.on("data", (chunk: string) => (resData += chunk));
          res.on("end", () => {
            resolve(
              (async () => {
                expect(resData).toContain(
                  `<?xml version="1.0"?><methodResponse version="1.0"><fault><value><struct>` +
                    `<member><name>faultCode</name><value><int>123</int></value></member>` +
                    `<member><name>faultString</name><value><string>Example error`,
                );
              })(),
            );
          });
        });

        req.write(`
          <?xml version="1.0" encoding="UTF-8"?>
          <methodCall>
            <methodName>testMethod2</methodName>
          </methodCall>
        `);
        req.end();
      });
    } finally {
      server.close();
    }
  });
});
