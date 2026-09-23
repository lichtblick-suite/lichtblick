// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Chip, Link } from "@mui/material";
import * as _ from "lodash-es";
import * as React from "react";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import { IRenderer } from "@lichtblick/suite-base/panels/ThreeDeeRender/IRenderer";

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
  chip: {
    backgroundColor: tc(theme.palette.background.paper).setAlpha(0.8).toString(),
  },
  attribution: {
    position: "absolute",
    bottom: 0,
    right: 0,
    maxWidth: "100%",
    padding: theme.spacing(0.25, 0.5),
    fontSize: 10,
    backgroundColor: tc(theme.palette.background.paper).setAlpha(0.85).toString(),
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

  const attributions = notices.filter((item) => item.displayType === "attribution");

  return (
    <>
      <div className={classes.root}>
        {notices
          .filter((item) => item.displayType === "notice")
          .map((item, index) => (
            <Chip className={classes.chip} size="small" key={index} label={item.getMessage()} />
          ))}
      </div>
      {attributions.length > 0 && (
        <div className={classes.attribution}>
          {attributions.map((item) => (
            <div key={item.id}>
              {item.href ? (
                <Link href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.getMessage()}
                </Link>
              ) : (
                item.getMessage()
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
