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

import hoistNonReactStatics from "hoist-non-react-statics";
import { uniq } from "lodash";
import { ForwardedRef } from "react";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { Frame, MessageEvent } from "@foxglove/studio-base/players/types";

const useFrame = (
  topics: string[],
): {
  cleared?: boolean;
  frame: Frame;
} => {
  // NOTE(JP): This is a huge abuse of the `useMessageReducer` API. Never use `useMessageReducer`
  // in this way yourself!! `restore` and `addMessage` should be pure functions and not have
  // side effects!
  const frame = React.useRef<Frame>({});
  const cleared = React.useRef(false);
  const counter = React.useRef(0);
  PanelAPI.useMessageReducer<number>({
    topics,
    restore: React.useCallback((prevValue) => {
      frame.current = {};
      if (prevValue == undefined) {
        cleared.current = true;
      }
      return ++counter.current;
    }, []),
    addMessages: React.useCallback((_, messages: readonly MessageEvent<unknown>[]) => {
      for (const message of messages) {
        (frame.current[message.topic] = frame.current[message.topic] ?? []).push(message);
      }
      return ++counter.current;
    }, []),
  });

  try {
    return { cleared: cleared.current, frame: frame.current };
  } finally {
    frame.current = {};
    cleared.current = false;
  }
};

// This higher-order component provides compatibility between the old way of Panels receiving
// messages, using "frames" and keeping state themselves, and the new `useMessageReducer` API which
// manages state for you and allows in the future for more flexibility in accessing messages.
//
// TODO(JP): Remove FrameCompatibilityDEPRECATED from the last panel where it's still used: the 3d panel!
// This is the "Scenebuilder refactor" project.
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function FrameCompatibilityDEPRECATED<Props>(
  ChildComponent: React.ComponentType<Props>,
  baseTopics: string[],
) {
  function FrameCompatibilityComponent(props: Props & { forwardedRef: ForwardedRef<unknown> }) {
    const { forwardedRef, ...childProps } = props;
    const [topics, setTopics] = React.useState<string[]>(baseTopics);
    const componentSetSubscriptions = React.useCallback((newTopics: string[]) => {
      setTopics(uniq(newTopics.concat(baseTopics)));
    }, []);
    const { frame, cleared } = useFrame(topics);
    return (
      <ChildComponent
        {...(childProps as any)}
        ref={forwardedRef}
        frame={frame}
        setSubscriptions={componentSetSubscriptions}
        cleared={cleared}
      />
    );
  }

  return hoistNonReactStatics(
    React.forwardRef(function FrameCompatibility(props: Props, ref) {
      return <FrameCompatibilityComponent {...props} forwardedRef={ref} />;
    }),
    ChildComponent,
  );
}
