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

import { renderHook } from "@testing-library/react-hooks";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useStateToURLSynchronization } from "@foxglove/studio-base/hooks/useStateToURLSynchronization";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";

// useLayoutEffect doesn't work in headless tests.
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useLayoutEffect: jest.requireActual("react").useEffect,
}));

function makePlayerSelection(options: Partial<PlayerSelection>): PlayerSelection {
  return {
    selectSource: () => {},
    selectRecent: () => {},
    availableSources: [],
    recentSources: [],
    selectedSource: undefined,
    ...options,
  };
}

describe("useStateToURLSynchronization", () => {
  it("updates the url with a stable source & player state", () => {
    const emptyPlayerSelection = makePlayerSelection({});

    const selectedPlayerSelection = makePlayerSelection({
      selectedSource: {
        id: "test1",
        type: "connection",
        displayName: "test",
        initialize: () => undefined,
      },
    });

    const replaceState = jest.fn();

    // eslint-disable-next-line id-denylist
    (global as unknown as any).window = {
      history: { replaceState },
      location: new URL("http://localhost"),
    };

    const { rerender } = renderHook(useStateToURLSynchronization, {
      initialProps: { presence: PlayerPresence.NOT_PRESENT, playerSelection: emptyPlayerSelection },
      wrapper: ({ children, presence, playerSelection }) => {
        return (
          <MockMessagePipelineProvider
            topics={[]}
            presence={presence}
            datatypes={new Map()}
            capabilities={["hello"]}
            messages={[]}
            urlState={{ url: "testurl", param: "one" }}
            startTime={{ sec: 0, nsec: 1 }}
          >
            <PlayerSelectionContext.Provider value={playerSelection}>
              <MockCurrentLayoutProvider>{children}</MockCurrentLayoutProvider>
            </PlayerSelectionContext.Provider>
          </MockMessagePipelineProvider>
        );
      },
    });

    expect(replaceState).not.toHaveBeenCalled();

    rerender({ presence: PlayerPresence.NOT_PRESENT, playerSelection: selectedPlayerSelection });

    expect(replaceState).not.toHaveBeenCalled();

    rerender({ presence: PlayerPresence.PRESENT, playerSelection: selectedPlayerSelection });

    expect(replaceState).toHaveBeenCalledWith(
      undefined,
      "",
      "http://localhost/?ds=test1&ds.param=one&ds.url=testurl&layoutId=mock-layout",
    );
  });
});
