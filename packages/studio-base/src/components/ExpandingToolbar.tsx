// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ArrowMinimize24Filled } from "@fluentui/react-icons";
import {
  Paper,
  IconButton,
  Tabs,
  Tab,
  svgIconClasses,
  tabClasses,
  tabsClasses,
} from "@mui/material";
import { ReactElement, ReactNode } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

const PANE_HEIGHT = 240;

const useStyles = makeStyles()((theme) => ({
  root: {
    pointerEvents: "auto",
    backgroundColor: theme.palette.background.default,
    width: 280,
  },
  content: {
    position: "relative",
  },
  iconButton: {
    fontSize: "1rem !important",

    [`& svg:not(.${svgIconClasses.root})`]: {
      fontSize: "1rem !important",
    },
  },
  tabs: {
    minHeight: "auto",

    [`.${tabsClasses.indicator}`]: {
      transform: "scaleX(0.75)",
      height: 2,
    },
    [`.${tabClasses.root}`]: {
      minHeight: "auto",
      minWidth: "auto",
      padding: theme.spacing(1, 1.5, 1.125),
      color: theme.palette.text.secondary,

      "&.Mui-selected": {
        color: theme.palette.text.primary,
      },
    },
  },
}));

export function ToolGroup<T>({ children }: { name: T; children: React.ReactElement }): JSX.Element {
  return children;
}

export function ToolGroupFixedSizePane({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Stack padding={1} overflowX="hidden" overflowY="auto" style={{ maxHeight: PANE_HEIGHT }}>
      {children}
    </Stack>
  );
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
  const { classes } = useStyles();
  const expanded = selectedTab != undefined;

  if (!expanded) {
    let selectedTabLocal: T | undefined = selectedTab;
    // default to the first child's name if no tab is selected
    React.Children.forEach(children, (child) => {
      if (selectedTabLocal == undefined) {
        selectedTabLocal = child.props.name as T;
      }
    });

    return (
      <Paper square={false} elevation={4} style={{ pointerEvents: "auto" }}>
        <IconButton
          className={classes.iconButton}
          color={checked === true ? "info" : "default"}
          title={tooltip}
          data-testid={`ExpandingToolbar-${tooltip}`}
          onClick={() => onSelectTab(selectedTabLocal)}
        >
          {icon}
        </IconButton>
      </Paper>
    );
  }
  let selectedChild: ReactElement | undefined;

  React.Children.forEach(children, (child) => {
    if (!selectedChild || child.props.name === selectedTab) {
      selectedChild = child;
    }
  });

  const handleChange = (_event: React.SyntheticEvent, value: T | undefined) => {
    if (value != undefined) {
      onSelectTab(value);
    }
  };

  return (
    <Paper className={classes.root} data-testid={dataTest} square={false} elevation={4}>
      <Paper>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Tabs
            className={classes.tabs}
            textColor="inherit"
            value={selectedTab}
            onChange={handleChange}
          >
            {React.Children.map(children, (child) => (
              <Tab label={child.props.name} value={child.props.name} />
            ))}
          </Tabs>
          <IconButton className={classes.iconButton} onClick={() => onSelectTab(undefined)}>
            <ArrowMinimize24Filled />
          </IconButton>
        </Stack>
      </Paper>
      <div className={classes.content}>{selectedChild}</div>
    </Paper>
  );
}
