// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Pivot, PivotItem, useTheme } from "@fluentui/react";
import ArrowCollapseIcon from "@mdi/svg/svg/arrow-collapse.svg";
import { Paper, IconButton as MuiIconButton, Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { ReactElement, ReactNode } from "react";

import { useTooltip } from "@foxglove/studio-base/components/Tooltip";

const PANE_HEIGHT = 240;

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    position: "relative",
    pointerEvents: "auto",
  },
  rootExpanded: {
    display: "flex",
    flexDirection: "column",
    width: 280,
  },
  icon: {
    fontSize: "1rem !important",

    "& svg:not(.MuiSvgIcon-root)": {
      fontSize: "1rem !important",
    },
  },
  iconCollapse: {
    right: 0,
    top: 0,

    "&.MuiIconButton-root": {
      // doing this because the type will not allow !important
      position: "absolute",

      "&:hover": {
        backgroundColor: "transparent",
      },
    },
  },
  toolGroupFixedSizePanel: {
    overflowX: "hidden",
    overflowY: "auto",
    padding: theme.spacing(1),
    maxHeight: PANE_HEIGHT,
  },
}));

export function ToolGroup<T>({ children }: { name: T; children: React.ReactElement }): JSX.Element {
  return children;
}

export function ToolGroupFixedSizePane({ children }: { children: ReactNode }): JSX.Element {
  const classes = useStyles();
  return <div className={classes.toolGroupFixedSizePanel}>{children}</div>;
}

type Props<T extends string> = {
  checked?: boolean;
  children: React.ReactElement<typeof ToolGroup>[] | React.ReactElement<typeof ToolGroup>;
  icon: ReactNode;
  onSelectTab: (name: T | undefined) => void;
  selectedTab?: T; // collapse the toolbar if selectedTab is undefined
  tooltip: string;
  dataTest?: string;
};

export default function ExpandingToolbar<T extends string>({
  children,
  checked,
  icon,
  onSelectTab,
  selectedTab,
  tooltip,
  dataTest,
}: Props<T>): JSX.Element {
  const classes = useStyles();
  const theme = useTheme();
  const expanded = selectedTab != undefined;

  const expandingToolbarButton = useTooltip({
    contents: tooltip,
  });

  if (!expanded) {
    let selectedTabLocal: T | undefined = selectedTab;
    // default to the first child's name if no tab is selected
    React.Children.forEach(children, (child) => {
      if (selectedTabLocal == undefined) {
        selectedTabLocal = child.props.name as T;
      }
    });

    return (
      <Paper className={classes.root} square={false} elevation={4}>
        {expandingToolbarButton.tooltip}
        <MuiIconButton
          className={classes.icon}
          color={checked === true ? "info" : "default"}
          title={tooltip}
          data-test={`ExpandingToolbar-${tooltip}`}
          onClick={() => onSelectTab(selectedTabLocal)}
        >
          {icon}
        </MuiIconButton>
      </Paper>
    );
  }
  let selectedChild: ReactElement | undefined;

  React.Children.forEach(children, (child) => {
    if (!selectedChild || child.props.name === selectedTab) {
      selectedChild = child;
    }
  });

  return (
    <Paper
      className={cx(classes.root, classes.rootExpanded)}
      data-test={dataTest}
      square={false}
      elevation={4}
    >
      <Pivot
        styles={{
          root: {
            paddingRight: theme.spacing.l2,
          },
          link: {
            fontSize: theme.fonts.small.fontSize,
            marginRight: 0,
            height: 32,
          },
          itemContainer: {
            backgroundColor: theme.semanticColors.bodyBackground,
          },
        }}
      >
        {React.Children.map(children, (child) => {
          return <PivotItem headerText={child.props.name}>{child}</PivotItem>;
        })}
      </Pivot>
      <MuiIconButton
        onClick={() => onSelectTab(undefined)}
        className={cx(classes.icon, classes.iconCollapse)}
      >
        <ArrowCollapseIcon />
      </MuiIconButton>
    </Paper>
  );
}
