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
import PropTypes from "prop-types";

import Transforms from "@foxglove-studio/app/panels/ThreeDimensionalViz/Transforms";
import { Frame, Message } from "@foxglove-studio/app/players/types";
import { TF } from "@foxglove-studio/app/types/Messages";
import { isBobject, deepParse } from "@foxglove-studio/app/util/binaryObjects";
import { TRANSFORM_STATIC_TOPIC, TRANSFORM_TOPIC } from "@foxglove-studio/app/util/globalConstants";

type State = { transforms: Transforms };
type TfMessage = { transforms: TF[] };
type BaseProps = { frame: Frame; cleared: boolean };

function consumeTfs(tfs: Message[] | undefined, transforms: Transforms): void {
  if (tfs != undefined) {
    for (const { message } of tfs) {
      const parsedMessage = (isBobject(message) ? deepParse(message) : message) as TfMessage;
      for (const tf of parsedMessage.transforms) {
        transforms.consume(tf);
      }
    }
  }
}

function withTransforms<Props extends any>(ChildComponent: React.ComponentType<Props>) {
  class Component extends React.PureComponent<
    Partial<{ frame: Frame; cleared: boolean; forwardedRef: any }>,
    State
  > {
    static displayName = `withTransforms(${
      ChildComponent.displayName ?? ChildComponent.name ?? ""
    })`;
    static contextTypes = { store: PropTypes.any };

    state: State = { transforms: new Transforms() };

    static getDerivedStateFromProps(
      nextProps: Props,
      prevState: State,
    ): Partial<State> | undefined {
      const { frame, cleared } = nextProps as BaseProps;
      let { transforms } = prevState;
      if (cleared) {
        transforms = new Transforms();
      }

      // Find any references to previously unseen frames in the set of incoming messages
      // Note the naming confusion between `frame` (a map of topic names to messages received on
      // that topic) and transform frames (coordinate frames)
      for (const topic in frame) {
        for (const msg of frame[topic] as Message[]) {
          const frameId = msg.message.header?.frame_id as string | undefined;
          if (frameId != undefined) {
            transforms.register(frameId);
          }
        }
      }

      // Process all new /tf and /tf_static messages
      consumeTfs(frame[TRANSFORM_TOPIC], transforms);
      consumeTfs(frame[TRANSFORM_STATIC_TOPIC], transforms);

      return { transforms };
    }

    render() {
      return (
        <ChildComponent
          {...(this.props as any)}
          ref={this.props.forwardedRef}
          transforms={this.state.transforms}
        />
      );
    }
  }
  return hoistNonReactStatics(
    React.forwardRef((props, ref) => {
      return <Component {...props} forwardedRef={ref} />;
    }),
    ChildComponent,
  );
}

export default withTransforms;
