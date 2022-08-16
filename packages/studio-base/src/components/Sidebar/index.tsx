// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Badge, Paper, Tab, Tabs } from "@mui/material";
import {
  ComponentProps,
  PropsWithChildren,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MosaicNode, MosaicWithoutDragDropContext } from "react-mosaic-component";
import { makeStyles } from "tss-react/mui";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { BuiltinIcon } from "@foxglove/studio-base/components/BuiltinIcon";
import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";

import { MemoryUseIndicator } from "./MemoryUseIndicator";
import { TabSpacer } from "./TabSpacer";

function Noop(): ReactNull {
  return ReactNull;
}

export type SidebarItem = {
  iconName: ComponentProps<typeof BuiltinIcon>["name"];
  title: string;
  badge?: { count: number };
  component?: React.ComponentType;
  url?: string;
};

const useStyles = makeStyles()((theme) => ({
  nav: {
    boxSizing: "content-box",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  tabs: {
    flexGrow: 1,
    ".MuiTabs-flexContainerVertical": {
      height: "100%",
    },
  },
  tab: {
    padding: theme.spacing(1.625),
    minWidth: 50,
  },
  badge: {
    "> *:not(.MuiBadge-badge)": {
      width: "1.5rem",
      height: "1.5rem",
      fontSize: "1.5rem",
      display: "flex",

      ".root-span": {
        display: "contents",
      },
      svg: {
        fontSize: "inherit",
        width: "auto",
        height: "auto",
      },
    },
  },
  mosaicWrapper: {
    flex: "1 1 100%",

    // Root drop targets in this top level sidebar mosaic interfere with drag/mouse events from the
    // PanelList. We don't allow users to edit the mosaic since it's just used for the sidebar, so we
    // can hide the drop targets.
    "& > .mosaic > .drop-target-container": {
      display: "none !important",
    },
  },
}));

// Determine initial sidebar width, with a cap for larger
// screens.
function defaultInitialSidebarPercentage() {
  const defaultFraction = 0.3;
  const width = Math.min(384, defaultFraction * window.innerWidth);
  return (100 * width) / window.innerWidth;
}

type SidebarProps<K> = PropsWithChildren<{
  items: Map<K, SidebarItem>;
  bottomItems: Map<K, SidebarItem>;
  selectedKey: K | undefined;
  onSelectKey: (key: K | undefined) => void;
}>;

export default function Sidebar<K extends string>(props: SidebarProps<K>): JSX.Element {
  const { children, items, bottomItems, selectedKey, onSelectKey } = props;
  const [enableMemoryUseIndicator = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_MEMORY_USE_INDICATOR,
  );
  const [mosaicValue, setMosaicValue] = useState<MosaicNode<"sidebar" | "children">>("children");
  const { classes } = useStyles();
  const prevSelectedKey = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    if (prevSelectedKey.current !== selectedKey) {
      if (selectedKey == undefined) {
        setMosaicValue("children");
      } else if (prevSelectedKey.current == undefined) {
        setMosaicValue({
          direction: "row",
          first: "sidebar",
          second: "children",
          splitPercentage: defaultInitialSidebarPercentage(),
        });
      }
      prevSelectedKey.current = selectedKey;
    }
  }, [selectedKey]);

  const allItems = useMemo(() => {
    return new Map([...items, ...bottomItems]);
  }, [bottomItems, items]);

  const SelectedComponent =
    (selectedKey != undefined && allItems.get(selectedKey)?.component) || Noop;

  const onClickTabAction = useCallback(
    (key: K) => {
      // toggle tab selected/unselected on click
      if (selectedKey === key) {
        onSelectKey(undefined);
      } else {
        onSelectKey(key);
      }
    },
    [selectedKey, onSelectKey],
  );

  const topTabs = useMemo(() => {
    return [...items.entries()].map(([key, item]) => (
      <Tab
        data-sidebar-key={key}
        className={classes.tab}
        value={key}
        key={key}
        title={item.title}
        onClick={() => onClickTabAction(key)}
        icon={
          <Badge
            className={classes.badge}
            badgeContent={item.badge?.count}
            invisible={item.badge == undefined}
            color="error"
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
          >
            <BuiltinIcon name={item.iconName} />
          </Badge>
        }
      />
    ));
  }, [classes, items, onClickTabAction]);

  const bottomTabs = useMemo(() => {
    return [...bottomItems.entries()].map(([key, item]) => (
      <Tab
        className={classes.tab}
        value={key}
        key={key}
        title={item.title}
        onClick={() => onClickTabAction(key)}
        icon={
          <Badge
            className={classes.badge}
            badgeContent={item.badge?.count}
            invisible={item.badge == undefined}
            color="error"
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
          >
            <BuiltinIcon name={item.iconName} />
          </Badge>
        }
      />
    ));
  }, [bottomItems, classes, onClickTabAction]);

  return (
    <Stack direction="row" fullHeight overflow="hidden">
      <Stack className={classes.nav} flexShrink={0} justifyContent="space-between">
        <Tabs
          className={classes.tabs}
          orientation="vertical"
          variant="scrollable"
          value={selectedKey ?? false}
          scrollButtons={false}
        >
          {topTabs}
          <TabSpacer />
          {bottomTabs}
          {enableMemoryUseIndicator && <MemoryUseIndicator />}
        </Tabs>
      </Stack>
      {
        // By always rendering the mosaic, even if we are only showing children, we can prevent the
        // children from having to re-mount each time the sidebar is opened/closed.
      }
      <div className={classes.mosaicWrapper}>
        <MosaicWithoutDragDropContext<"sidebar" | "children">
          className=""
          value={mosaicValue}
          onChange={(value) => value != undefined && setMosaicValue(value)}
          renderTile={(id) => (
            <ErrorBoundary>
              {id === "children" ? (
                (children as JSX.Element)
              ) : (
                <Paper square elevation={0}>
                  <SelectedComponent />
                </Paper>
              )}
            </ErrorBoundary>
          )}
          resize={{ minimumPaneSizePercentage: 10 }}
        />
      </div>
    </Stack>
  );
}
