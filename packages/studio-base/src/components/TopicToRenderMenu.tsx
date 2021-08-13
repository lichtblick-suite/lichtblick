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
import CheckIcon from "@mdi/svg/svg/check.svg";
import DatabaseIcon from "@mdi/svg/svg/database.svg";
import { uniq } from "lodash";
import { useMemo } from "react";
import styled from "styled-components";

import Dropdown from "@foxglove/studio-base/components/Dropdown";
import Icon from "@foxglove/studio-base/components/Icon";
import styles from "@foxglove/studio-base/components/PanelToolbar/index.module.scss";
import { Topic } from "@foxglove/studio-base/players/types";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

type Props = {
  onChange: (topic: string) => void;
  topicToRender: string;
  topics: readonly Topic[];
  allowedDatatypes: string[];
  defaultTopicToRender: string;
};

const SDiv = styled.div`
  display: flex;
  cursor: pointer;
  padding: 8px;
  height: 32px;
`;

const SSpan = styled.span`
  flex: flex-start;
  min-width: 150px;
  height: 17px;
`;

const SIconSpan = styled.span`
  flex: flex-end;
  svg {
    fill: white;
    width: 15px;
    height: 15px;
  }
`;

export default function TopicToRenderMenu({
  onChange,
  topicToRender,
  topics,
  allowedDatatypes,
  defaultTopicToRender,
}: Props): JSX.Element {
  const allowedDatatypesSet = useMemo(() => new Set(allowedDatatypes), [allowedDatatypes]);
  const availableTopics: string[] = [];
  for (const topic of topics) {
    if (allowedDatatypesSet.has(topic.datatype)) {
      availableTopics.push(topic.name);
    }
  }
  // Keeps only the first occurrence of each topic.
  const renderTopics: string[] = uniq([defaultTopicToRender, ...availableTopics, topicToRender]);
  const parentTopicSpan = (topic: string, available: boolean) => {
    const topicDiv =
      topic.length > 0 ? topic : <span style={{ fontStyle: "italic" }}>Default</span>;
    return (
      <span>
        {topicDiv}
        {available ? "" : " (not available)"}
      </span>
    );
  };

  return (
    <Dropdown
      toggleComponent={
        <Icon
          fade
          tooltip={`Supported datatypes: ${allowedDatatypes.join(", ")}`}
          tooltipProps={{ placement: "top" }}
          style={{ color: topicToRender === defaultTopicToRender ? colors.LIGHT1 : colors.ORANGE }}
          dataTest={"topic-set"}
        >
          <DatabaseIcon className={styles.icon} />
        </Icon>
      }
    >
      {renderTopics.map((topic) => (
        <SDiv
          style={topicToRender === topic ? { backgroundColor: "rgba(59, 46, 118, 0.6)" } : {}}
          key={topic}
          onClick={() => {
            onChange(topic);
          }}
        >
          <SSpan>{parentTopicSpan(topic, availableTopics.includes(topic))}</SSpan>
          {topicToRender === topic && (
            <SIconSpan>
              <CheckIcon />
            </SIconSpan>
          )}
        </SDiv>
      ))}
    </Dropdown>
  );
}
