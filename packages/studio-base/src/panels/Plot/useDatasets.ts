// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";
import * as R from "ramda";
import { useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo, useDeepMemo } from "@foxglove/hooks";
import { Immutable } from "@foxglove/studio";
import { useMessageReducer as useCurrent, useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import { useBlocksSubscriptions as useBlocks } from "@foxglove/studio-base/PanelAPI/useBlocksSubscriptions";
import {
  RosPath,
  MessagePathPart,
} from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove/studio-base/components/MessagePipeline";
import { TypedDataProvider } from "@foxglove/studio-base/components/TimeBasedChart/types";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { SubscribePayload, MessageEvent } from "@foxglove/studio-base/players/types";

import { PlotParams, Messages } from "./internalTypes";
import { getPaths, PlotData } from "./plotData";

type Service = Comlink.Remote<(typeof import("./useDatasets.worker"))["service"]>;
let worker: Worker | undefined;
let service: Service | undefined;
let numClients: number = 0;

const pending: ((service: Service) => void)[] = [];
async function waitService(): Promise<Service> {
  if (service != undefined) {
    return service;
  }
  return await new Promise((resolve) => {
    pending.push(resolve);
  });
}

const getIsLive = (ctx: MessagePipelineContext) => ctx.seekPlayback == undefined;

// topic -> number of fields
type BlockStatus = Record<string, number>;
let blockStatus: BlockStatus[] = [];

const getPayloadString = (payload: SubscribePayload): string =>
  `${payload.topic}:${(payload.fields ?? []).join(",")}`;

type Client = {
  topics: SubscribePayload[];
  setter: (topics: SubscribePayload[]) => void;
};
let clients: Record<string, Client> = {};

function normalizePaths(topics: SubscribePayload[]): SubscribePayload[] {
  return R.pipe(
    R.groupBy((payload: SubscribePayload) => payload.topic),
    // Combine subscriptions to the same topic (but different fields)
    R.mapObjIndexed(
      (payloads: SubscribePayload[] | undefined, topic: string): SubscribePayload => ({
        topic,
        fields: R.pipe(
          // Aggregate all fields
          R.chain((payload: SubscribePayload): string[] => payload.fields ?? []),
          // Ensure there are no duplicates
          R.uniq,
        )(payloads ?? []),
      }),
    ),
    R.values,
  )(topics);
}

/**
 * Get the SubscribePayload for a single path by subscribing to all fields
 * referenced in leading MessagePathFilters and the first field of the
 * message.
 */
export function pathToPayload(path: RosPath): SubscribePayload | undefined {
  const { messagePath: parts, topicName: topic } = path;

  // We want to take _all_ of the filters that start the path, since these can
  // be chained
  const filters = R.takeWhile((part: MessagePathPart) => part.type === "filter", parts);
  const firstField = R.find((part: MessagePathPart) => part.type === "name", parts);
  if (firstField == undefined || firstField.type !== "name") {
    return undefined;
  }

  return {
    topic,
    fields: R.pipe(
      R.chain((part: MessagePathPart): string[] => {
        if (part.type !== "filter") {
          return [];
        }
        const { path: filterPath } = part;
        const field = filterPath[0];
        if (field == undefined) {
          return [];
        }

        return [field];
      }),
      // Always subscribe to the header field
      (filterFields) => [...filterFields, firstField.name, "header"],
      R.uniq,
    )(filters),
  };
}

function getPayloadsFromPaths(paths: readonly string[]): SubscribePayload[] {
  return R.pipe(
    R.chain((path: string): SubscribePayload[] => {
      const parsed = parseRosPath(path);
      if (parsed == undefined) {
        return [];
      }

      const payload = pathToPayload(parsed);
      if (payload == undefined) {
        return [];
      }

      return [payload];
    }),
    // Then simplify
    normalizePaths,
  )(paths);
}

// Calculate the list of unique topics that _all_ of the plots need and
// nominate one panel to subscribe to the topics on behalf of the rest.
function chooseClient() {
  if (R.isEmpty(clients)) {
    return;
  }

  const clientList = R.values(clients);
  const topics = R.pipe(
    R.chain((client: Client) => client.topics),
    normalizePaths,
  )(clientList);
  R.head(clientList)?.setter(topics);

  // Also clear the status of any topics we're no longer using
  blockStatus = blockStatus.map((block) => R.pick(topics.map(getPayloadString), block));
}

function getNumFields(events: readonly MessageEvent[]): number {
  const message = events[0]?.message;
  if (message == undefined) {
    return 0;
  }

  return Object.keys(message).length;
}

// Subscribe to "current" messages (those near the seek head) and forward new
// messages to the worker as they arrive.
function useData(id: string, topics: SubscribePayload[]) {
  const [subscribed, setSubscribed] = React.useState<SubscribePayload[]>([]);
  useEffect(() => {
    clients = {
      ...clients,
      [id]: {
        topics,
        setter: setSubscribed,
      },
    };
    chooseClient();
    return () => {
      const { [id]: _client, ...rest } = clients;
      clients = rest;
      chooseClient();
    };
  }, [id, topics]);

  const isLive = useMessagePipeline<boolean>(getIsLive);
  useEffect(() => {
    void (async () => {
      const s = await waitService();
      await s.setLive(isLive);
    })();
  }, [isLive]);

  useCurrent<number>({
    topics: subscribed,
    restore: React.useCallback((state: number | undefined): number => {
      if (state == undefined) {
        void service?.clearCurrent();
      }
      return 0;
    }, []),
    addMessages: React.useCallback(
      (_: number | undefined, messages: readonly MessageEvent[]): number => {
        void service?.addCurrent(messages);
        return 1;
      },
      [],
    ),
  });

  const blocks = useBlocks(
    React.useMemo(() => subscribed.map((v) => ({ ...v, preloadType: "full" })), [subscribed]),
  );
  useEffect(() => {
    for (const [index, block] of blocks.entries()) {
      if (R.isEmpty(block)) {
        break;
      }

      // Package any new messages into a single bundle to send to the worker
      const messages: Messages = {};
      const status: BlockStatus = blockStatus[index] ?? {};
      for (const payload of subscribed) {
        const ref = getPayloadString(payload);
        const topicMessages = block[payload.topic];
        if (topicMessages == undefined) {
          continue;
        }

        const numFields = getNumFields(topicMessages);
        if (status[ref] === numFields) {
          continue;
        }

        status[ref] = numFields;
        messages[payload.topic] = topicMessages as MessageEvent[];
      }
      blockStatus[index] = status;

      if (!R.isEmpty(messages)) {
        void service?.addBlock(messages);
      }
    }
  }, [subscribed, blocks]);
}

// Mirror all of the topics and datatypes to the worker as necessary.
function useMetadata() {
  const { topics, datatypes } = useDataSourceInfo();
  useEffect(() => {
    void service?.receiveMetadata(topics, datatypes);
  }, [topics, datatypes]);

  const { globalVariables } = useGlobalVariables();
  useEffect(() => {
    void service?.receiveVariables(globalVariables);
  }, [globalVariables]);
}

/**
 * useDatasets uses a Web Worker to collect, aggregate, and downsample plot
 * data for use by a TimeBasedChart.
 */
export default function useDatasets(params: PlotParams): {
  data: Immutable<PlotData> | undefined;
  provider: TypedDataProvider;
  getFullData: () => Promise<PlotData | undefined>;
} {
  const id = useMemo(() => uuidv4(), []);

  const stableParams = useDeepMemo(params);
  const { xAxisPath, paths: yAxisPaths } = stableParams;

  const allPaths = useMemo(() => {
    return getPaths(yAxisPaths, xAxisPath);
  }, [xAxisPath, yAxisPaths]);

  const stablePaths = useShallowMemo(allPaths);
  const topics = useMemo(() => getPayloadsFromPaths(stablePaths), [stablePaths]);

  useEffect(() => {
    if (worker == undefined) {
      worker = new Worker(
        // foxglove-depcheck-used: babel-plugin-transform-import-meta
        new URL("./useDatasets.worker", import.meta.url),
      );
      service = Comlink.wrap(worker);
      for (const other of pending) {
        other(service);
      }
    }

    numClients++;

    return () => {
      numClients--;
      if (numClients === 0) {
        worker?.terminate();
        worker = service = undefined;
        blockStatus = [];
      }
    };
  }, []);

  useMetadata();

  const [state, setState] = React.useState<Immutable<PlotData> | undefined>();
  useEffect(() => {
    return () => {
      void service?.unregister(id);
    };
  }, [id]);

  useData(id, topics);

  // We also need to send along params on register to avoid a race condition
  const paramsRef = React.useRef<PlotParams>();
  useEffect(() => {
    paramsRef.current = stableParams;
    void service?.updateParams(id, stableParams);
  }, [id, stableParams]);

  const provider: TypedDataProvider = React.useMemo(
    () => ({
      setView: (view) => {
        void service?.updateView(id, view);
      },
      register: (setter, setPartial) => {
        void (async () => {
          const s = await waitService();
          void s.register(
            id,
            Comlink.proxy(setter),
            Comlink.proxy(setState),
            Comlink.proxy(setPartial),
            paramsRef.current,
          );
        })();
      },
    }),
    [id],
  );

  const getFullData = React.useMemo(
    () => async () => {
      const s = await waitService();
      return await s.getFullData(id);
    },
    [id],
  );

  return React.useMemo(
    () => ({
      data: state,
      provider,
      getFullData,
    }),
    [state, provider, getFullData],
  );
}
