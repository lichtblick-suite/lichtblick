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
import { Frame, Message, Topic } from "@foxglove-studio/app/players/types";
import { TF } from "@foxglove-studio/app/types/Messages";
import { isBobject, deepParse } from "@foxglove-studio/app/util/binaryObjects";
import {
  TF2_DATATYPE,
  TF_DATATYPE,
  TRANSFORM_STAMPED_DATATYPE,
} from "@foxglove-studio/app/util/globalConstants";

type State = { transforms: Transforms; topics: Topic[]; topicsToDatatypes: Map<string, string> };
type TfMessage = { transforms: TF[] };
type BaseProps = { frame: Frame; cleared?: boolean; topics: Topic[] };

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

function consumeSingleTfs(tfs: Message[] | undefined, transforms: Transforms): void {
  if (tfs != undefined) {
    for (const { message } of tfs) {
      const parsedMessage = (isBobject(message) ? deepParse(message) : message) as TF;
      transforms.consume(parsedMessage);
    }
  }
}

function withTransforms<Props extends any>(ChildComponent: React.ComponentType<Props>) {
  class Component extends React.PureComponent<
    Partial<{
      frame: Frame;
      topics: Topic[];
      cleared?: boolean;
      forwardedRef: any;
    }>,
    State
  > {
    static displayName = `withTransforms(${
      ChildComponent.displayName ?? ChildComponent.name ?? ""
    })`;
    static contextTypes = { store: PropTypes.any };

    state: State = { transforms: new Transforms(), topics: [], topicsToDatatypes: new Map() };

    static getDerivedStateFromProps(
      nextProps: Props,
      prevState: State,
    ): Partial<State> | undefined {
      const { frame, cleared, topics } = nextProps as BaseProps;
      let { transforms, topicsToDatatypes } = prevState;
      if (cleared != undefined && cleared) {
        transforms = new Transforms();
      }

      if (topics !== prevState.topics) {
        topicsToDatatypes = new Map<string, string>(topics.map((t) => [t.name, t.datatype]));
      }

      // Find any references to previously unseen frames in the set of incoming messages
      // Note the naming confusion between `frame` (a map of topic names to messages received on
      // that topic) and transform frames (coordinate frames)
      for (const topic in frame) {
        const datatype = topicsToDatatypes.get(topic) ?? "";
        const msgs = frame[topic] as Message[];
        for (const msg of msgs) {
          {
            const frameId: string | undefined = isBobject(msg.message)
              ? msg.message.header?.().frame_id?.()
              : msg.message.header?.frame_id;
            if (frameId != undefined) {
              transforms.register(frameId);
              continue;
            }
          }
          // A hack specific to MarkerArray messages, which don't themselves have headers, but individual markers do.
          if (isBobject(msg.message)) {
            const markers = msg.message.markers?.();
            if (!markers) {
              continue;
            }
            for (const marker of markers) {
              const frameId = marker.header?.().frame_id?.();
              if (frameId != undefined) {
                transforms.register(frameId);
              }
            }
          } else {
            const markers = msg.message.markers;
            if (!markers) {
              continue;
            }
            for (const marker of markers) {
              const frameId = marker.header?.frame_id;
              if (frameId != undefined) {
                transforms.register(frameId);
              }
            }
          }
        }

        // Process all TF topics (ex: /tf and /tf_static)
        switch (datatype) {
          case TF_DATATYPE:
          case TF2_DATATYPE:
            consumeTfs(msgs, transforms);
            break;
          case TRANSFORM_STAMPED_DATATYPE:
            consumeSingleTfs(msgs, transforms);
            break;
        }
      }

      return { transforms, topics, topicsToDatatypes };
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
