/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";
import { PropsWithChildren } from "react";

import { useSessionStorageValue } from "@foxglove/hooks";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import CurrentUserContext, { User } from "@foxglove/studio-base/context/CurrentUserContext";
import PlayerSelectionContext, {
  IDataSourceFactory,
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useInitialDeepLinkState } from "@foxglove/studio-base/hooks/useInitialDeepLinkState";
import { Player } from "@foxglove/studio-base/players/types";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";
import { LaunchPreferenceValue } from "@foxglove/studio-base/types/LaunchPreferenceValue";

jest.mock("@foxglove/hooks", () => ({
  ...jest.requireActual("@foxglove/hooks"),
  useSessionStorageValue: jest.fn(),
}));
jest.mock("@foxglove/studio-base/context/CurrentLayoutContext");

type WrapperProps = {
  currentUser?: User;
  playerSelection: PlayerSelection;
};

function makeWrapper(initialProps: WrapperProps) {
  const wrapperProps = initialProps;
  function setWrapperProps(props: Partial<WrapperProps>) {
    Object.assign(wrapperProps, props);
  }
  function wrapper({ children }: PropsWithChildren<unknown>) {
    const userContextValue = {
      currentUser: wrapperProps.currentUser,
      signIn: () => undefined,
      signOut: async () => undefined,
    };
    return (
      <MockMessagePipelineProvider
        topics={[]}
        datatypes={new Map()}
        capabilities={["hello"]}
        messages={[]}
        urlState={{ sourceId: "test", parameters: { url: "testurl", param: "one" } }}
        startTime={{ sec: 0, nsec: 1 }}
      >
        <CurrentUserContext.Provider value={userContextValue}>
          <EventsProvider>
            <PlayerSelectionContext.Provider value={wrapperProps.playerSelection}>
              {children}
            </PlayerSelectionContext.Provider>
          </EventsProvider>
        </CurrentUserContext.Provider>
      </MockMessagePipelineProvider>
    );
  }
  return { wrapper, setWrapperProps };
}

describe("Initial deep link state", () => {
  const selectSource = jest.fn();
  const emptyPlayerSelection = {
    selectSource,
    selectRecent: () => {},
    availableSources: [],
    recentSources: [],
    selectedSource: undefined,
  };

  beforeEach(() => {
    (useSessionStorageValue as jest.Mock).mockReturnValue([LaunchPreferenceValue.WEB, jest.fn()]);
    selectSource.mockClear();
  });

  it("doesn't select a source without ds params", () => {
    const { wrapper } = makeWrapper({ playerSelection: emptyPlayerSelection });
    renderHook(() => useInitialDeepLinkState(["https://studio.foxglove.dev/?foo=bar"]), {
      wrapper,
    });

    expect(selectSource).not.toHaveBeenCalled();
  });

  it("selects the sample datasource from the link", () => {
    const { wrapper } = makeWrapper({ playerSelection: emptyPlayerSelection });
    renderHook(() => useInitialDeepLinkState(["https://studio.foxglove.dev/?ds=sample-nuscenes"]), {
      wrapper,
    });

    expect(selectSource).toHaveBeenCalledWith("sample-nuscenes", {
      params: undefined,
      type: "connection",
    });
  });

  it("selects a connection datasource from the link", () => {
    const { wrapper } = makeWrapper({ playerSelection: emptyPlayerSelection });
    renderHook(
      () =>
        useInitialDeepLinkState([
          "http://localhost:8080/?ds=rosbridge-websocket&ds.url=ws%3A%2F%2Flocalhost%3A9090",
        ]),
      { wrapper },
    );

    expect(selectSource).toHaveBeenCalledWith("rosbridge-websocket", {
      params: { url: "ws://localhost:9090" },
      type: "connection",
    });
  });

  it("waits for a current user to select a source with currentUserRequired=true", () => {
    class FooFactory implements IDataSourceFactory {
      public id = "foo-with-user";
      public type = "connection" as const;
      public displayName = "Foo";
      public currentUserRequired = true;
      public initialize(): Player | undefined {
        throw new Error("not implemented");
      }
    }
    const { wrapper, setWrapperProps } = makeWrapper({
      currentUser: undefined,
      playerSelection: {
        ...emptyPlayerSelection,
        availableSources: [new FooFactory()],
      },
    });
    const { result, rerender } = renderHook(
      () => useInitialDeepLinkState(["https://studio.foxglove.dev/?ds=foo-with-user&ds.bar=baz"]),
      { wrapper },
    );

    expect(result.current.currentUserRequired).toBeTruthy();

    expect(selectSource).not.toHaveBeenCalled();

    const org: User["org"] = {
      id: "fake-orgid",
      slug: "fake-org",
      displayName: "Fake Org",
      isEnterprise: false,
      allowsUploads: false,
      supportsEdgeSites: false,
    };

    setWrapperProps({
      currentUser: {
        id: "id",
        email: "email",
        orgId: org.id,
        orgDisplayName: org.displayName,
        orgSlug: org.slug,
        orgPaid: true,
        org,
      },
      playerSelection: emptyPlayerSelection,
    });
    rerender();

    expect(selectSource).toHaveBeenCalledWith("foo-with-user", {
      params: { bar: "baz" },
      type: "connection",
    });
  });
});
