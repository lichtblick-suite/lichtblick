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

import CheckCircleIcon from "@mdi/svg/svg/check-circle.svg";
import CheckIcon from "@mdi/svg/svg/check.svg";
import ChevronLeftIcon from "@mdi/svg/svg/chevron-left.svg";
import ChevronRightIcon from "@mdi/svg/svg/chevron-right.svg";
import cx from "classnames";
import { noop } from "lodash";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import Tooltip from "@foxglove/studio-base/components/Tooltip";

import styles from "./index.module.scss";

const SContentWrapper = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  // need this for text truncation https://css-tricks.com/flexbox-truncated-text/
  min-width: 0px;
`;

type ItemProps = {
  className?: string;
  isHeader?: boolean;
  checked?: boolean;
  highlighted?: boolean;
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconSize?: "xxsmall" | "xsmall" | "small" | "medium" | "large" | "xlarge";
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
  const classes = cx(styles.item, className, {
    [styles.active!]: highlighted && !disabled,
    [styles.disabled!]: disabled,
    disabled,
    [styles.header!]: isHeader,
    [styles.hoverForScreenshot!]: hoverForScreenshots,
  });

  const item = (
    <div className={classes} onClick={disabled ? noop : onClick} data-test={dataTest} style={style}>
      {hasSubMenu && direction === "left" && <ChevronLeftIcon className={styles.submenuIconLeft} />}
      {icon != undefined && (
        <span className={styles.icon}>
          <Icon {...{ [iconSize]: true }}>{icon}</Icon>
        </span>
      )}
      <SContentWrapper>
        {children}
        {checked && !isDropdown && (
          <Icon {...{ [iconSize]: true }} style={{ marginLeft: "5px" }}>
            <CheckCircleIcon />
          </Icon>
        )}
      </SContentWrapper>
      {hasSubMenu && direction === "right" && (
        <ChevronRightIcon className={styles.submenuIconRight} />
      )}
      {checked && isDropdown && (
        <Icon {...{ [iconSize]: true }}>
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
