// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Chip } from "@mui/material";
import * as _ from "lodash-es";
import * as React from "react";
import { makeStyles } from "tss-react/mui";

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { IRenderer } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";

import { HUDItem } from "./HUDItemManager";
import { useRendererProperty } from "./RendererContext";

const useStyles = makeStyles()((theme) => ({
  root: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    display: "flex",
    flexDirection: "column",
    margin: theme.spacing(1),
    overflow: "hidden",
    maxHeight: "100%",
    gap: theme.spacing(1),
  },
  empty: {
    backgroundColor: theme.palette.background.default,
    position: "absolute",
    inset: 0,
  },
}));

type HUDProps = {
  renderer?: IRenderer;
};

export function HUD(props: HUDProps): React.ReactElement {
  const { classes } = useStyles();
  const hudItems: HUDItem[] = useRendererProperty(
    "hudItems",
    "hudItemsChanged",
    () => [],
    props.renderer,
  );

  const [emptyStates, notices] = React.useMemo(
    () => _.partition(hudItems, (i) => i.displayType === "empty"),
    [hudItems],
  );

  if (hudItems.length === 0) {
    return <></>;
  }

  if (emptyStates.length > 0) {
    const highPriorityEmptyState = emptyStates[emptyStates.length - 1]!;
    return <EmptyState className={classes.empty}>{highPriorityEmptyState.getMessage()}</EmptyState>;
  }

  return (
    <div className={classes.root}>
      {notices.map((item, index) => (
        <Chip size="small" key={index} label={item.getMessage()} />
      ))}
    </div>
  );
}
