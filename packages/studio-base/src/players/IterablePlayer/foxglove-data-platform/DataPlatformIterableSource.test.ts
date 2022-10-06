// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toRFC3339String } from "@foxglove/rostime";
import ConsoleApi, { CoverageResponse } from "@foxglove/studio-base/services/ConsoleApi";

import {
  DataPlatformInterableSourceConsoleApi,
  DataPlatformIterableSource,
} from "./DataPlatformIterableSource";
import { streamMessages } from "./streamMessages";

jest.mock("./streamMessages", () => ({
  ...jest.requireActual("./streamMessages"),
  streamMessages: jest.fn(() => {
    return [];
  }),
}));

describe("DataPlatformIterableSource", () => {
  it("should correctly play into next coverage region", async () => {
    const stubApi: DataPlatformInterableSourceConsoleApi = {
      async coverage(): Promise<CoverageResponse[]> {
        return [
          {
            deviceId: "device-id",
            start: toRFC3339String({ sec: 0, nsec: 0 }),
            end: toRFC3339String({ sec: 5, nsec: 0 }),
          },
          {
            deviceId: "device-id",
            start: toRFC3339String({ sec: 5, nsec: 1 }),
            end: toRFC3339String({ sec: 10, nsec: 0 }),
          },
          {
            deviceId: "device-id",
            start: toRFC3339String({ sec: 20, nsec: 0 }),
            end: toRFC3339String({ sec: 25, nsec: 0 }),
          },
        ];
      },
      async topics(): ReturnType<ConsoleApi["topics"]> {
        return [
          {
            topic: "foo",
            version: "1",
            schemaEncoding: "jsonschema",
            schemaName: "",
            encoding: "json",
            schema: new Uint8Array(),
          },
        ];
      },
      async getDevice(id: string): ReturnType<ConsoleApi["getDevice"]> {
        return {
          id,
          name: "my device",
        };
      },
      async stream(): Promise<{ link: string }> {
        return {
          link: "http://example.com/stream",
        };
      },
    };

    const source = new DataPlatformIterableSource({
      api: stubApi,
      params: {
        type: "by-device",
        deviceId: "device-id",
        start: { sec: 0, nsec: 0 },
        end: { sec: 40, nsec: 0 },
      },
    });

    const initResult = await source.initialize();
    expect(initResult.problems).toEqual([]);

    const msgIterator = source.messageIterator({ consumptionType: "partial", topics: ["foo"] });
    // read all the messages
    for await (const _ of msgIterator) {
      // no-op
    }

    expect((streamMessages as jest.Mock).mock.calls).toEqual([
      [
        expect.objectContaining({
          params: {
            type: "by-device",
            deviceId: "device-id",
            start: { sec: 0, nsec: 0 },
            end: { sec: 5, nsec: 0 },
            topics: ["foo"],
          },
        }),
      ],
      [
        expect.objectContaining({
          params: {
            type: "by-device",
            deviceId: "device-id",
            start: { sec: 5, nsec: 1 },
            end: { sec: 10, nsec: 1 },
            topics: ["foo"],
          },
        }),
      ],
      [
        expect.objectContaining({
          params: {
            type: "by-device",
            deviceId: "device-id",
            start: { sec: 20, nsec: 0 },
            end: { sec: 25, nsec: 0 },
            topics: ["foo"],
          },
        }),
      ],
    ]);
  });
});
