// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Cytoscape from "cytoscape";
import { MutableRefObject, createRef } from "react";

import { GraphMutation } from "@lichtblick/suite-base/panels/TopicGraph/Graph";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

type GraphProps = {
  style: Cytoscape.StylesheetStyle[];
  elements: cytoscape.ElementDefinition[];
  rankDir: string;
  graphRef: MutableRefObject<GraphMutation | undefined>;
};

export default class GraphBuilder {
  public static element(
    props: Partial<cytoscape.ElementDefinition> = {},
  ): cytoscape.ElementDefinition {
    return defaults<cytoscape.ElementDefinition>(props, {
      data: { id: BasicBuilder.string(), label: BasicBuilder.string() },
    });
  }

  public static elements(count = 2): cytoscape.ElementDefinition[] {
    return BasicBuilder.multiple(GraphBuilder.element, count);
  }

  public static stylesheetStyle(
    props: Partial<Cytoscape.StylesheetStyle> = {},
  ): Cytoscape.StylesheetStyle {
    return defaults<Cytoscape.StylesheetStyle>(props, {
      selector: BasicBuilder.string(),
      style: {},
    });
  }

  public static stylesheetStyles(count = 2): Cytoscape.StylesheetStyle[] {
    return BasicBuilder.multiple(GraphBuilder.stylesheetStyle, count);
  }

  public static props(props: Partial<GraphProps> = {}): GraphProps {
    return defaults<GraphProps>(props, {
      style: GraphBuilder.stylesheetStyles(),
      elements: GraphBuilder.elements(),
      rankDir: BasicBuilder.sample(["TB", "LR"]),
      graphRef: createRef() as MutableRefObject<GraphMutation | undefined>,
    });
  }
}
