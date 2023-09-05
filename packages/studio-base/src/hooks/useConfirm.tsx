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

import { Dialog, DialogContent, DialogTitle, DialogActions, Button } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKeyPressEvent } from "react-use";

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

  useKeyPressEvent("Enter", () => {
    onComplete("ok");
  });

  // Ensure we still call onComplete(undefined) when the component unmounts, if it hasn't been
  // called already
  useEffect(() => {
    return () => {
      onComplete("cancel");
    };
  }, [onComplete]);

  const buttons = [
    props.cancel !== false && (
      <Button
        size="large"
        variant="outlined"
        color="inherit"
        key="cancel"
        onClick={() => {
          onComplete("cancel");
        }}
      >
        {props.cancel ?? "Cancel"}
      </Button>
    ),
    <Button
      key="confirm"
      variant="contained"
      size="large"
      color={props.variant === "danger" ? "error" : "primary"}
      type="submit"
    >
      {props.ok ?? "OK"}
    </Button>,
  ];
  if (props.variant === "danger") {
    buttons.reverse();
  }

  return (
    <Dialog
      open
      onClose={() => {
        onComplete("cancel");
      }}
      maxWidth="xs"
      fullWidth
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onComplete("ok");
        }}
      >
        <DialogTitle>{props.title}</DialogTitle>
        <DialogContent>{props.prompt}</DialogContent>
        <DialogActions>{buttons}</DialogActions>
      </form>
    </Dialog>
  );
}

// Returns a function that can be used similarly to the DOM confirm(), but
// backed by a React element rather than a native modal, and asynchronous.
export function useConfirm(): [
  confirm: (options: ConfirmOptions) => Promise<ConfirmAction>,
  confirmModal: JSX.Element | undefined,
] {
  const [modal, setModal] = useState<JSX.Element | undefined>();

  const openConfirm = useCallback(async (options: ConfirmOptions) => {
    return await new Promise<ConfirmAction>((resolve) => {
      setModal(
        <ConfirmModal
          {...options}
          onComplete={(value) => {
            resolve(value);
            setModal(undefined);
          }}
        />,
      );
    });
  }, []);

  return [openConfirm, modal];
}
