// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useLayoutEffect, useRef, useState } from "react";

import { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

// useDelayedFixture works around a contract in useMessageReducer which does not re-process an existing
// frame when topics change.
//
// To work around this contract, we delay fixture availability a few cycles giving any users of
// the fixture time to setup subscribers, etc.
function useDelayedFixture(fixtureToSet: Fixture): Fixture {
  const [fixture, setFixture] = useState<Fixture>({});
  const fixtureRef = useRef<Fixture>(fixtureToSet);

  useLayoutEffect(() => {
    queueMicrotask(() => {
      setFixture(fixtureRef.current);
    });
  }, []);

  return fixture;
}

// ts-prune-ignore-next
export default useDelayedFixture;
