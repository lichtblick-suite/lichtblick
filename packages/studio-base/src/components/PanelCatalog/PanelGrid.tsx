// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// fil

import { Container } from "@mui/material";
import { useCallback } from "react";
import { makeStyles } from "tss-react/mui";

import { PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";

import { PanelGridCard } from "./PanelGridCard";
import { PanelSelection } from "./types";

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: "grid !important",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: theme.spacing(2),
  },
}));

type Props = {
  filteredPanels: PanelInfo[];
  onPanelSelect: (arg0: PanelSelection) => void;
  searchQuery?: string;
};

export function PanelGrid(props: Props): JSX.Element {
  const { filteredPanels, onPanelSelect, searchQuery = "" } = props;
  const { classes } = useStyles();

  const displayPanelListItem = useCallback(
    (panelInfo: PanelInfo) => {
      const { title, type, config, relatedConfigs } = panelInfo;
      return (
        <PanelGridCard
          key={`${type}-${title}`}
          panel={panelInfo}
          searchQuery={searchQuery}
          onClick={() => {
            onPanelSelect({ type, config, relatedConfigs });
          }}
        />
      );
    },
    [onPanelSelect, searchQuery],
  );

  return (
    <Container className={classes.grid} maxWidth={false}>
      {filteredPanels.map(displayPanelListItem)}
    </Container>
  );
}
