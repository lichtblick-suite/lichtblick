// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { fromSec } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import { MessageEvent, Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes, OptionalMessageDefinition } from "@foxglove/studio-base/types/RosDatatypes";

import { initAccumulated } from "./accumulate";
import { initProcessor, initClient } from "./state";
import { Client, State } from "./types";
import { BlockUpdate, Update } from "../blocks";
import { datumToTyped } from "../datasets";
import { PlotParams, PlotPath, TypedDataSet } from "../internalTypes";
import { getParamTopics } from "../params";
import { PlotData } from "../plotData";

export const CLIENT_ID = "foobar";
export const FAKE_TOPIC = "/foo";
export const FAKE_PATH = `${FAKE_TOPIC}.data`;
export const FAKE_SCHEMA = "foo/Bar";
export const FAKE_TOPICS: readonly Topic[] = [
  {
    name: FAKE_TOPIC,
    schemaName: FAKE_SCHEMA,
  },
];
export const FAKE_DATATYPES: Immutable<RosDatatypes> = new Map<
  string,
  OptionalMessageDefinition
>().set(FAKE_SCHEMA, {
  definitions: [{ name: "data", type: "float64", isArray: false }],
});

export const createMessageEvents = (
  topic: string,
  schemaName: string,
  count: number,
): MessageEvent[] =>
  R.range(0, count).map(
    (i): MessageEvent => ({
      topic,
      schemaName,
      receiveTime: fromSec(i),
      message: {
        data: i,
      },
      sizeInBytes: 0,
    }),
  );

export const createBlockUpdate = (
  clientId: string,
  topic: string,
  schemaName: string,
  count: number,
  update?: Partial<Update>,
): BlockUpdate => ({
  messages: {
    [topic]: [createMessageEvents(topic, schemaName, count)],
  },
  updates: [
    {
      id: clientId,
      update: {
        blockRange: [0, 1],
        shouldReset: false,
        topic,
        ...update,
      },
    },
  ],
});

export const createPath = (path: string): PlotPath => ({
  value: path,
  enabled: true,
  timestampMethod: "receiveTime",
});

/**
 * Turn a list of signal paths into a full PlotParams.
 */
export const createParams = (...paths: string[]): PlotParams => ({
  startTime: fromSec(0),
  paths: paths.map(createPath),
  invertedTheme: false,
  xAxisVal: "timestamp",
  followingViewWidth: undefined,
  minXValue: undefined,
  maxXValue: undefined,
  minYValue: undefined,
  maxYValue: undefined,
});

/**
 * Return a TypedDataSet with `count` points.
 */
export const createDataset = (count: number): TypedDataSet => ({
  data: [
    datumToTyped(
      R.range(0, count).map((v) => ({
        x: v,
        y: v,
        receiveTime: fromSec(v),
      })),
    ),
  ],
});

/**
 * Initialize a PlotData with fake data for the given `path`.
 */
export const createData = (path: PlotPath, count: number): PlotData => {
  const datasets = new Map<PlotPath, TypedDataSet>();
  datasets.set(path, createDataset(count));
  return {
    datasets,
    bounds: {
      x: { min: 0, max: 0 },
      y: { min: 0, max: 0 },
    },
    pathsWithMismatchedDataLengths: [],
  };
};

/**
 * Initialize a PlotData with fake data for the given `path`.
 */
export const createDataMany = (count: number, ...paths: PlotPath[]): PlotData => {
  const datasets = new Map<PlotPath, TypedDataSet>();
  for (const path of paths) {
    datasets.set(path, createDataset(count));
  }
  return {
    datasets,
    bounds: {
      x: { min: 0, max: 0 },
      y: { min: 0, max: 0 },
    },
    pathsWithMismatchedDataLengths: [],
  };
};

/**
 * Create a Client that plots all of the given message paths.
 */
export const createClient = (...paths: string[]): Client => {
  if (paths.length === 0) {
    return initClient(CLIENT_ID, undefined);
  }

  const params = createParams(...paths);
  const topics = getParamTopics(params);

  return {
    ...initClient(CLIENT_ID, undefined),
    params,
    topics,
    blocks: initAccumulated(),
    current: initAccumulated(),
  };
};

/**
 * Creates a State with a single Client that plots all of the given message
 * paths.
 */
export const createState = (...paths: string[]): State => ({
  ...initProcessor(),
  clients: [createClient(...paths)],
});
