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

import ArrowDownIcon from "@mdi/svg/svg/arrow-down-bold.svg";
import ArrowRightIcon from "@mdi/svg/svg/arrow-right-bold.svg";
import FitToPageIcon from "@mdi/svg/svg/fit-to-page-outline.svg";
import ServiceIcon from "@mdi/svg/svg/ray-end.svg";
import TopicIcon from "@mdi/svg/svg/transit-connection-horizontal.svg";
import Cytoscape from "cytoscape";
import { useCallback, useMemo, useRef, useState } from "react";
import textMetrics from "text-metrics";

import Button from "@foxglove-studio/app/components/Button";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Icon from "@foxglove-studio/app/components/Icon";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import styles from "@foxglove-studio/app/panels/ThreeDimensionalViz/Layout.module.scss";
import colors from "@foxglove-studio/app/styles/colors.module.scss";

import Graph, { GraphMutation } from "./Graph";
import Toolbar from "./Toolbar";
import helpContent from "./index.help.md";

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

  const [lrOrientation, setLROrientation] = useState<boolean>(false);

  const [showTopics, setShowTopics] = useState<boolean>(true);

  const [showServices, setShowServices] = useState<boolean>(true);

  const textMeasure = useMemo(
    () =>
      textMetrics.init({
        fontFamily: "Arial",
        fontSize: "16px",
      }),
    [],
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
      const widthPx = Math.min(LABEL_MAX_WIDTH, textMeasure.width(node));
      output.push({
        style: { width: `${widthPx}px` },
        data: { id: `n:${node}`, label: node, type: "node" },
      });
    }
    if (showTopics) {
      for (const topic of topicIds) {
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

    if (showTopics) {
      if (publishedTopics != undefined) {
        for (const [topic, publishers] of publishedTopics.entries()) {
          for (const node of publishers) {
            const source = `n:${node}`;
            const target = `t:${topic}`;
            output.push({ data: { id: `${source}-${target}`, source, target } });
          }
        }
      }

      if (subscribedTopics != undefined) {
        for (const [topic, subscribers] of subscribedTopics.entries()) {
          for (const node of subscribers) {
            const source = `t:${topic}`;
            const target = `n:${node}`;
            output.push({ data: { id: `${source}-${target}`, source, target } });
          }
        }
      }
    } else {
      if (publishedTopics != undefined && subscribedTopics != undefined) {
        for (const [topic, publishers] of publishedTopics.entries()) {
          for (const pubNode of publishers) {
            const subscribers = subscribedTopics.get(topic);
            if (subscribers != undefined) {
              for (const subNode of subscribers) {
                if (subNode === pubNode) {
                  continue;
                }
                const source = `n:${pubNode}`;
                const target = `n:${subNode}`;
                output.push({ data: { id: `${source}-${target}`, source, target } });
              }
            }
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
  }, [textMeasure, publishedTopics, subscribedTopics, services, showTopics, showServices]);

  const graph = useRef<GraphMutation>();

  const onZoomFit = useCallback(() => {
    graph.current?.fit();
  }, []);

  const toggleOrientation = useCallback(() => {
    graph.current?.resetUserPanZoom();
    setLROrientation(!lrOrientation);
  }, [lrOrientation]);

  const toggleShowTopics = useCallback(() => {
    graph.current?.resetUserPanZoom();
    setShowTopics(!showTopics);
  }, [showTopics]);

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
          <Button tooltip="Zoom Fit" onClick={onZoomFit}>
            <Icon style={{ color: "white" }} small>
              <FitToPageIcon />
            </Icon>
          </Button>
          <Button tooltip="Orientation" onClick={toggleOrientation}>
            <Icon style={{ color: "white" }} small>
              {lrOrientation ? <ArrowRightIcon /> : <ArrowDownIcon />}
            </Icon>
          </Button>
          <Button tooltip={showTopics ? "Hide Topics" : "Show Topics"} onClick={toggleShowTopics}>
            <Icon style={{ color: showTopics ? colors.accent : "white" }} small>
              <TopicIcon />
            </Icon>
          </Button>
          <Button
            tooltip={showServices ? "Hide Services" : "Show Services"}
            onClick={toggleShowServices}
          >
            <Icon style={{ color: showServices ? colors.accent : "white" }} small>
              <ServiceIcon />
            </Icon>
          </Button>
        </div>
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
