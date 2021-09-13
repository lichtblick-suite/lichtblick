// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageBar, MessageBarType } from "@fluentui/react";
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { ToastProps, ToastProvider } from "react-toast-notifications";

const StudioToast = ({
  appearance,
  onDismiss,
  children,
  transitionDuration,
  transitionState,
}: ToastProps) => {
  const barType = (() => {
    switch (appearance) {
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
  const onDismissBar = useCallback(() => onDismiss(), [onDismiss]);

  // Adapted from react-toast-notifications ToastElement
  const [height, setHeight] = useState<string | number>("auto");
  const elementRef = useRef<HTMLDivElement>(ReactNull);
  useEffect(() => {
    if (transitionState === "entered") {
      setHeight(elementRef.current?.offsetHeight ?? "auto");
    }
    if (transitionState === "exiting") {
      setHeight(0);
    }
  }, [transitionState]);

  return (
    <div ref={elementRef} style={{ height, transition: `height ${transitionDuration}ms` }}>
      <MessageBar
        messageBarType={barType}
        isMultiline={false}
        onDismiss={onDismissBar}
        dismissButtonAriaLabel="Close"
        styles={{
          text: { alignItems: "center" },
          root: {
            transition: `transform ${transitionDuration}ms, opacity ${transitionDuration}ms`,
            transform: transitionState === "entered" ? "" : "scale(0.66)",
            opacity: transitionState === "entered" ? 1 : 0,
          },
        }}
      >
        {children}
      </MessageBar>
    </div>
  );
};

export default function StudioToastProvider(props: PropsWithChildren<unknown>): JSX.Element {
  return (
    <ToastProvider placement="top-center" components={{ Toast: StudioToast }}>
      {props.children}
    </ToastProvider>
  );
}
