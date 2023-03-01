// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowLeftIcon from "@mui/icons-material/ArrowLeft";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import { Divider, IconButton, Tab, Tabs } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

const useStyles = makeStyles()((theme) => ({
  root: {
    boxSizing: "content-box",
    borderLeft: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  tabs: {
    minHeight: "auto",
    flex: "1 1 auto",
    overflow: "hidden",
    paddingLeft: theme.spacing(0.25),

    ".MuiTabs-indicator": {
      transform: "scaleX(0.5)",
      height: 2,
    },
    ".MuiTab-root": {
      minHeight: 30,
      minWidth: theme.spacing(4),
      padding: theme.spacing(0, 1),
      color: theme.palette.text.secondary,
      fontSize: "0.6875rem",

      "&.Mui-selected": {
        color: theme.palette.text.primary,
      },
    },
  },
  iconButton: {
    fontSize: 20,
    borderRadius: 0,
  },
  tabContent: {
    flex: "auto",
  },
}));

export type NewSidebarItem = {
  title: string;
  component: React.ComponentType;
};

function Noop(): ReactNull {
  return ReactNull;
}

export function NewSidebar<K extends string>({
  items,
  anchor,
  onClose,
  activeTab,
  setActiveTab,
}: {
  items: Map<K, NewSidebarItem>;
  anchor: "right" | "left";
  onClose: () => void;
  activeTab: K | undefined;
  setActiveTab: (newValue: K) => void;
}): JSX.Element {
  const { classes } = useStyles();

  const SelectedComponent = (activeTab != undefined && items.get(activeTab)?.component) || Noop;

  return (
    <Stack className={classes.root} flexShrink={0}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Tabs
          className={classes.tabs}
          textColor="inherit"
          value={activeTab ?? false}
          onChange={(_ev, newValue: K) => {
            if (newValue !== activeTab) {
              setActiveTab(newValue);
            }
          }}
        >
          {Array.from(items.entries(), ([key, item]) => (
            <Tab key={key} label={item.title} value={key} />
          ))}
        </Tabs>

        <IconButton className={classes.iconButton} size="small" onClick={onClose}>
          {anchor === "right" ? (
            <ArrowRightIcon fontSize="inherit" />
          ) : (
            <ArrowLeftIcon fontSize="inherit" />
          )}
        </IconButton>
      </Stack>
      <Divider />
      {activeTab != undefined && (
        <div className={classes.tabContent}>
          <SelectedComponent />
        </div>
      )}
    </Stack>
  );
}
