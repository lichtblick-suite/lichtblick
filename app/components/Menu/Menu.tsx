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

import cx from "classnames";

import styles from "./index.module.scss";

type Props = {
  children: any;
  className?: string;
  style?: {
    [key: string]: any;
  };
};

// a small component which wraps its children in menu styles
// and provides a helper { Item } component which can be used
// to render typical menu items with text & an icon
export default class Menu extends React.PureComponent<Props> {
  render(): JSX.Element {
    const { children, className, style } = this.props;
    const classes = cx(styles.container, className);
    return (
      <div className={classes} style={style}>
        {children}
      </div>
    );
  }
}
