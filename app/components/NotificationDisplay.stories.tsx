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

import { storiesOf } from "@storybook/react";
import moment from "moment";
import { useRef } from "react";

import NotificationDisplay, {
  NotificationList,
  NotificationModal,
  NotificationMessage,
} from "@foxglove/studio-base/components/NotificationDisplay";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

const randomNum = () => Math.floor(Math.random() * 1000);
const addError = () =>
  sendNotification(`Another error #${randomNum()}`, "some details", "app", "error");
const addWarning = () =>
  sendNotification(`Another warning #${randomNum()}`, "some details", "app", "warn");
const addInfo = () =>
  sendNotification(`Another message #${randomNum()}`, "some details", "app", "info");

const NotificationDisplayWrapper = () => (
  <div style={{ padding: 10 }}>
    <div style={{ width: 300, height: 36 }}>
      <NotificationDisplay />
    </div>
    <AddMoreButtons />
  </div>
);

const AddMoreButtons = () => (
  <div style={{ paddingTop: 20 }}>
    <button onClick={addInfo}>add info</button>
    <button onClick={addWarning}>add warning</button>
    <button onClick={addError}>add error</button>
  </div>
);

storiesOf("components/NotificationDisplay", module)
  .addParameters({
    chromatic: {
      delay: 1000,
    },
  })
  .add("No errors", () => {
    return <NotificationDisplayWrapper />;
  })
  .add("With one error", () => {
    class Wrapper extends React.Component<any> {
      override componentDidMount() {
        sendNotification(
          "Something bad happened",
          "This error is on purpose - it comes from the story",
          "app",
          "error",
        );
      }

      override render() {
        return <NotificationDisplayWrapper />;
      }
    }
    return <Wrapper />;
  })
  .add("With one warning", () => {
    class Wrapper extends React.Component<any> {
      override componentDidMount() {
        sendNotification(
          "This is the final countdown",
          "This warning is on purpose - it comes from the story",
          "app",
          "warn",
        );
      }

      override render() {
        return <NotificationDisplayWrapper />;
      }
    }
    return <Wrapper />;
  })
  .add("With one message", () => {
    class Wrapper extends React.Component<any> {
      override componentDidMount() {
        sendNotification(
          "Here's a helpful tip",
          "These are the details of the message",
          "user",
          "info",
        );
      }

      override render() {
        return <NotificationDisplayWrapper />;
      }
    }
    return <Wrapper />;
  })
  .add("expanded with 4 messages", () => {
    const el = useRef<HTMLDivElement>(ReactNull);
    React.useLayoutEffect(() => {
      sendNotification(
        "Something bad happened 1",
        "This error is on purpose - it comes from the story",
        "app",
        "error",
      );
      sendNotification(
        "Something bad happened 2",
        "This error is on purpose - it comes from the story",
        "app",
        "error",
      );
      sendNotification(
        "Just a warning",
        "This warning is on purpose - it comes from the story",
        "app",
        "warn",
      );
      sendNotification(
        "Something bad happened 3",
        "This error is on purpose - it comes from the story",
        "app",
        "error",
      );

      setImmediate(() => {
        el.current?.querySelector<HTMLElement>(".icon")?.click();
      });
    }, []);
    return (
      <div style={{ padding: 10 }} ref={el}>
        <NotificationDisplayWrapper />
      </div>
    );
  })
  .add("Error list", () => {
    // make the container very short to test scrolling
    const style = { width: 400, height: 150, margin: 20 };
    const date = new Date();
    const errors: NotificationMessage[] = [
      {
        id: "1",
        message: "Error 1",
        details: "Some error details",
        read: true,
        created: moment(date).subtract(307, "minutes").toDate(),
        severity: "error",
      },
      {
        id: "2",
        message: "Some very long error message that should be truncated",
        details: "Some error details",
        read: true,
        created: moment(date).subtract(31, "minutes").toDate(),
        severity: "error",
      },
      {
        id: "5",
        message: "Foo foo baz",
        details: "Some error details",
        read: false,
        created: moment(date).subtract(17, "minutes").toDate(),
        severity: "error",
      },
      {
        id: "4",
        message: "Warn foo bar baz",
        details: "Some warning details",
        read: false,
        created: moment(date).subtract(11, "minutes").toDate(),
        severity: "warn",
      },
      {
        id: "3",
        message: "Some fake error",
        details: "Foo bar baz this is a long-ish error details string",
        read: false,
        created: moment(date).subtract(3, "seconds").toDate(),
        severity: "error",
      },
    ];
    return (
      <div style={style}>
        <NotificationList
          notifications={errors}
          onClick={() => {
            // no-ops
          }}
        />
      </div>
    );
  })
  .add("Error Modal", () => {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: "Some error details",
          read: false,
          created: new Date(),
          severity: "error",
        }}
      />
    );
  })
  .add("Warning Modal", () => {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Warning 1",
          details: "Some error details",
          read: false,
          created: new Date(),
          severity: "warn",
        }}
      />
    );
  })
  .add("Error Modal without details", () => {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: undefined,
          read: false,
          created: new Date(),
          severity: "error",
        }}
      />
    );
  })
  .add("Error Modal with details in React.Node type", () => {
    return (
      <NotificationModal
        onRequestClose={() => {}}
        notification={{
          id: "1",
          message: "Error 1",
          details: (
            <p>
              This is <b style={{ color: "red" }}>customized</b> error detail.
            </p>
          ),
          read: false,
          created: new Date(),
          severity: "error",
        }}
      />
    );
  });
