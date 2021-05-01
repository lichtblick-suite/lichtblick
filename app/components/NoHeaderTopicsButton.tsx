// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import InformationIcon from "@mdi/svg/svg/information.svg";
import { groupBy } from "lodash";
import { useMemo, useState } from "react";
import styled from "styled-components";

import Icon from "@foxglove-studio/app/components/Icon";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import Modal, { Title } from "@foxglove-studio/app/components/Modal";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";
import TextContent from "@foxglove-studio/app/components/TextContent";

const SRoot = styled.div`
  max-width: calc(100vw - 30px);
  max-height: calc(100vh - 30px);
  overflow-y: auto;
  padding: 2.5em;
`;

const DEFAULT_TOPICS = Object.freeze({ topicsWithoutHeaderStamps: [], topics: [] });
const COLOR_THRESHOLD = 5; // show the icon yellow when too many headers are missing

function getTopics({ playerState: { activeData } }: any) {
  if (activeData == undefined) {
    return DEFAULT_TOPICS;
  }
  const {
    playerWarnings: { topicsWithoutHeaderStamps },
    topics,
  } = activeData;
  return { topicsWithoutHeaderStamps, topics };
}

function useTopicsWithoutHeaders() {
  const { topicsWithoutHeaderStamps, topics } = useMessagePipeline(getTopics);
  return useMemo(() => {
    const topicsByName = groupBy(topics, "name");
    return (topicsWithoutHeaderStamps || []).map((topicName: any) => {
      return { topic: topicName, datatype: topicsByName[topicName]?.[0]?.datatype };
    });
  }, [topicsWithoutHeaderStamps, topics]);
}

export default function NoHeaderTopicsButton(): JSX.Element | ReactNull {
  const topicsWithoutHeaders = useTopicsWithoutHeaders();
  const [showingModal, setShowingModal] = useState(false);
  return useMemo(() => {
    if (!topicsWithoutHeaders.length) {
      return ReactNull;
    }
    const rows = topicsWithoutHeaders.sort().map(({ topic, datatype }: any) => (
      <tr key={topic}>
        <td>{topic}</td>
        <td>{datatype}</td>
      </tr>
    ));
    const color = topicsWithoutHeaders.length > COLOR_THRESHOLD ? "#F7BE00" : "default";
    const tooltip =
      topicsWithoutHeaders.length === 1
        ? "1 subscribed topic does not have headers"
        : `${topicsWithoutHeaders.length} subscribed topics do not have headers`;
    return (
      <Icon
        tooltip={tooltip}
        onClick={() => setShowingModal(true)}
        style={{ color, paddingRight: "6px" }}
        dataTest="missing-headers-icon"
      >
        {showingModal && (
          <RenderToBodyComponent>
            <Modal onRequestClose={() => setShowingModal(false)}>
              <SRoot>
                <Title>Topics without headers</Title>
                <TextContent>
                  <p>
                    These topics will not be visible in panels when ordering data by header stamp:
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Datatype</th>
                      </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                  </table>
                </TextContent>
              </SRoot>
            </Modal>
          </RenderToBodyComponent>
        )}
        <InformationIcon />
      </Icon>
    );
  }, [topicsWithoutHeaders, showingModal]);
}
