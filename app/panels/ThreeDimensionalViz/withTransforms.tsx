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
import * as React from "react";

import { getGlobalHooks } from "../../loadWebviz";
import Transforms from "@foxglove-studio/app/panels/ThreeDimensionalViz/Transforms";
import { Frame } from "@foxglove-studio/app/players/types";
import { isBobject, deepParse } from "@foxglove-studio/app/util/binaryObjects";
import { TRANSFORM_STATIC_TOPIC, TRANSFORM_TOPIC } from "@foxglove-studio/app/util/globalConstants";

type State = { transforms: Transforms };

function withTransforms<Props extends any>(ChildComponent: React.ComponentType<Props>) {
  class Component extends React.PureComponent<
    Partial<{ frame: Frame; cleared: boolean; forwardedRef: any }>,
    State
  > {
    static displayName = `withTransforms(${
      ChildComponent.displayName || ChildComponent.name || ""
    })`;
    static contextTypes = { store: PropTypes.any };

    state: State = { transforms: new Transforms() };

    static getDerivedStateFromProps(
      nextProps: Props,
      prevState: State,
    ): Partial<State> | undefined {
      const { frame, cleared }: any = nextProps;
      let { transforms } = prevState;
      if (cleared) {
        transforms = new Transforms();
      }

      const tfs = frame[TRANSFORM_TOPIC];
      if (tfs) {
        const skipFrameId = getGlobalHooks().perPanelHooks().ThreeDimensionalViz.sceneBuilderHooks
          .skipTransformFrame?.frameId;
        for (const { message } of tfs) {
          const parsedMessage = isBobject(message) ? deepParse(message) : message;
          for (const tf of parsedMessage.transforms) {
            if (tf.child_frame_id !== skipFrameId) {
              transforms.consume(tf);
            }
          }
        }
      }
      const tfs_static = frame[TRANSFORM_STATIC_TOPIC];
      if (tfs_static) {
        for (const { message } of tfs_static) {
          const parsedMessage = isBobject(message) ? deepParse(message) : message;
          for (const tf of parsedMessage.transforms) {
            transforms.consume(tf);
          }
        }
      }

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
