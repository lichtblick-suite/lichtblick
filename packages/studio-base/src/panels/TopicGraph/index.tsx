// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { mergeStyleSets } from "@fluentui/react";
import ArrowLeftRightIcon from "@mdi/svg/svg/arrow-left-right.svg";
import ArrowUpDownIcon from "@mdi/svg/svg/arrow-up-down.svg";
import FitToPageIcon from "@mdi/svg/svg/fit-to-page-outline.svg";
import ServiceIcon from "@mdi/svg/svg/rectangle-outline.svg";
import TopicIcon from "@mdi/svg/svg/rhombus.svg";
import Cytoscape from "cytoscape";
import { useCallback, useMemo, useRef, useState } from "react";
import textMetrics from "text-metrics";

import Button from "@foxglove/studio-base/components/Button";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import ExpandingToolbar, { ToolGroup } from "@foxglove/studio-base/components/ExpandingToolbar";
import Icon from "@foxglove/studio-base/components/Icon";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Radio from "@foxglove/studio-base/components/Radio";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import Graph, { GraphMutation } from "./Graph";
import Toolbar from "./Toolbar";
import helpContent from "./index.help.md";

const styles = mergeStyleSets({
  iconButton: {
    backgroundColor: "transparent !important",
    border: "none !important",
    padding: "8px 4px !important",
    alignItems: "start !important",
    marginRight: "4px !important",
    marginLeft: "4px !important",
  },
  buttons: {
    backgroundColor: `${colors.DARK3}`,
    borderRadius: "4px",
    boxShadow: "0 0px 32px rgba(8, 8, 10, 0.6)",
    overflow: "hidden",
    pointerEvents: "auto",
    flexShrink: "0",

    display: "flex",
    flexDirection: "column",
    padding: 0,
    marginBottom: 10,

    "& span.icon": {
      width: 18,
      height: 18,
      fontSize: 18,
      display: "inline-block",
    },
  },
});

const LABEL_MAX_WIDTH = 200;
const STYLESHEET: Cytoscape.Stylesheet[] = [
  {
    selector: "edge",
    style: {
      "target-arrow-shape": "triangle",
      "line-color": "rgb(190, 190, 187)",
      "target-arrow-color": "rgb(190, 190, 187)",
      "curve-style": "bezier",
    },
  },
  {
    selector: 'node[type="node"]',
    style: {
      content: "data(label)",
      shape: "round-rectangle",
      height: "20px",
      "background-color": "#000",
      "border-color": "rgb(69, 165, 255)",
      "border-width": "1px",
      "padding-top": "4px",
      "padding-right": "4px",
      "padding-bottom": "4px",
      "padding-left": "4px",
      "font-size": "16px",
      "text-max-width": `${LABEL_MAX_WIDTH}px`,
      "text-wrap": "ellipsis",
      "text-valign": "center",
      "text-halign": "center",
      color: "rgb(69, 165, 255)",
    },
  },
  {
    selector: 'node[type="topic"]',
    style: {
      content: "data(label)",
      shape: "diamond",
      width: "40px",
      height: "40px",
      "background-color": "rgb(183, 157, 202)",
      "font-size": "16px",
      "text-outline-color": "#000",
      "text-outline-width": "2px",
      color: "#fff",
    },
  },
  {
    selector: 'node[type="service"]',
    style: {
      content: "data(label)",
      shape: "round-rectangle",
      height: "20px",
      "background-color": "#000",
      "border-color": "rgb(255, 107, 130)",
      "border-width": "1px",
      "padding-top": "4px",
      "padding-right": "4px",
      "padding-bottom": "4px",
      "padding-left": "4px",
      "font-size": "16px",
      "text-max-width": "200px",
      "text-wrap": "ellipsis",
      "text-valign": "center",
      "text-halign": "center",
      color: "rgb(255, 107, 130)",
    },
  },
];

export type TopicVisibility =
  | "all"
  | "none"
  | "published"
  | "subscribed"
  | "connected"
  | "disconnected-pub"
  | "disconnected-sub";

const topicVisibilityToLabelMap: Record<TopicVisibility, string> = {
  all: "All topics",
  none: "No topics",
  published: "Published topics",
  subscribed: "Subscribed topics",
  connected: "Connected topics",
  "disconnected-pub": "Disconnected published topics",
  "disconnected-sub": "Disconnected subscribed topics",
};

function unionInto<T>(dest: Set<T>, ...iterables: Set<T>[]): void {
  for (const iterable of iterables) {
    for (const item of iterable) {
      dest.add(item);
    }
  }
}

function TopicGraph() {
  const [selectedTab, setSelectedTab] = useState<"Topics" | undefined>(undefined);

  const publishedTopics = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.publishedTopics, []),
  );

  const subscribedTopics = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.subscribedTopics, []),
  );

  const services = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.services, []),
  );

  const [lrOrientation, setLROrientation] = useState<boolean>(false);
  const [showServices, setShowServices] = useState<boolean>(true);
  const [topicVisibility, setTopicVisibility] = useState<TopicVisibility>("all");

  const textMeasure = useMemo(
    () =>
      textMetrics.init({
        fontFamily: "Arial",
        fontSize: "16px",
      }),
    [],
  );

  const topicPassesConditions = useCallback(
    ({
      topicIdWithSubscriptions,
      topic,
    }: {
      topicIdWithSubscriptions: Set<string>;
      topic: string;
    }): boolean => {
      const publishedTopicsWithFallback = publishedTopics ?? new Map([]);
      const published = publishedTopicsWithFallback.has(topic);
      const subscribed = topicIdWithSubscriptions.has(topic);

      if (topicVisibility === "none") {
        return false;
      }
      return (
        topicVisibility === "all" ||
        (topicVisibility === "published" && published) ||
        (topicVisibility === "subscribed" && subscribed) ||
        (topicVisibility === "connected" && published && subscribed) ||
        (topicVisibility === "disconnected-pub" && published && !subscribed) ||
        (topicVisibility === "disconnected-sub" && subscribed && !published)
      );
    },
    [publishedTopics, topicVisibility],
  );

  const elements = useMemo<cytoscape.ElementDefinition[]>(() => {
    const output: cytoscape.ElementDefinition[] = [];
    const nodeIds = new Set<string>();
    const topicIds = new Set<string>();
    const topicIdWithSubscriptions = new Set<string>();
    const serviceIds = new Set<string>();
    if (publishedTopics != undefined) {
      publishedTopics.forEach((curNodes, topic) => {
        unionInto(nodeIds, curNodes);
        topicIds.add(topic);
      });
    }
    if (subscribedTopics != undefined) {
      subscribedTopics.forEach((curNodes, topic) => {
        unionInto(nodeIds, curNodes);
        topicIds.add(topic);
        topicIdWithSubscriptions.add(topic);
      });
    }
    if (services != undefined) {
      services.forEach((curNodes, topic) => {
        unionInto(nodeIds, curNodes);
        serviceIds.add(topic);
      });
    }

    for (const node of nodeIds) {
      const widthPx = Math.min(LABEL_MAX_WIDTH, textMeasure.width(node));
      output.push({
        style: { width: `${widthPx}px` },
        data: { id: `n:${node}`, label: node, type: "node" },
      });
    }
    if (topicVisibility !== "none") {
      for (const topic of topicIds) {
        if (!topicPassesConditions({ topicIdWithSubscriptions, topic })) {
          continue;
        }
        output.push({
          data: { id: `t:${topic}`, label: topic, type: "topic" },
        });
      }
    }
    if (showServices) {
      for (const service of serviceIds) {
        const widthPx = Math.min(LABEL_MAX_WIDTH, textMeasure.width(service));
        output.push({
          style: { width: `${widthPx}px` },
          data: { id: `s:${service}`, label: service, type: "service" },
        });
      }
    }

    switch (topicVisibility) {
      case "none":
        if (publishedTopics == undefined || subscribedTopics == undefined) {
          break;
        }
        for (const [topic, publishers] of publishedTopics.entries()) {
          for (const pubNode of publishers) {
            for (const subNode of subscribedTopics.get(topic) ?? []) {
              if (subNode === pubNode) {
                continue;
              }
              const source = `n:${pubNode}`;
              const target = `n:${subNode}`;
              output.push({ data: { id: `${source}-${target}`, source, target } });
            }
          }
        }
        break;
      default:
        if (publishedTopics != undefined) {
          for (const [topic, publishers] of publishedTopics.entries()) {
            if (!topicPassesConditions({ topicIdWithSubscriptions, topic })) {
              continue;
            }

            for (const node of publishers) {
              const source = `n:${node}`;
              const target = `t:${topic}`;
              output.push({ data: { id: `${source}-${target}`, source, target } });
            }
          }
        }

        if (subscribedTopics != undefined) {
          for (const [topic, subscribers] of subscribedTopics.entries()) {
            if (!topicPassesConditions({ topicIdWithSubscriptions, topic })) {
              continue;
            }

            for (const node of subscribers) {
              const source = `t:${topic}`;
              const target = `n:${node}`;
              output.push({ data: { id: `${source}-${target}`, source, target } });
            }
          }
        }
    }

    if (showServices && services != undefined) {
      for (const [service, providers] of services.entries()) {
        for (const node of providers) {
          output.push({ data: { source: `n:${node}`, target: `s:${service}` } });
        }
      }
    }

    return output;
  }, [
    textMeasure,
    publishedTopics,
    subscribedTopics,
    services,
    topicVisibility,
    topicPassesConditions,
    showServices,
  ]);

  const graph = useRef<GraphMutation>();

  const onZoomFit = useCallback(() => {
    graph.current?.fit();
  }, []);

  const toggleOrientation = useCallback(() => {
    graph.current?.resetUserPanZoom();
    setLROrientation(!lrOrientation);
  }, [lrOrientation]);

  const topicVisibilityTooltip: string = useMemo(() => {
    return `Showing ${(topicVisibilityToLabelMap[topicVisibility] ?? "").toLowerCase()}`;
  }, [topicVisibility]);

  const topicButtonColor = useMemo(() => {
    return topicVisibility === "none" ? "white" : colors.LIGHT_PURPLE;
  }, [topicVisibility]);

  const toggleShowServices = useCallback(() => {
    graph.current?.resetUserPanZoom();
    setShowServices(!showServices);
  }, [showServices]);

  if (publishedTopics == undefined) {
    return (
      <>
        <PanelToolbar floating helpContent={helpContent} />
        <EmptyState>Waiting for data...</EmptyState>
      </>
    );
  }

  return (
    <>
      <PanelToolbar floating helpContent={helpContent} />
      <Toolbar>
        <div className={styles.buttons}>
          <Button className={styles.iconButton} tooltip="Zoom fit" onClick={onZoomFit}>
            <Icon style={{ color: "white" }} size="small">
              <FitToPageIcon />
            </Icon>
          </Button>
          <Button className={styles.iconButton} tooltip="Orientation" onClick={toggleOrientation}>
            <Icon style={{ color: "white" }} size="small">
              {lrOrientation ? <ArrowLeftRightIcon /> : <ArrowUpDownIcon />}
            </Icon>
          </Button>
          <Button
            className={styles.iconButton}
            tooltip={showServices ? "Showing services" : "Hiding services"}
            onClick={toggleShowServices}
          >
            <Icon style={{ color: showServices ? colors.RED2 : "white" }} size="small">
              <ServiceIcon />
            </Icon>
          </Button>
        </div>
        <ExpandingToolbar
          dataTest="set-topic-visibility"
          tooltip={topicVisibilityTooltip}
          icon={
            <Icon style={{ color: topicButtonColor }}>
              <TopicIcon />
            </Icon>
          }
          className={styles.buttons}
          selectedTab={selectedTab}
          onSelectTab={(newSelectedTab) => {
            setSelectedTab(newSelectedTab);
          }}
        >
          <ToolGroup name="Topics">
            <Radio
              selectedId={topicVisibility}
              onChange={(id) => {
                graph.current?.resetUserPanZoom();
                setTopicVisibility(id as TopicVisibility);
              }}
              options={Object.keys(topicVisibilityToLabelMap).map((id) => ({
                id,
                label: topicVisibilityToLabelMap[id as TopicVisibility] ?? "",
              }))}
            />
          </ToolGroup>
        </ExpandingToolbar>
      </Toolbar>
      <Graph
        style={STYLESHEET}
        elements={elements}
        rankDir={lrOrientation ? "LR" : "TB"}
        graphRef={graph}
      />
    </>
  );
}

TopicGraph.panelType = "TopicGraph";
TopicGraph.defaultConfig = {};

export default Panel(TopicGraph);
