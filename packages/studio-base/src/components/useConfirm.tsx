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
import React, { useState, useCallback } from "react";

type ConfirmStyle = "danger" | "primary";

type Props = {
  // the title of the confirm modal
  title: string;
  // the prompt text in the body of the confirm modal
  prompt?: string;
  // the text for the OK button - defaults to "OK"
  ok?: string;
  // the text for the cancel button - defaults to "Cancel"
  // set to false to completely hide the cancel button
  cancel?: string | false;

  // whether to use red/green/no color on the confirm button
  confirmStyle: ConfirmStyle;

  // action to run when the dialog is closed
  action(ok: boolean): void;
};

// shows a confirmation modal to the user with an ok and a cancel button
export default function useConfirm(props: Props): {
  modal?: React.ReactElement | ReactNull;
  open: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);

  function close(ok: boolean) {
    setIsOpen(false);
    props.action(ok);
  }
  const confirmStyle = props.confirmStyle ?? "danger";

  const buttons = [
    props.cancel !== false && (
      <DefaultButton onClick={() => close(false)} text={props.cancel ?? "Cancel"} />
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

  const modal = (
    <Dialog
      hidden={!isOpen}
      onDismiss={() => close(false)}
      dialogContentProps={{ title: props.title, subText: props.prompt }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          close(true);
        }}
      >
        <DialogFooter styles={{ actions: { whiteSpace: "nowrap" } }}>{buttons}</DialogFooter>
      </form>
    </Dialog>
  );

  return { modal, open };
}
