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

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const STopicLink = styled.span`
  cursor: pointer;
  color: ${colors.HIGHLIGHT};
`;

type Props = {
  topic: string;
};

export default function TopicLink({ topic }: Props): JSX.Element {
  const { openSiblingPanel } = usePanelContext();
  const openRawMessages = React.useCallback(() => {
    openSiblingPanel({
      panelType: "RawMessages",
      updateIfExists: true,
      siblingConfigCreator: (config: PanelConfig) => ({
        ...config,
        topicPath: topic,
      }),
    });
  }, [openSiblingPanel, topic]);

  return (
    <Tooltip placement="top" contents={`View ${topic} in Raw Messages panel`}>
      {/* extra span to work around tooltip NaN positioning bug */}
      <span>
        <STopicLink onClick={openRawMessages}>{topic}</STopicLink>
      </span>
    </Tooltip>
  );
}
