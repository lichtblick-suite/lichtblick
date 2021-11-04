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

import { makeStyles } from "@fluentui/react";
import CheckIcon from "@mdi/svg/svg/check.svg";
import DatabaseIcon from "@mdi/svg/svg/database.svg";
import cx from "classnames";
import { uniq } from "lodash";
import { useMemo } from "react";

import Dropdown from "@foxglove/studio-base/components/Dropdown";
import Icon from "@foxglove/studio-base/components/Icon";
import { Topic } from "@foxglove/studio-base/players/types";

type Props = {
  onChange: (topic: string) => void;
  topicToRender: string;
  topics: readonly Topic[];
  allowedDatatypes: string[];
  defaultTopicToRender: string;
};

const useStyles = makeStyles((theme) => ({
  topic: {
    display: "flex",
    cursor: "pointer",
    padding: 8,
    height: 32,
    color: theme.semanticColors.menuItemText,
    ":hover": {
      backgroundColor: theme.semanticColors.menuItemBackgroundHovered,
    },
  },
  topicLabel: {
    flex: "flex-start",
    minWidth: 150,
    height: 17,
  },
  checkIcon: {
    flex: "flex-end",

    svg: {
      fill: theme.semanticColors.menuIcon,
      width: 15,
      height: 15,
    },
  },
  icon: {
    fontSize: 14,
    margin: "0 0.2em",
    color: theme.semanticColors.warningBackground,
  },
  iconActive: {
    color: theme.palette.neutralPrimary,
  },
}));

export default function TopicToRenderMenu({
  onChange,
  topicToRender,
  topics,
  allowedDatatypes,
  defaultTopicToRender,
}: Props): JSX.Element {
  const styles = useStyles();
  const allowedDatatypesSet = useMemo(() => new Set(allowedDatatypes), [allowedDatatypes]);
  const availableTopics: string[] = [];
  for (const topic of topics) {
    if (allowedDatatypesSet.has(topic.datatype)) {
      availableTopics.push(topic.name);
    }
  }
  // Keeps only the first occurrence of each topic.
  const renderTopics: string[] = uniq([defaultTopicToRender, ...availableTopics, topicToRender]);
  const parentTopicSpan = ({ topic, available }: { topic: string; available: boolean }) => {
    return (
      <>
        {topic.length > 0 ? topic : <em>Default</em>}
        {available ? "" : " (not available)"}
      </>
    );
  };

  return (
    <Dropdown
      toggleComponent={
        <Icon
          fade
          tooltip={`Supported datatypes: ${allowedDatatypes.join(", ")}`}
          tooltipProps={{ placement: "top" }}
          dataTest={"topic-set"}
        >
          <DatabaseIcon
            className={cx(styles.icon, {
              [styles.iconActive]: topicToRender === defaultTopicToRender,
            })}
          />
        </Icon>
      }
    >
      {renderTopics.map((topic) => (
        <div
          className={styles.topic}
          key={topic}
          onClick={() => {
            onChange(topic);
          }}
        >
          <span className={styles.topicLabel}>
            {parentTopicSpan({ topic, available: availableTopics.includes(topic) })}
          </span>
          {topicToRender === topic && (
            <span className={styles.checkIcon}>
              <CheckIcon />
            </span>
          )}
        </div>
      ))}
    </Dropdown>
  );
}
