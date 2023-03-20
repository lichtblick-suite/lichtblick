// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

/**
 * useFixtureQueue hook manages a queue of fixtures to replicate the player behavior of waiting to
 * send a new update until the current one is done
 *
 * useFixtureQueue accepts one argument, a fixture, and returns a tuple [activeFixture, pauseFrame]
 * Pass the activeFixture and pauseFrame function to <PanelSetup>
 *
 * When you call useFixtureQueue with a fixture, if the previous fixture is still rendering, the new
 * input fixture is queued.
 */
function useFixtureQueue(fixture: Fixture): [Fixture, () => () => void] {
  const [activeFixture, setActiveFixture] = useState<Fixture>(fixture);
  const fixtureQueue = useRef<Fixture[]>([]);
  const rendering = useRef<boolean>(false);

  // Using a layout effect allows a panel time to invoke pauseFrame if it intends to render
  // this "tick".
  //
  // This is necessary since some actions the panel might take on the message pipeline cause it to
  // re-render and we need our fixture updates to allow for that to happen before checking if the
  // panel is rendering.
  useLayoutEffect(() => {
    if (rendering.current && !fixtureQueue.current.find((item) => item === fixture)) {
      fixtureQueue.current.push(fixture);
    }
  }, [fixture]);

  const pauseFrame = useCallback(() => {
    rendering.current = true;
    return () => {
      rendering.current = false;
      const nextFixture = fixtureQueue.current.shift();
      if (nextFixture) {
        setActiveFixture(nextFixture);
      }
    };
  }, []);

  return [activeFixture, pauseFrame];
}

// ts-prune-ignore-next
export { useFixtureQueue };
