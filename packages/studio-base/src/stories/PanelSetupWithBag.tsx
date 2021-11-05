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

import { flatten, groupBy } from "lodash";
import { useEffect, useState } from "react";

import {
  CurrentLayoutActions,
  SelectedPanelActions,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import StoryPlayer from "@foxglove/studio-base/players/StoryPlayer";
import { PlayerState, SubscribePayload } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

const defaultGetMergedFixture = (bagFixture: Fixture) => bagFixture;

type Props = {
  bag: string;
  children: React.ReactNode;
  subscriptions?: string[];
  // merge the bag data with existing fixture data
  getMergedFixture?: (bagFixture: Fixture) => Fixture;
  onMount?: (
    arg0: HTMLDivElement,
    actions: CurrentLayoutActions,
    selectedPanelActions: SelectedPanelActions,
  ) => void;
  onFirstMount?: (arg0: HTMLDivElement) => void;
  frameHistoryCompatibility?: boolean;
};

// A util component for testing panels that need to load the raw ROS bags.
// Make sure the bag is uncompressed and is small (only contains related topics).
// If the final fixture data is a mix of bag data (e.g. audio, image) and json/js data, you can
// merge them together using getMergedFixture
export default function PanelSetupWithBag({
  bag,
  children,
  getMergedFixture = defaultGetMergedFixture,
  // TODO(troy): Ideally we wouldn't even need subscriptions here, relying on
  // the PanelApi hooks to pick up on subscriptions and set them to the player
  // created in this component. We'll need to overhaul
  // `PanelSetup`/`MockMessagePipelineProvider` to accomplish this, mainly by
  // threading the `player` created here through those components.
  subscriptions,
  onMount,
  onFirstMount,
  frameHistoryCompatibility = false,
}: Props): JSX.Element | ReactNull {
  const [fixture, setFixture] = useState<Fixture | undefined>(undefined);
  const hasResetFixture = React.useRef(false);

  // 3D Panel hack that resets fixture in order to get around MessageHistory
  // behavior where the existing frame is not re-processed when the set of
  // topics changes.
  useEffect(() => {
    if (!hasResetFixture.current && fixture && frameHistoryCompatibility) {
      setImmediate(() => {
        hasResetFixture.current = true;
        setFixture({ ...fixture });
      });
    }
  }, [fixture, frameHistoryCompatibility]);

  useEffect(() => {
    void (async () => {
      const player = new StoryPlayer(bag);
      const formattedSubscriptions: SubscribePayload[] = flatten(
        (subscriptions ?? []).map((topic) => [{ topic }]),
      );
      player.setSubscriptions(formattedSubscriptions);

      player.setListener(async ({ activeData }: PlayerState) => {
        if (!activeData) {
          return;
        }
        const { messages, topics } = activeData;
        const frame = groupBy(messages, "topic");
        setFixture(
          getMergedFixture({
            activeData,
            frame,
            topics,
          }),
        );
      });
    })();
  }, [bag, getMergedFixture, subscriptions]);

  return fixture ? (
    <PanelSetup fixture={fixture} onMount={onMount} onFirstMount={onFirstMount}>
      {children}
    </PanelSetup>
  ) : (
    ReactNull
  );
}
