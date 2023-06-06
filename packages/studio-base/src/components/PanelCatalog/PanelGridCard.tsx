// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Card, CardActionArea, CardContent, CardMedia, Typography } from "@mui/material";
import { useCallback } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import TextHighlight from "@foxglove/studio-base/components/TextHighlight";
import { PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";

const useStyles = makeStyles()((theme) => {
  return {
    fullHeight: {
      height: "100%",
    },
    imagePlaceholder: {
      paddingBottom: `${(200 / 280) * 100}%`,
      backgroundColor: theme.palette.background.default,
    },
    cardContent: {
      flex: "auto",
    },
  };
});

type Props = {
  panel: PanelInfo;
  searchQuery: string;
  onClick: () => void;
};

export function PanelGridCard(props: Props): JSX.Element {
  const { searchQuery, panel, onClick } = props;
  const { classes } = useStyles();

  const targetString = panel.extensionNamespace
    ? `${panel.title} [${panel.extensionNamespace}]`
    : panel.title;

  const onClickWithStopPropagation = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onClick();
    },
    [onClick],
  );

  return (
    <Card className={classes.fullHeight}>
      <CardActionArea onClick={onClickWithStopPropagation} className={classes.fullHeight}>
        <Stack fullHeight>
          {panel.thumbnail != undefined ? (
            <CardMedia component="img" image={panel.thumbnail} alt={panel.title} />
          ) : (
            <div className={classes.imagePlaceholder} />
          )}
          <CardContent className={classes.cardContent}>
            <Typography variant="subtitle2" gutterBottom>
              <span data-testid={`panel-menu-item ${panel.title}`}>
                <TextHighlight targetStr={targetString} searchText={searchQuery} />
              </span>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <TextHighlight targetStr={panel.description ?? ""} searchText={searchQuery} />
            </Typography>
          </CardContent>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
