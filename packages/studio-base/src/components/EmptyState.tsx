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

import styled from "styled-components";

type Props = {
  children: React.ReactNode;
  alignLeft?: boolean;
};

const Container = styled.div<Props>`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: ${({ alignLeft = false }) => (alignLeft ? "left" : "center")};
  margin: 20px;
  line-height: 1.4;
  color: ${({ theme }) => theme.semanticColors.disabledText};

  code {
    color: ${({ theme }) => theme.palette.accent};
    background: transparent;
    padding: 0;
  }
`;

export default function EmptyState({ children, alignLeft }: Props): JSX.Element {
  return (
    <Container alignLeft={alignLeft}>
      <div>{children}</div>
    </Container>
  );
}
