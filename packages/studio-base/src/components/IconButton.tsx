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

import React, { CSSProperties, ReactNode } from "react";

import Button from "@foxglove/studio-base/components/Button";
import Icon from "@foxglove/studio-base/components/Icon";

type Props = {
  tooltip: string;
  onClick: () => void;
  icon: ReactNode;
  id?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
};

export default React.memo<Props>(function IconButton(props: Props) {
  const { tooltip, onClick, id, icon, className, style, disabled } = props;
  return (
    <Button
      id={id}
      tooltip={tooltip}
      className={className}
      style={{ width: "32px", height: "32px", ...style }}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon small>{icon}</Icon>
    </Button>
  );
});
