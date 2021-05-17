// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import MinusIcon from "@mdi/svg/svg/minus-box-outline.svg";
import { PropsWithChildren } from "react";
import { Row } from "react-table";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";

import { sanitizeAccessorPath } from "./sanitizeAccessorPath";

const ObjectCell = styled.span`
  font-style: italic;
  cursor: pointer;
`;

type TableCellProps = {
  row: Row;
  accessorPath: string;
};

export default function TableCell({
  row,
  accessorPath,
  children,
}: PropsWithChildren<TableCellProps>): JSX.Element {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const toggleIsExpanded = React.useCallback(() => setIsExpanded((expanded) => !expanded), []);

  if (row.isExpanded || isExpanded) {
    return (
      <div style={{ position: "relative" }}>
        {isExpanded && (
          <Icon
            style={{ position: "absolute", top: "2px", right: "2px" }}
            onClick={toggleIsExpanded}
          >
            <MinusIcon />
          </Icon>
        )}
        {children}
      </div>
    );
  }

  return (
    <ObjectCell
      data-test={`expand-cell-${sanitizeAccessorPath(accessorPath)}-${row.index}`}
      onClick={toggleIsExpanded}
    >
      Object
    </ObjectCell>
  );
}
