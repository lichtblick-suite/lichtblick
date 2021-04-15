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

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import useChangeDetector from "@foxglove-studio/app/hooks/useChangeDetector";
import { Frame, Message, Topic } from "@foxglove-studio/app/players/types";

const useFrame = (
  topics: string[],
): {
  cleared?: boolean;
  frame: Frame;
} => {
  // NOTE(JP): This is a huge abuse of the `useMessageReducer` API. Never use `useMessageReducer`
  // in this way yourself!! `restore` and `addMessage` should be pure functions and not have
  // side effects!
  const frame = React.useRef<any>({});
  const lastClearTime = PanelAPI.useMessageReducer({
    topics,
    restore: React.useCallback(() => {
      frame.current = {};
      return Date.now();
    }, [frame]),
    addBobjects: React.useCallback(
      (time, messages: readonly Message[]) => {
        for (const message of messages) {
          frame.current[message.topic] = frame.current[message.topic] || [];
          frame.current[message.topic].push(message);
        }
        return time;
      },
      [frame],
    ),
  });

  const cleared = useChangeDetector([lastClearTime], false);
  const latestFrame = frame.current;
  frame.current = {};
  return { cleared, frame: latestFrame };
};

// This higher-order component provides compatibility between the old way of Panels receiving
// messages, using "frames" and keeping state themselves, and the new `useMessageReducer` API which
// manages state for you and allows in the future for more flexibility in accessing messages.
//
// TODO(JP): Remove FrameCompatibilityDEPRECATED from the last panel where it's still used: the 3d panel!
// This is the "Scenebuilder refactor" project.
export function FrameCompatibilityDEPRECATED<Props>(
  ChildComponent: React.ComponentType<Props>,
  baseTopics: string[],
) {
  function FrameCompatibilityComponent(props: Props & { forwardedRef: any; topics: Topic[] }) {
    const { forwardedRef, ...childProps } = props;
    const [topics, setTopics] = React.useState<string[]>(baseTopics);
    const componentSetSubscriptions = React.useCallback((newTopics: string[]) => {
      setTopics(uniq(newTopics.concat(baseTopics || [])));
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
    React.forwardRef(function FrameCompatibility(props: any, ref) {
      return <FrameCompatibilityComponent {...props} forwardedRef={ref} />;
    }),
    ChildComponent,
  );
}
