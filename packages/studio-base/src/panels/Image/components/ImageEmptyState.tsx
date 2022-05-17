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

import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Stack from "@foxglove/studio-base/components/Stack";

type Props = {
  cameraTopic: string;
  markerTopics: readonly string[];
  shouldSynchronize: boolean;
};

export function ImageEmptyState(props: Props): JSX.Element {
  const { cameraTopic, markerTopics, shouldSynchronize } = props;

  if (cameraTopic === "") {
    return (
      <Stack fullHeight fullWidth justifyContent="center" alignItems="center">
        <EmptyState>Select a topic to view images</EmptyState>
      </Stack>
    );
  }
  return (
    <Stack fullHeight fullWidth justifyContent="center" alignItems="center">
      <EmptyState>
        Waiting for images {markerTopics.length > 0 && "and markers"} on:
        <div>
          <div>
            <code>{cameraTopic}</code>
          </div>
          {[...markerTopics].sort().map((topic) => (
            <div key={topic}>
              <code>{topic}</code>
            </div>
          ))}
        </div>
        {shouldSynchronize && (
          <>
            <p>Synchronization is enabled, so all messages must have the same timestamp.</p>
            <ul></ul>
          </>
        )}
      </EmptyState>
    </Stack>
  );
}
