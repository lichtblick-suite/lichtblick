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

import MenuDownIcon from "@mdi/svg/svg/menu-down.svg";
import { createPortal } from "react-dom";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import colors from "@foxglove/studio-base/styles/colors.module.scss";

import styles from "./Select.module.scss";

const SEmpty = styled.div`
  padding: 8px 12px;
  color: ${colors.textMuted};
  font-style: italic;
`;

type Props = {
  children: React.ReactNode;
  // specify text specifically if the value is not a string
  text?: string;
  value: any;
  icon: React.ReactNode;
  onChange: (value: any) => void;
};

type State = {
  isOpen: boolean;
};

export default class Select extends React.Component<Props, State> {
  static defaultProps = {
    icon: <MenuDownIcon />,
  };

  el?: HTMLDivElement;

  override state = {
    isOpen: false,
  };

  close = (): void => {
    this.setState({ isOpen: false });
    window.removeEventListener("click", this.close);
  };

  open = (e: React.SyntheticEvent<HTMLDivElement>): void => {
    e.stopPropagation();
    this.setState({ isOpen: true });
    // let this event hit the window before adding close listener
    setImmediate(() => {
      window.addEventListener("click", this.close);
    });
  };

  renderOpen(): React.ReactNode {
    const { value, children, onChange } = this.props;
    const mappedChildren = React.Children.map(children, (child: any) => {
      // if the child does not have a value prop, just return it
      // e.g. <hr />
      if (!child.props.value) {
        return child;
      }
      const onClick = (e: React.SyntheticEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        if (child.props.disabled) {
          return;
        }
        const childValue = child.props.value;
        // don't allow <hr /> clicks to close
        if (!childValue) {
          return;
        }
        this.close();
        onChange(child.props.value);
      };
      const active = value === child.props.value;
      return React.cloneElement(child, { onClick, active });
    });
    const { body } = document;
    const { el } = this;
    if (!el) {
      return;
    }
    const box = el.getBoundingClientRect();
    const style = {
      top: box.top,
      left: box.left,
      width: box.width,
    };
    return createPortal(
      <div style={style} className={styles.menu}>
        {mappedChildren != undefined && mappedChildren.length > 0 ? (
          mappedChildren
        ) : (
          <SEmpty>No options available</SEmpty>
        )}
      </div>,
      body,
    );
  }

  override render(): JSX.Element {
    const { isOpen } = this.state;
    const { text, value, icon } = this.props;
    return (
      <div
        ref={(el) => (this.el = el ?? undefined)}
        className={styles.container}
        onClick={this.open}
      >
        <div className={styles.select}>
          <span className={styles.value}>
            {text != undefined && text.length > 0 ? text : value}
          </span>
          <span className={styles.icon}>
            <Icon>{icon}</Icon>
          </span>
        </div>
        {isOpen && this.renderOpen()}
      </div>
    );
  }
}
