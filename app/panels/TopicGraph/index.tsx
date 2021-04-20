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

import Cytoscape from "cytoscape";
import CytoscapeCola from "cytoscape-cola";
import CytoscapeDagre from "cytoscape-dagre";
import { useCallback, useMemo } from "react";
import CytoscapeComponent from "react-cytoscapejs";

import EmptyState from "@foxglove-studio/app/components/EmptyState";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";

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

const DAG_LAYOUT = ({
  name: "dagre",
  fit: true,
  rankDir: "LR",
} as unknown) as Cytoscape.LayoutOptions;

// const DCG_LAYOUT = ({
//   name: "cola",
//   fit: true,
//   animate: true,
//   refresh: 1,
//   maxSimulationTime: 1000,
//   nodeDimensionsIncludeLabels: true,
//   avoidOverlap: true,
//   handleDisconnected: true,
// } as unknown) as Cytoscape.LayoutOptions;

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
  const { publishedTopics, subscribedTopics, services } = useMessagePipeline(
    useCallback(
      ({ playerState: { activeData } }) =>
        activeData
          ? {
              publishedTopics: activeData.publishedTopics,
              subscribedTopics: activeData.subscribedTopics,
              services: activeData.services,
            }
          : { publishedTopics: undefined, subscribedTopics: undefined, services: undefined },
      [],
    ),
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
      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "100%" }}
        stylesheet={STYLESHEET}
        zoom={0.7}
        layout={DAG_LAYOUT} // TODO: Detect cycles in the graph and switch to DCG_LAYOUT
      ></CytoscapeComponent>
    </>
  );
}

TopicGraph.panelType = "TopicGraph";
TopicGraph.defaultConfig = {};

export default Panel(TopicGraph);
