// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { generateCSV } from "./csv";

describe("csv", () => {
  describe("getCSVData", () => {
    it("should generate valid csv data", () => {
      const csv = generateCSV(
        [
          {
            label: "label",
            data: [{ receiveTime: { sec: 0, nsec: 0 }, path: "path", x: 0, y: 0, value: 0 }],
          },
        ],
        "timestamp",
      );
      expect(csv).toEqual(
        ["elapsed time,receive time,header.stamp,topic,value", "0,0.000000000,,label,0"].join("\n"),
      );
    });

    it("should generate valid csv data for bigint values", () => {
      const csv = generateCSV(
        [
          {
            label: "label",
            data: [
              {
                receiveTime: { sec: 0, nsec: 0 },
                path: "path",
                x: 0,
                // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
                y: Number(9999999999999001),
                value: 9999999999999001n,
              },
            ],
          },
        ],
        "timestamp",
      );
      expect(csv).toEqual(
        [
          "elapsed time,receive time,header.stamp,topic,value",
          "0,0.000000000,,label,9999999999999001",
        ].join("\n"),
      );
    });
  });
});
