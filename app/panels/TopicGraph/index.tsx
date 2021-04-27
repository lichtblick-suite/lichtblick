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

import FitToPageIcon from "@mdi/svg/svg/fit-to-page-outline.svg";
import Cytoscape from "cytoscape";
import CytoscapeCola from "cytoscape-cola";
import CytoscapeDagre from "cytoscape-dagre";
import { useCallback, useMemo, useRef } from "react";

import Button from "@foxglove-studio/app/components/Button";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Icon from "@foxglove-studio/app/components/Icon";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";

import Graph, { GraphMutation } from "./Graph";
import Toolbar from "./Toolbar";
import helpContent from "./index.help.md";

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
      width: "label",
      height: "label",
      "background-color": "#000",
      "border-color": "rgb(69, 165, 255)",
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
      color: "rgb(69, 165, 255)",
    },
  },
  {
    selector: 'node[type="topic"]',
    style: {
      content: "data(label)",
      shape: "diamond",
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
      width: "label",
      height: "label",
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

/*
const DCG_LAYOUT = ({
  name: "cola",
  fit: true,
  animate: true,
  refresh: 1,
  maxSimulationTime: 1000,
  nodeDimensionsIncludeLabels: true,
  avoidOverlap: true,
  handleDisconnected: true,
} as unknown) as Cytoscape.LayoutOptions;
*/

Cytoscape.use(CytoscapeCola);
Cytoscape.use(CytoscapeDagre);

function unionInto<T>(dest: Set<T>, ...iterables: Set<T>[]): void {
  for (const iterable of iterables) {
    for (const item of iterable) {
      dest.add(item);
    }
  }
}

function TopicGraph() {
  const publishedTopics = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.publishedTopics, []),
  );

  const subscribedTopics = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.subscribedTopics, []),
  );

  const services = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.services, []),
  );

  const elements = useMemo<cytoscape.ElementDefinition[]>(() => {
    const output: cytoscape.ElementDefinition[] = [];
    const nodeIds = new Set<string>();
    const topicIds = new Set<string>();
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
      });
    }
    if (services != undefined) {
      services.forEach((curNodes, topic) => {
        unionInto(nodeIds, curNodes);
        serviceIds.add(topic);
      });
    }

    for (const node of nodeIds) {
      output.push({ data: { id: `n:${node}`, label: node, type: "node" } });
    }
    for (const topic of topicIds) {
      output.push({ data: { id: `t:${topic}`, label: topic, type: "topic" } });
    }
    for (const service of serviceIds) {
      output.push({ data: { id: `s:${service}`, label: service, type: "service" } });
    }

    if (publishedTopics != undefined) {
      for (const [topic, publishers] of publishedTopics.entries()) {
        for (const node of publishers) {
          output.push({ data: { source: `n:${node}`, target: `t:${topic}` } });
        }
      }
    }

    if (subscribedTopics != undefined) {
      for (const [topic, subscribers] of subscribedTopics.entries()) {
        for (const node of subscribers) {
          output.push({ data: { source: `t:${topic}`, target: `n:${node}` } });
        }
      }
    }

    if (services != undefined) {
      for (const [service, providers] of services.entries()) {
        for (const node of providers) {
          output.push({ data: { source: `n:${node}`, target: `s:${service}` } });
        }
      }
    }

    return output;
  }, [publishedTopics, subscribedTopics, services]);

  const graph = useRef<GraphMutation>();

  const onZoomFit = useCallback(() => {
    graph.current?.fit();
  }, []);

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
        <Button tooltip="Zoom Fit" onClick={onZoomFit}>
          <Icon style={{ color: "white" }} small>
            <FitToPageIcon />
          </Icon>
        </Button>
      </Toolbar>
      <Graph style={STYLESHEET} elements={elements} graphRef={graph} />
    </>
  );
}

TopicGraph.panelType = "TopicGraph";
TopicGraph.defaultConfig = {};

export default Panel(TopicGraph);
