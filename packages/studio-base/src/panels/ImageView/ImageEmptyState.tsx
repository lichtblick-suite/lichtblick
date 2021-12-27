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

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { formatTimeRaw, getTimestampForMessage } from "@foxglove/studio-base/util/time";

type Props = {
  cameraTopic: string;
  markerTopics: string[];
  shouldSynchronize: boolean;
  messagesByTopic: {
    [topic: string]: readonly MessageEvent<unknown>[];
  };
};

const useStyles = makeStyles((theme) => ({
  emptyStateWrapper: {
    width: "100%",
    height: "100%",
    background: theme.palette.neutralLighterAlt,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

// Group image topics by the first component of their name
export default function ImageEmptyState(props: Props): JSX.Element {
  const { cameraTopic, markerTopics, shouldSynchronize, messagesByTopic } = props;

  const classes = useStyles();
  if (cameraTopic === "") {
    return (
      <div className={classes.emptyStateWrapper}>
        <EmptyState>Select a topic to view images</EmptyState>
      </div>
    );
  }
  return (
    <div className={classes.emptyStateWrapper}>
      <EmptyState>
        Waiting for images {markerTopics.length > 0 && "and markers"} on:
        <div>
          <div>
            <code>{cameraTopic}</code>
          </div>
          {markerTopics.sort().map((m) => (
            <div key={m}>
              <code>{m}</code>
            </div>
          ))}
        </div>
        {shouldSynchronize && (
          <>
            <p>
              Synchronization is enabled, so all messages with <code>header.stamp</code>s must match
              exactly.
            </p>
            <ul>
              {Object.entries(messagesByTopic).map(([topic, topicMessages]) => (
                <li key={topic}>
                  <code>{topic}</code>:{" "}
                  {topicMessages.length > 0
                    ? topicMessages
                        .map(({ message }) => {
                          const stamp = getTimestampForMessage(message);
                          return stamp != undefined ? formatTimeRaw(stamp) : "[ unknown ]";
                        })
                        .join(", ")
                    : "no messages"}
                </li>
              ))}
            </ul>
          </>
        )}
      </EmptyState>
    </div>
  );
}
