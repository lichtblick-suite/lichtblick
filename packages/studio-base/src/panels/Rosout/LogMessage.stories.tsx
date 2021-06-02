// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import LogMessage from "./LogMessage";

export default {
  title: "panels/Rosout/LogMessage",
  component: LogMessage,
};

export const Debug = (): JSX.Element => {
  return (
    <LogMessage
      msg={{
        header: {
          stamp: { sec: 0, nsec: 0 },
          frame_id: "foo",
          seq: 0,
        },
        level: 1,
        name: "name",
        msg: "message",
        file: "file",
        function: "func",
        line: 0,
        topics: [],
      }}
    />
  );
};

export const Error = (): JSX.Element => {
  return (
    <LogMessage
      msg={{
        header: {
          stamp: { sec: 0, nsec: 0 },
          frame_id: "foo",
          seq: 0,
        },
        level: 8,
        name: "name",
        msg: "message",
        file: "file",
        function: "func",
        line: 0,
        topics: [],
      }}
    />
  );
};
