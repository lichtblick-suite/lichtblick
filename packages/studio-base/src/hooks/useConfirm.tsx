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

import { DefaultButton, Dialog, DialogFooter } from "@fluentui/react";
import { useCallback, useEffect, useContext, useRef } from "react";

import ModalContext from "@foxglove/studio-base/context/ModalContext";

type ConfirmVariant = "danger" | "primary";
type ConfirmAction = "ok" | "cancel";

type ConfirmOptions = {
  // the title of the confirm modal
  title: string;
  // text in the body of the confirm modal. Specify a string or JSX Element
  prompt?: string | JSX.Element;
  // the text for the OK button - defaults to "OK"
  ok?: string;
  // the text for the cancel button - defaults to "Cancel"
  // set to false to completely hide the cancel button
  cancel?: string | false;
  // indicate the type of confirmation
  variant?: ConfirmVariant;
};

type ConfirmModalProps = ConfirmOptions & {
  onComplete: (value: ConfirmAction) => void;
};

function ConfirmModal(props: ConfirmModalProps) {
  const originalOnComplete = props.onComplete;

  const completed = useRef(false);
  const onComplete = useCallback(
    (result: ConfirmAction) => {
      if (!completed.current) {
        completed.current = true;
        originalOnComplete(result);
      }
    },
    [originalOnComplete],
  );

  // Ensure we still call onComplete(undefined) when the component unmounts, if it hasn't been
  // called already
  useEffect(() => {
    return () => onComplete("cancel");
  }, [onComplete]);

  const confirmStyle = props.variant ?? "primary";

  const buttons = [
    props.cancel !== false && (
      <DefaultButton
        key="cancel"
        onClick={() => onComplete("cancel")}
        text={props.cancel ?? "Cancel"}
      />
    ),
    <DefaultButton
      key="confirm"
      primary={confirmStyle === "primary"}
      styles={
        confirmStyle === "danger"
          ? {
              root: { backgroundColor: "#c72121", borderColor: "#c72121", color: "white" },
              rootHovered: {
                backgroundColor: "#b31b1b",
                borderColor: "#b31b1b",
                color: "white",
              },
              rootPressed: {
                backgroundColor: "#771010",
                borderColor: "#771010",
                color: "white",
              },
            }
          : undefined
      }
      type="submit"
      text={props.ok ?? "OK"}
    />,
  ];
  if (confirmStyle === "danger") {
    buttons.reverse();
  }

  return (
    <Dialog
      hidden={false}
      onDismiss={() => onComplete("cancel")}
      dialogContentProps={{ title: props.title }}
      minWidth={320}
      maxWidth={480}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onComplete("ok");
        }}
      >
        {props.prompt}
        <DialogFooter styles={{ actions: { whiteSpace: "nowrap" } }}>{buttons}</DialogFooter>
      </form>
    </Dialog>
  );
}

// Returns a function that can be used similarly to the DOM confirm(), but
// backed by a React element rather than a native modal, and asynchronous.
export function useConfirm(): (options: ConfirmOptions) => Promise<ConfirmAction> {
  const modalHost = useContext(ModalContext);

  const openConfirm = useCallback(
    async (options: ConfirmOptions) => {
      return await new Promise<ConfirmAction>((resolve) => {
        const remove = modalHost.addModalElement(
          <ConfirmModal
            {...options}
            onComplete={(value) => {
              resolve(value);
              remove();
            }}
          />,
        );
      });
    },
    [modalHost],
  );

  return openConfirm;
}
