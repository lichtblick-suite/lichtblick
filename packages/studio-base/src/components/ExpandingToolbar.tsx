// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Pivot,
  PivotItem,
  Stack,
  IconButton,
  makeStyles,
  useTheme,
  IButtonStyles,
} from "@fluentui/react";
import { ReactElement, useMemo } from "react";

import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const PANE_HEIGHT = 240;

const useStyles = makeStyles((theme) => ({
  toolGroupFixedSizePanel: {
    overflowX: "hidden",
    overflowY: "auto",
    padding: theme.spacing.s1,
    maxHeight: PANE_HEIGHT,
  },
}));

export function ToolGroup<T>({ children }: { name: T; children: React.ReactElement }): JSX.Element {
  return children;
}

export function ToolGroupFixedSizePane({
  children,
}: {
  children: React.ReactElement | React.ReactElement[];
}): JSX.Element {
  const classes = useStyles();
  return <div className={classes.toolGroupFixedSizePanel}>{children}</div>;
}

type Props<T extends string> = {
  checked?: boolean;
  children: React.ReactElement<typeof ToolGroup>[] | React.ReactElement<typeof ToolGroup>;
  iconName: RegisteredIconNames;
  onSelectTab: (name: T | undefined) => void;
  selectedTab?: T; // collapse the toolbar if selectedTab is undefined
  tooltip: string;
  dataTest?: string;
};

export default function ExpandingToolbar<T extends string>({
  children,
  checked,
  iconName,
  onSelectTab,
  selectedTab,
  tooltip,
  dataTest,
}: Props<T>): JSX.Element {
  const theme = useTheme();
  const expanded = selectedTab != undefined;

  const expandingToolbarButton = useTooltip({
    contents: tooltip,
  });

  const iconStyles = useMemo<Partial<IButtonStyles>>(
    () => ({
      iconChecked: { color: colors.ACCENT },
      icon: {
        color: theme.semanticColors.buttonText,

        svg: {
          fill: "currentColor",
          height: "1em",
          width: "1em",
        },
      },
    }),
    [theme.semanticColors.buttonText],
  );

  if (!expanded) {
    let selectedTabLocal: T | undefined = selectedTab;
    // default to the first child's name if no tab is selected
    React.Children.forEach(children, (child) => {
      if (selectedTabLocal == undefined) {
        selectedTabLocal = child.props.name as T;
      }
    });

    return (
      <div>
        {expandingToolbarButton.tooltip}
        <IconButton
          checked={checked}
          elementRef={expandingToolbarButton.ref}
          onClick={() => onSelectTab(selectedTabLocal)}
          iconProps={{ iconName }}
          data-test={`ExpandingToolbar-${tooltip}`}
          styles={{
            root: {
              backgroundColor: theme.semanticColors.buttonBackgroundHovered,
              pointerEvents: "auto",
            },
            rootHovered: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
            rootPressed: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
            rootDisabled: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
            rootChecked: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
            rootCheckedHovered: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
            rootCheckedPressed: { backgroundColor: theme.semanticColors.buttonBackgroundHovered },
            ...iconStyles,
          }}
        />
      </div>
    );
  }
  let selectedChild: ReactElement | undefined;

  React.Children.forEach(children, (child) => {
    if (!selectedChild || child.props.name === selectedTab) {
      selectedChild = child;
    }
  });

  return (
    <Stack
      data-test={dataTest}
      styles={{
        root: {
          position: "relative",
          pointerEvents: "auto",
          backgroundColor: theme.semanticColors.buttonBackgroundHovered,
          borderRadius: theme.effects.roundedCorner4,
          width: 280,
        },
      }}
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
      <IconButton
        onClick={() => onSelectTab(undefined)}
        iconProps={{ iconName: "ArrowCollapse" }}
        styles={{
          root: {
            backgroundColor: "transparent",
            position: "absolute",
            right: 0,
            top: 0,
          },
          rootHovered: { backgroundColor: "transparent" },
          rootPressed: { backgroundColor: "transparent" },
          rootDisabled: { backgroundColor: "transparent" },
          ...iconStyles,
        }}
      />
    </Stack>
  );
}
