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

import HelpCircleOutlineIcon from "@mdi/svg/svg/help-circle-outline.svg";
import { CSSProperties, PropsWithChildren, useState } from "react";

import HelpModal from "@foxglove/studio-base/components/HelpModal";
import Icon from "@foxglove/studio-base/components/Icon";

import styles from "./index.module.scss";

type Props = {
  iconStyle?: CSSProperties;
};

export default function HelpButton(props: PropsWithChildren<Props>): JSX.Element {
  const [showHelp, setShowHelp] = useState<boolean>(false);

  return (
    <Icon tooltip="Help" fade onClick={() => setShowHelp(true)}>
      {showHelp && (
        <HelpModal onRequestClose={() => setShowHelp(false)}>{props.children}</HelpModal>
      )}
      <HelpCircleOutlineIcon className={styles.icon} style={props.iconStyle} />
    </Icon>
  );
}
