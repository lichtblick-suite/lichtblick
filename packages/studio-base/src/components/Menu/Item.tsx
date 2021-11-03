// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { makeStyles } from "@fluentui/react";
import CheckCircleIcon from "@mdi/svg/svg/check-circle.svg";
import CheckIcon from "@mdi/svg/svg/check.svg";
import ChevronLeftIcon from "@mdi/svg/svg/chevron-left.svg";
import ChevronRightIcon from "@mdi/svg/svg/chevron-right.svg";
import cx from "classnames";
import { noop } from "lodash";

import Icon, { IconSize } from "@foxglove/studio-base/components/Icon";
import Tooltip from "@foxglove/studio-base/components/Tooltip";

const useStyles = makeStyles((theme) => ({
  contentWrapper: {
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  item: {
    textDecoration: "none",
    padding: "8px 16px",
    cursor: "pointer",
    color: theme.semanticColors.menuItemText,
    userSelect: "none",
    display: "flex",
    alignItems: "center",

    ":hover": {
      color: theme.semanticColors.menuItemTextHovered,
      backgroundColor: theme.semanticColors.menuItemBackgroundHovered,
    },
    "&.hoverForScreenshots": {
      color: theme.semanticColors.menuItemTextHovered,
      backgroundColor: theme.semanticColors.menuItemBackgroundHovered,
    },
  },
  itemActive: {
    color: theme.semanticColors.menuItemText,
    backgroundColor: theme.semanticColors.menuItemBackgroundPressed,
  },
  itemDisabled: {
    color: theme.semanticColors.disabledText,
    cursor: "not-allowed",

    ":hover": {
      backgroundColor: "transparent",
      color: theme.semanticColors.disabledText,
    },
  },
  itemHeader: {
    textTransform: "uppercase",
    opacity: 0.6,
    fontSize: 11,
    letterSpacing: "1px",
    paddingTop: 16,

    "&:hover": {
      cursor: "default",
      backgroundColor: "inherit",
      opacity: 0.5,
    },
  },
  submenuIcon: {
    width: 16,
    height: 16,
    flex: "none",
    fill: "currentColor",
    opacity: 0.6,
    position: "relative",
  },
  submenuIconLeft: {
    right: 6,
  },
  icon: {
    marginRight: 12,
    fontSize: 14,
    verticalAlign: "middle",
  },
}));

type ItemProps = {
  className?: string;
  isHeader?: boolean;
  checked?: boolean;
  highlighted?: boolean;
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconSize?: IconSize;
  isDropdown?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  hasSubMenu?: boolean;
  direction?: "left" | "right";
  dataTest?: string;
  style?: {
    [attr: string]: string | number;
  };
  hoverForScreenshots?: boolean;
};

const Item = (props: ItemProps): JSX.Element => {
  const classes = useStyles();
  const {
    className = "",
    isHeader = false,
    checked = false,
    highlighted = false,
    children,
    icon,
    iconSize = "small",
    isDropdown = false,
    onClick,
    disabled = false,
    hasSubMenu = false,
    direction = "left",
    tooltip,
    dataTest,
    style,
    hoverForScreenshots,
  } = props;
  const itemClasses = cx(classes.item, className, {
    disabled,
    hoverForScreenshots,
    [classes.itemActive]: highlighted && !disabled,
    [classes.itemDisabled]: disabled,
    [classes.itemHeader]: isHeader,
  });

  const item = (
    <div
      className={itemClasses}
      onClick={disabled ? noop : onClick}
      data-test={dataTest}
      style={style}
    >
      {hasSubMenu && direction === "left" && (
        <ChevronLeftIcon className={cx(classes.submenuIcon, classes.submenuIconLeft)} />
      )}
      {icon != undefined && (
        <span className={classes.icon}>
          <Icon size={iconSize}>{icon}</Icon>
        </span>
      )}
      <div className={classes.contentWrapper}>
        {children}
        {checked && !isDropdown && (
          <Icon size={iconSize} style={{ marginLeft: 5 }}>
            <CheckCircleIcon />
          </Icon>
        )}
      </div>
      {hasSubMenu && direction === "right" && <ChevronRightIcon className={classes.submenuIcon} />}
      {checked && isDropdown && (
        <Icon size={iconSize}>
          <CheckIcon />
        </Icon>
      )}
    </div>
  );

  if (tooltip != undefined && tooltip !== "") {
    return <Tooltip contents={tooltip}>{item}</Tooltip>;
  }
  return item;
};

Item.displayName = "Menu.Item";
Item.isMenuItem = true;

export default Item;
