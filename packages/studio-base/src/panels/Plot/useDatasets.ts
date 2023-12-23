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
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove/studio-base/components/MessagePipeline";
import { TypedDataProvider } from "@foxglove/studio-base/components/TimeBasedChart/types";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { SubscribePayload, MessageEvent } from "@foxglove/studio-base/players/types";

import {
  DatasetsState,
  getAllSubscriptions,
  getClientPayloads,
  initDatasets,
  registerClient,
  resetClientBlocks,
  resetCurrent,
  splitSubscriptions,
  unregisterClient,
  updateBlocks,
  updateCurrent,
  updateParams,
} from "./clients";
import { PlotParams } from "./internalTypes";
import { PlotData } from "./plotData";

type Service = Comlink.Remote<(typeof import("./useDatasets.worker"))["service"]>;

let worker: Worker | undefined;
let service: Service | undefined;
let numClients: number = 0;
let datasetsState: DatasetsState = initDatasets();
let callbacks: Record<string, (topics: SubscribePayload[]) => void> = {};

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

// Nominate one panel to subscribe to the topics on behalf of the rest.
function chooseClient() {
  if (R.isEmpty(datasetsState.clients)) {
    return;
  }

  const clientList = Object.values(callbacks);
  clientList[0]?.(getAllSubscriptions(datasetsState));
}

function clearClient(id: string) {
  const [newState, update] = resetClientBlocks(id, datasetsState);
  const { current } = newState;
  datasetsState = newState;
  void service?.addBlockData(update);

  const {
    clients: { [id]: client },
  } = newState;
  if (client == undefined) {
    return;
  }

  // Only send the current events that the client can actually use. This also
  // saves us from having to `structuredClone` unused data
  const topics = new Set(R.uniq(getClientPayloads(client).map(({ topic }) => topic)));
  void service?.addCurrentData(
    current.filter(({ topic }) => topics.has(topic)),
    id,
  );
}

// Subscribe to all of the data all plots require and forward it to the worker.
function useData(id: string, params: PlotParams) {
  const [subscriptions, setSubscribed] = React.useState<SubscribePayload[]>([]);
  // Register client when the panel mounts and unregister when it unmounts
  useEffect(() => {
    datasetsState = registerClient(id, datasetsState);
    callbacks[id] = setSubscribed;
    chooseClient();
    return () => {
      datasetsState = unregisterClient(id, datasetsState);
      const { [id]: _client, ...rest } = callbacks;
      callbacks = rest;
      chooseClient();
    };
  }, [id]);

  // Update registration when params change
  useEffect(() => {
    datasetsState = updateParams(id, params, datasetsState);
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
    () => splitSubscriptions(subscriptions),
    [subscriptions],
  );

  useCurrent<number>({
    topics: currentSubscriptions,
    restore: React.useCallback((state: number | undefined): number => {
      if (state == undefined) {
        datasetsState = resetCurrent(datasetsState);
        void service?.clearCurrentData();
      }
      return 0;
    }, []),
    addMessages: React.useCallback(
      (_: number | undefined, messages: readonly MessageEvent[]): number => {
        datasetsState = updateCurrent(messages, datasetsState);
        void service?.addCurrentData(messages);
        return 1;
      },
      [],
    ),
  });

  const blocks = useBlocks(blockSubscriptions);
  useEffect(() => {
    if (blockSubscriptions.length === 0) {
      return;
    }

    const [newState, blockUpdate] = updateBlocks(blocks, datasetsState);
    datasetsState = newState;
    void service?.addBlockData(blockUpdate);
  }, [blockSubscriptions, blocks]);
}

// Mirror all of the topics and datatypes to the worker as necessary.
function useMetadata() {
  const { topics, datatypes } = useDataSourceInfo();
  useEffect(() => {
    void service?.updateMetadata(topics, datatypes);
  }, [topics, datatypes]);

  const { globalVariables } = useGlobalVariables();
  useEffect(() => {
    void service?.updateVariables(globalVariables);
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
      void service.setClearClient(Comlink.proxy(clearClient));
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
      }
    };
  }, []);

  useMetadata();

  const [state, setState] = React.useState<Immutable<PlotData> | undefined>();
  useEffect(() => {
    return () => {
      void service?.unregisterClient(id);
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
          void s.registerClient(
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
