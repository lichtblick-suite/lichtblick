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

import LinkVariantOffIcon from "@mdi/svg/svg/link-variant-off.svg";
import LinkVariantIcon from "@mdi/svg/svg/link-variant.svg";
import { useState, ReactNode } from "react";
import styled from "styled-components";

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import Icon from "@foxglove/studio-base/components/Icon";

import GlobalVariableName from "../GlobalVariableName";
import { LinkedGlobalVariable } from "../useLinkedGlobalVariables";

const SIconWrapper = styled.span`
  .icon {
    /* TODO(Audrey): remove the hard-coded icon style once we clean up 3D panel styles   */
    width: 15px !important;
    height: 15px !important;
    font-size: 15px !important;
  }
  .linked-icon {
    opacity: 1;
    display: inline-block;
  }
  .link-off-icon {
    opacity: 0;
    display: none;
  }
  &:hover {
    .linked-icon {
      opacity: 0;
      display: none;
    }
    .link-off-icon {
      opacity: 1;
      display: inline-block;
    }
  }
`;

type Props = {
  linkedGlobalVariable: LinkedGlobalVariable;
  children: (arg0: {
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    setIsOpen: (arg0: boolean) => void;
    linkedGlobalVariable: LinkedGlobalVariable;
  }) => ReactNode;
  tooltip?: ReactNode;
};

export default function UnlinkWrapper({
  children,
  linkedGlobalVariable,
  tooltip,
}: Props): JSX.Element {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  return (
    <>
      <ChildToggle
        dataTest={`unlink-${linkedGlobalVariable.name}`}
        position="above"
        onToggle={setIsOpen}
        isOpen={isOpen}
      >
        <SIconWrapper>
          <Icon
            fade
            tooltipProps={{
              contents: tooltip ?? (
                <span>
                  Unlink this field from <GlobalVariableName name={linkedGlobalVariable.name} />
                </span>
              ),
            }}
          >
            <LinkVariantOffIcon className="link-off-icon" />
            <LinkVariantIcon className="linked-icon" />
          </Icon>
        </SIconWrapper>
        <span>{children({ setIsOpen, linkedGlobalVariable })}</span>
      </ChildToggle>
      <GlobalVariableName name={linkedGlobalVariable.name} leftPadding />
    </>
  );
}
