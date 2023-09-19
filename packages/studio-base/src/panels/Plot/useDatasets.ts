// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";
import * as R from "ramda";
import { useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

import { useDeepMemo } from "@foxglove/hooks";
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
import { mergeSubscriptions } from "@foxglove/studio-base/components/MessagePipeline/subscriptions";
import { TypedDataProvider } from "@foxglove/studio-base/components/TimeBasedChart/types";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { SubscribePayload, MessageEvent } from "@foxglove/studio-base/players/types";

import { PlotParams, Messages } from "./internalTypes";
import { getPaths, isSingleMessage, isBounded } from "./params";
import { PlotData } from "./plotData";

type Service = Comlink.Remote<(typeof import("./useDatasets.worker"))["service"]>;

// We need to keep track of the block data we've already sent to the worker and
// detect when it has changed, which can happen when the user changes a user
// script or they trigger a subscription to different fields.
// mapping from topic -> the first message on that topic in the block
type BlockStatus = Record<string, unknown>;
type Client = {
  params: PlotParams | undefined;
  setter: (topics: SubscribePayload[]) => void;
};

let worker: Worker | undefined;
let service: Service | undefined;
let numClients: number = 0;
let blockStatus: BlockStatus[] = [];
let lastBlockSent: Record<string, number> = {};
let clients: Record<string, Client> = {};

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

const getPayloadString = (payload: SubscribePayload): string =>
  `${payload.topic}:${(payload.fields ?? []).join(",")}`;

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
    (v: SubscribePayload[]) => mergeSubscriptions(v) as SubscribePayload[],
  )(paths);
}

// Calculate the list of unique topics that _all_ of the plots need and
// nominate one panel to subscribe to the topics on behalf of the rest.
function chooseClient() {
  if (R.isEmpty(clients)) {
    return;
  }

  const clientList = R.values(clients);
  const subscriptions = R.pipe(
    R.chain((client: Client): SubscribePayload[] => {
      const { params } = client;
      if (params == undefined) {
        return [];
      }

      const { xAxisPath, paths: yAxisPaths } = params;

      const isOnlyCurrent = isBounded(params) || isSingleMessage(params);
      return R.pipe(
        getPayloadsFromPaths,
        R.chain((v): SubscribePayload[] => {
          const partial: SubscribePayload = {
            ...v,
            preloadType: "partial",
          };

          if (isOnlyCurrent) {
            return [partial];
          }

          // Subscribe to both "partial" and "full" when using "full" In
          // theory, "full" should imply "partial" but not doing this breaks
          // MockMessagePipelineProvider
          return [partial, { ...partial, preloadType: "full" }];
        }),
      )(getPaths(yAxisPaths, xAxisPath));
    }),
    (v) => mergeSubscriptions(v) as SubscribePayload[],
  )(clientList);
  clientList[0]?.setter(subscriptions);

  const blockTopics = R.pipe(
    R.filter((v: SubscribePayload) => v.preloadType === "full"),
    R.map(getPayloadString),
  )(subscriptions);

  // Also clear the status of any topics we're no longer using
  blockStatus = blockStatus.map((block) => R.pick(blockTopics, block));
  lastBlockSent = R.pick(blockTopics, lastBlockSent);
}

// Subscribe to "current" messages (those near the seek head) and forward new
// messages to the worker as they arrive.
function useData(id: string, params: PlotParams) {
  const [subscriptions, setSubscribed] = React.useState<SubscribePayload[]>([]);
  // Register client when the panel mounts and unregister when it unmounts
  useEffect(() => {
    clients = {
      ...clients,
      [id]: {
        params: undefined,
        setter: setSubscribed,
      },
    };
    chooseClient();
    return () => {
      const { [id]: _client, ...rest } = clients;
      clients = rest;
      chooseClient();
    };
  }, [id]);

  // Update registration when params change
  useEffect(() => {
    const { [id]: client } = clients;
    if (client == undefined) {
      return;
    }

    clients = {
      ...clients,
      [id]: { ...client, params },
    };
    chooseClient();
  }, [id, params]);

  const isLive = useMessagePipeline<boolean>(getIsLive);
  useEffect(() => {
    void (async () => {
      const s = await waitService();
      await s.setLive(isLive);
    })();
  }, [isLive]);

  const [blockSubscriptions, currentSubscriptions] = React.useMemo(
    () => R.partition((v) => v.preloadType === "full", subscriptions),
    [subscriptions],
  );

  useCurrent<number>({
    topics: currentSubscriptions,
    restore: React.useCallback((state: number | undefined): number => {
      if (state == undefined) {
        void service?.clearCurrent();
      }
      return 0;
    }, []),
    addMessages: React.useCallback(
      (_: number | undefined, messages: readonly MessageEvent[]): number => {
        void service?.addCurrent(
          messages.map((event) => {
            const { message } = event;

            // Handle LazyMessageReader messages, which cannot be
            // `postMessage`d otherwise
            // https://github.com/foxglove/rosmsg-serialization/blob/2c15caf4f344012737f5aab01103e3c525889f2e/src/__snapshots__/LazyMessageReader.test.ts.snap#L304
            if (
              typeof message === "object" &&
              message != undefined &&
              "toObject" in message &&
              typeof message.toObject === "function"
            ) {
              return {
                ...event,
                message: (message as { toObject: () => unknown }).toObject(),
              };
            }
            return event;
          }),
        );
        return 1;
      },
      [],
    ),
  });

  const blocks = useBlocks(blockSubscriptions);
  useEffect(() => {
    for (const [index, block] of blocks.entries()) {
      if (R.isEmpty(block)) {
        continue;
      }

      // Package any new messages into a single bundle to send to the worker
      const messages: Messages = {};
      // Make a note of any topics that had new data so we can clear out
      // accumulated points in the worker
      const resetData: Set<string> = new Set<string>();
      const status: BlockStatus = blockStatus[index] ?? {};
      for (const payload of blockSubscriptions) {
        const ref = getPayloadString(payload);
        const topicMessages = block[payload.topic];
        if (topicMessages == undefined) {
          continue;
        }

        const first = topicMessages[0]?.message;
        const existing = status[ref];

        // keep track of the block index that we last sent; if there's a new
        // change BEFORE that index, we need to reset the plot data; otherwise
        // we do not
        const lastSent = lastBlockSent[ref];
        if (R.equals(existing, first)) {
          continue;
        }

        // we already had a message in this block, meaning the data itself has
        // changed; we have to rebuild the plots
        if (existing != undefined && lastSent != undefined && index < lastSent) {
          resetData.add(payload.topic);
        }

        status[ref] = first;
        messages[payload.topic] = topicMessages as MessageEvent[];
        lastBlockSent[ref] = index;
      }
      blockStatus[index] = status;

      if (R.isEmpty(messages)) {
        continue;
      }

      void service?.addBlock(messages, Array.from(resetData));
    }
  }, [blockSubscriptions, blocks]);
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

  useData(id, stableParams);

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
