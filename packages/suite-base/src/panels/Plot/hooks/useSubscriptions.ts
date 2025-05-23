// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect } from "react";

import { filterMap } from "@lichtblick/den/collection";
import { parseMessagePath } from "@lichtblick/message-path";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import { SubscriptionPreloadType } from "@lichtblick/suite-base/players/types";

import { isReferenceLinePlotPathType } from "../utils/config";
import { pathToSubscribePayload } from "../utils/subscription";

const useSubscriptions = (config: PlotConfig, subscriberId: string): void => {
  const { paths, xAxisVal } = config;
  const { globalVariables } = useGlobalVariables();

  const setSubscriptions = useMessagePipeline(
    useCallback(
      ({ setSubscriptions: pipelineSetSubscriptions }: MessagePipelineContext) =>
        pipelineSetSubscriptions,
      [],
    ),
  );

  // We could subscribe in the chart renderer, but doing it with react effects is easier for
  // managing the lifecycle of the subscriptions. The renderer will correlate input message data to
  // the correct paths/series.
  useEffect(() => {
    // The index and currentCustom modes only need the latest message on each topic so we use
    // partial subscribe mode for those to avoid preloading data that we don't need
    const preloadType: SubscriptionPreloadType =
      xAxisVal === "index" || xAxisVal === "currentCustom" ? "partial" : "full";

    const subscriptions = filterMap(paths, (item) => {
      if (isReferenceLinePlotPathType(item)) {
        return;
      }

      const parsedPath = parseMessagePath(item.value);
      if (!parsedPath) {
        return;
      }

      return pathToSubscribePayload(
        fillInGlobalVariablesInPath(parsedPath, globalVariables),
        preloadType,
      );
    });

    if ((xAxisVal === "custom" || xAxisVal === "currentCustom") && config.xAxisPath?.value) {
      const parsedPath = parseMessagePath(config.xAxisPath.value);
      if (parsedPath) {
        const xAxisSub = pathToSubscribePayload(
          fillInGlobalVariablesInPath(parsedPath, globalVariables),
          preloadType,
        );
        if (xAxisSub) {
          subscriptions.push(xAxisSub);
        }
      }
    }

    setSubscriptions(subscriberId, subscriptions);
  }, [config, xAxisVal, paths, globalVariables, setSubscriptions, subscriberId]);

  // Only unsubscribe on unmount so that when the above subscriber effect dependencies change we
  // don't transition to unsubscribing all to then re-subscribe.
  useEffect(() => {
    return () => {
      setSubscriptions(subscriberId, []);
    };
  }, [subscriberId, setSubscriptions]);
};

export default useSubscriptions;
