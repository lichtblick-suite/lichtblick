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

import { v4 as uuidv4 } from "uuid";

import {
  MessagePipelineConsumer,
  MessagePipelineContext,
} from "@foxglove-studio/app/components/MessagePipeline";

type Props = {
  topic: string;
  datatype: string;
  name: string;
};

// Component that registers a publisher with the player and provides a publish() function to publish data.
export default class Publisher extends React.PureComponent<Props> {
  _id: string = uuidv4();
  _context?: MessagePipelineContext;

  _getContext(): MessagePipelineContext {
    if (!this._context) {
      throw new Error("this._context is missing in <Publisher>");
    }
    return this._context;
  }

  _setPublishers() {
    const { topic, datatype, name } = this.props;
    this._getContext().setPublishers(this._id, [
      { topic, datatype, advertiser: { type: "panel", name } },
    ]);
  }

  componentDidMount() {
    this._setPublishers();
  }

  componentDidUpdate() {
    this._setPublishers();
  }

  componentWillUnmount() {
    this._getContext().setPublishers(this._id, []);
  }

  publish(msg: any) {
    const { topic } = this.props;
    this._getContext().publish({ topic, msg });
  }

  render() {
    return (
      <MessagePipelineConsumer>
        {(context: MessagePipelineContext) => {
          this._context = context;
          return null;
        }}
      </MessagePipelineConsumer>
    );
  }
}
