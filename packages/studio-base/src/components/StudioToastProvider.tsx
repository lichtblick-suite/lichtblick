// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageBar, MessageBarType } from "@fluentui/react";
import { PropsWithChildren } from "react";
import { ToastProps, ToastProvider } from "react-toast-notifications";

const StudioToast = (props: ToastProps) => {
  const barType = (() => {
    switch (props.appearance) {
      case "info":
        return MessageBarType.info;
      case "success":
        return MessageBarType.success;
      case "warning":
        return MessageBarType.warning;
      case "error":
        return MessageBarType.error;
      default:
        return MessageBarType.info;
    }
  })();

  return (
    <MessageBar
      messageBarType={barType}
      isMultiline={false}
      onDismiss={() => props.onDismiss()}
      dismissButtonAriaLabel="Close"
      styles={{
        text: {
          alignItems: "center",
        },
      }}
    >
      {props.children}
    </MessageBar>
  );
};

export default function StudioToastProvider(props: PropsWithChildren<unknown>): JSX.Element {
  return (
    <ToastProvider placement="top-center" components={{ Toast: StudioToast }}>
      {props.children}
    </ToastProvider>
  );
}
