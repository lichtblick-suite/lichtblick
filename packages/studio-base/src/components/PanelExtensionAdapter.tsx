// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { CSSProperties, useCallback, useLayoutEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import Logger from "@foxglove/log";
import { MessageEvent, PanelExtensionContext, RenderState, Topic } from "@foxglove/studio";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import {
  useClearHoverValue,
  useHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/HoverValueContext";
import { PlayerState } from "@foxglove/studio-base/players/types";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

const log = Logger.getLogger(__filename);

type PanelExtensionAdapterProps = {
  /** function that initializes the panel extension */
  initPanel: (context: PanelExtensionContext) => void;

  config: unknown;
  saveConfig: SaveConfig<unknown>;

  /** Help document for the panel */
  help?: string;
};

const EmptyTopics: readonly Topic[] = [];

function selectSetSubscriptions(ctx: MessagePipelineContext) {
  return ctx.setSubscriptions;
}

function selectRequestBackfill(ctx: MessagePipelineContext) {
  return ctx.requestBackfill;
}

/**
 * PanelExtensionAdapter renders a panel extension via initPanel
 *
 * The adapter creates a PanelExtensionContext and invokes initPanel using the context.
 */
function PanelExtensionAdapter(props: PanelExtensionAdapterProps): JSX.Element {
  const { initPanel, config, saveConfig } = props;

  // We don't want changes to the config value to re-invoke initPanel in useLayoutEffect
  const configRef = useRef(config);

  const setSubscriptions = useMessagePipeline(selectSetSubscriptions);
  const requestBackfill = useMessagePipeline(selectRequestBackfill);

  const [error, setError] = useState<Error | undefined>();
  const watchedFieldsRef = useRef(new Set<keyof RenderState>());
  const subscribedTopicsRef = useRef(new Set<string>());
  const panelElementRef = useRef<HTMLDivElement>(ReactNull);
  const previousPlayerStateRef = useRef<PlayerState | undefined>(undefined);
  const panelContextRef = useRef<PanelExtensionContext | undefined>(undefined);

  // To avoid updating extended message stores once message pipeline blocks are no longer updating
  // we store a ref to the blocks and only update stores when the ref is different
  const prevBlocksRef = useRef<unknown>(undefined);

  const renderingRef = useRef<boolean>(false);
  const prevRenderState = useRef<RenderState>({});

  const latestPipelineContextRef = useRef<MessagePipelineContext | undefined>(undefined);

  const [slowRender, setSlowRender] = useState(false);

  // we use message pipeline selector to capture updates and don't need to request animation frames
  // multiple times so we gate requesting new message frames
  const rafRequestedRef = useRef(false);

  const hoverValue = useHoverValue({
    componentId: "PanelExtensionAdatper",
    isTimestampScale: true,
  });
  const setHoverValue = useSetHoverValue();
  const clearHoverValue = useClearHoverValue();

  // To avoid re-creating the renderPanel function when hover value changes we put it into a ref
  // It is sufficient for renderPanel to use the latest value when called.
  const hoverValueRef = useRef<typeof hoverValue>();
  hoverValueRef.current = hoverValue;

  const renderPanel = useCallback(() => {
    rafRequestedRef.current = false;

    const ctx = latestPipelineContextRef.current;
    const { current: panelContext } = panelContextRef;
    if (!panelContext || !panelContext.onRender || !ctx) {
      return;
    }

    const playerState = ctx.playerState;
    previousPlayerStateRef.current = playerState;

    if (renderingRef.current) {
      setSlowRender(true);
      return;
    }
    setSlowRender(false);

    // Should render indicates whether any fields of render state are updated
    let shouldRender = false;
    const newRenderState: RenderState = prevRenderState.current;

    if (watchedFieldsRef.current.has("currentFrame")) {
      const currentFrame = playerState.activeData?.messages.filter((messageEvent) => {
        return subscribedTopicsRef.current.has(messageEvent.topic);
      });
      shouldRender = true;
      newRenderState.currentFrame = currentFrame;
    }

    if (watchedFieldsRef.current.has("topics")) {
      const newTopics = playerState.activeData?.topics ?? EmptyTopics;
      if (newTopics !== prevRenderState.current.topics) {
        shouldRender = true;
        newRenderState.topics = newTopics;
      }
    }

    if (watchedFieldsRef.current.has("allFrames")) {
      // see comment for prevBlocksRef on why extended message store updates are gated this way
      const newBlocks = playerState.progress.messageCache?.blocks;
      if (newBlocks && prevBlocksRef.current !== newBlocks) {
        shouldRender = true;
        const frames: MessageEvent<unknown>[] = (newRenderState.allFrames = []);
        for (const block of newBlocks) {
          if (!block) {
            continue;
          }

          for (const messageEvents of Object.values(block.messagesByTopic)) {
            for (const messageEvent of messageEvents) {
              if (!subscribedTopicsRef.current.has(messageEvent.topic)) {
                continue;
              }
              frames.push(messageEvent);
            }
          }
        }
      }
      prevBlocksRef.current = newBlocks;
    }

    if (watchedFieldsRef.current.has("previewTime")) {
      const startTime = ctx.playerState.activeData?.startTime;
      const hoverVal = hoverValueRef.current?.value;

      if (startTime != undefined && hoverVal != undefined) {
        const startStamp = startTime.sec + startTime.nsec / 1e9;
        const stamp = startStamp + hoverVal;
        if (stamp !== newRenderState.previewTime) {
          shouldRender = true;
        }
        newRenderState.previewTime = stamp;
      } else {
        newRenderState.previewTime = undefined;
      }
    }

    if (!shouldRender) {
      return;
    }

    // tell the panel to render and lockout future renders until rendering is complete
    renderingRef.current = true;
    try {
      setError(undefined);
      panelContext.onRender(newRenderState, () => {
        renderingRef.current = false;
      });
    } catch (err) {
      setError(err);
    }
  }, []);

  useMessagePipeline((ctx) => {
    latestPipelineContextRef.current = ctx;

    const { current: panelContext } = panelContextRef;
    if (!panelContext || !panelContext.onRender) {
      return;
    }

    if (rafRequestedRef.current) {
      return;
    }
    rafRequestedRef.current = true;
    requestAnimationFrame(renderPanel);
  });

  useLayoutEffect(() => {
    if (!panelElementRef.current) {
      return;
    }

    const subscriberId = uuid();

    type RenderFn = (renderState: Readonly<RenderState>, done: () => void) => void;
    let renderFn: RenderFn | undefined = undefined;

    const panelExtensionContext: PanelExtensionContext = {
      panelElement: panelElementRef.current,

      initialState: configRef.current,

      saveState: saveConfig,

      setPreviewTime: (stamp: number | undefined) => {
        if (stamp === undefined) {
          clearHoverValue("PanelExtensionAdatper");
        } else {
          const ctx = latestPipelineContextRef.current;
          const startTime = ctx?.playerState.activeData?.startTime;
          // if we don't have a start time we cannot correctly set the playback seconds hover value
          // this hover value needs seconds from start
          if (!startTime) {
            return;
          }
          const secondsFromStart = stamp - startTime.sec + startTime.nsec / 1e9;
          setHoverValue({
            type: "PLAYBACK_SECONDS",
            componentId: "PanelExtensionAdatper",
            value: secondsFromStart,
          });
        }
      },

      watch: (field: keyof RenderState) => {
        watchedFieldsRef.current.add(field);
      },

      subscribe: (topics: string[]) => {
        if (topics.length === 0) {
          return;
        }

        const subscribePayloads = topics.map((topic) => ({ topic }));
        setSubscriptions(subscriberId, subscribePayloads);
        for (const topic of topics) {
          subscribedTopicsRef.current.add(topic);
        }

        requestBackfill();
      },

      unsubscribeAll: () => {
        subscribedTopicsRef.current.clear();
        setSubscriptions(subscriberId, []);
      },

      // eslint-disable-next-line no-restricted-syntax
      get onRender() {
        return renderFn;
      },

      // When a panel sets the render function queue a render
      // eslint-disable-next-line no-restricted-syntax
      set onRender(renderFunction: RenderFn | undefined) {
        renderFn = renderFunction;
        requestAnimationFrame(renderPanel);
      },
    };

    panelContextRef.current = panelExtensionContext;
    log.info(`Init panel ${subscriberId}`);
    initPanel(panelExtensionContext);

    return () => {
      panelContextRef.current = undefined;
      setSubscriptions(subscriberId, []);
    };
  }, [
    clearHoverValue,
    initPanel,
    renderPanel,
    requestBackfill,
    saveConfig,
    setHoverValue,
    setSubscriptions,
  ]);

  const style: CSSProperties = {};
  if (slowRender) {
    style.borderColor = "orange";
    style.borderWidth = "1px";
    style.borderStyle = "solid";
  }

  if (error) {
    throw error;
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", zIndex: 0, ...style }}>
      <PanelToolbar floating helpContent={props.help} />
      <div style={{ width: "100%", height: "100%", overflow: "hidden" }} ref={panelElementRef} />
    </div>
  );
}

export default PanelExtensionAdapter;
