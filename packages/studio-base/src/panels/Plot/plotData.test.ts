// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PlotDataByPath } from "./internalTypes";
import * as PlotData from "./plotData";

const dataA: PlotDataByPath = {
  "/foo": [
    [
      {
        queriedData: [],
        receiveTime: { sec: 1, nsec: 0 },
        headerStamp: { sec: 1, nsec: 0 },
      },
    ],
    [
      {
        queriedData: [],
        receiveTime: { sec: 3, nsec: 0 },
        headerStamp: { sec: 3, nsec: 0 },
      },
    ],
  ],
  "/bar": [
    [
      {
        queriedData: [],
        receiveTime: { sec: 1, nsec: 0 },
        headerStamp: { sec: 1, nsec: 0 },
      },
    ],
    [
      {
        queriedData: [],
        receiveTime: { sec: 4, nsec: 0 },
        headerStamp: { sec: 4, nsec: 0 },
      },
    ],
  ],
};

const dataB: PlotDataByPath = {
  "/foo": [
    [
      {
        queriedData: [],
        receiveTime: { sec: 4, nsec: 0 },
        headerStamp: { sec: 4, nsec: 0 },
      },
    ],
    [
      {
        queriedData: [],
        receiveTime: { sec: 5, nsec: 0 },
        headerStamp: { sec: 5, nsec: 0 },
      },
    ],
  ],
  "/bar": [
    [
      {
        queriedData: [],
        receiveTime: { sec: 3, nsec: 0 },
        headerStamp: { sec: 3, nsec: 0 },
      },
    ],
    [
      {
        queriedData: [],
        receiveTime: { sec: 5, nsec: 0 },
        headerStamp: { sec: 5, nsec: 0 },
      },
    ],
  ],
  "/baz": [
    [
      {
        queriedData: [],
        receiveTime: { sec: 1, nsec: 0 },
        headerStamp: { sec: 1, nsec: 0 },
      },
    ],
    [
      {
        queriedData: [],
        receiveTime: { sec: 4, nsec: 0 },
        headerStamp: { sec: 4, nsec: 0 },
      },
    ],
  ],
};

describe("plotData", () => {
  describe("findTimeRange", () => {
    it("should find time range for plot data", () => {
      expect(PlotData.findTimeRanges(dataA)).toEqual({
        all: {
          start: { sec: 1, nsec: 0 },
          end: { sec: 4, nsec: 0 },
        },
        byPath: {
          "/bar": {
            end: {
              nsec: 0,
              sec: 4,
            },
            start: {
              nsec: 0,
              sec: 1,
            },
          },
          "/foo": {
            end: {
              nsec: 0,
              sec: 3,
            },
            start: {
              nsec: 0,
              sec: 1,
            },
          },
        },
      });
    });
  });

  describe("combine", () => {
    it("should combine plot data", () => {
      expect(PlotData.combine([dataA, dataB])).toEqual({
        "/foo": [
          [
            {
              queriedData: [],
              receiveTime: { sec: 1, nsec: 0 },
              headerStamp: { sec: 1, nsec: 0 },
            },
          ],
          [
            {
              queriedData: [],
              receiveTime: { sec: 3, nsec: 0 },
              headerStamp: { sec: 3, nsec: 0 },
            },
          ],
          [
            {
              queriedData: [],
              receiveTime: { sec: 4, nsec: 0 },
              headerStamp: { sec: 4, nsec: 0 },
            },
          ],
          [
            {
              queriedData: [],
              receiveTime: { sec: 5, nsec: 0 },
              headerStamp: { sec: 5, nsec: 0 },
            },
          ],
        ],
        "/bar": [
          [
            {
              queriedData: [],
              receiveTime: { sec: 1, nsec: 0 },
              headerStamp: { sec: 1, nsec: 0 },
            },
          ],
          [
            {
              queriedData: [],
              receiveTime: { sec: 4, nsec: 0 },
              headerStamp: { sec: 4, nsec: 0 },
            },
          ],
          [
            {
              queriedData: [],
              receiveTime: { sec: 5, nsec: 0 },
              headerStamp: { sec: 5, nsec: 0 },
            },
          ],
        ],
        "/baz": [
          [
            {
              queriedData: [],
              receiveTime: { sec: 1, nsec: 0 },
              headerStamp: { sec: 1, nsec: 0 },
            },
          ],
          [
            {
              queriedData: [],
              receiveTime: { sec: 4, nsec: 0 },
              headerStamp: { sec: 4, nsec: 0 },
            },
          ],
        ],
      });
    });
  });
});
