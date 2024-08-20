// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// eslint-disable-next-line filenames/match-exported
import { MessageDefinition } from "@foxglove/message-definition";

export type MqttMsg = {
  MQ_msgs: MessageDefinition;
};
declare const mq: MqttMsg;
export { mq };
// eslint-disable-next-line no-underscore-dangle
declare const _default: {
  mq: MqttMsg;
};
export default _default;
