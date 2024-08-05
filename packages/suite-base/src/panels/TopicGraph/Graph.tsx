// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Cytoscape from "cytoscape";
import CytoscapeDagre from "cytoscape-dagre";
import { MutableRefObject, useEffect, useRef } from "react";

Cytoscape.use(CytoscapeDagre);
Cytoscape.warnings(false);

const DAG_LAYOUT = {
  name: "dagre",
  fit: false,
  nodesep: 20,
  rankDir: "TB",
  ranker: "longest-path",
};

export interface GraphMutation {
  fit: () => void;
  resetUserPanZoom: () => void;
}

type Props = {
  style: Cytoscape.Stylesheet[];
  elements: cytoscape.ElementDefinition[];
  rankDir: string;
  graphRef: MutableRefObject<GraphMutation | undefined>;
};

export default function Graph(props: Props): JSX.Element {
  const cy = useRef<Cytoscape.Core>();
  const graphRef = useRef<HTMLDivElement>(ReactNull);

  // indicates that a user has manually panned/zoomed the viewport
  // we avoid performing actions like automatic fit when this happens.
  const userPanZoom = useRef<boolean>(false);

  useEffect(() => {
    if (!graphRef.current) {
      throw new Error("Graph ref must be available on first render");
    }

    cy.current = Cytoscape({
      container: graphRef.current,
      zoom: 0.7,
    });

    cy.current.on("viewport", () => {
      userPanZoom.current = true;
    });

    props.graphRef.current = {
      fit: () => {
        userPanZoom.current = false;
        cy.current?.fit();
      },
      resetUserPanZoom: () => {
        userPanZoom.current = false;
      },
    };

    return () => {
      cy.current?.destroy();
    };
  }, [props.graphRef]);

  const { elements, rankDir } = props;
  useEffect(() => {
    if (!cy.current) {
      return;
    }

    cy.current.batch(() => {
      cy.current?.elements().remove();
      cy.current?.add(elements);
      cy.current
        ?.elements()
        .makeLayout({ ...DAG_LAYOUT, rankDir } as unknown as Cytoscape.LayoutOptions)
        .run();
    });

    if (!userPanZoom.current) {
      cy.current.fit();
    }
  }, [elements, rankDir]);

  useEffect(() => {
    cy.current?.style(props.style);
  }, [props.style]);

  return <div ref={graphRef} style={{ width: "100%", height: "100%" }} />;
}
