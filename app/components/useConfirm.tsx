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

import React, { useState, useCallback } from "react";

import styles from "./Confirm.module.scss";
import Button from "@foxglove-studio/app/components/Button";
import Flex from "@foxglove-studio/app/components/Flex";
import Modal, { Title } from "@foxglove-studio/app/components/Modal";
import { RenderToBodyComponent } from "@foxglove-studio/app/components/RenderToBodyComponent";

type ConfirmStyle = "danger" | "primary";

type Props = {
  // the title of the confirm modal - defaults to 'Are you sure?'
  title?: string;
  // the prompt text in the body of the confirm modal
  prompt: string;
  // the text for the OK button - defaults to "OK"
  ok?: string;
  // the text for the cancel button - defaults to "Cancel"
  // set to false to completely hide the cancel button
  cancel?: string | false;

  // whether to use red/green/no color on the confirm button
  confirmStyle?: ConfirmStyle;

  // action to run when the dialog is closed
  action(ok: boolean): void;
};

// shows a confirmation modal to the user with an ok and a cancel button
// returns a promise which resolves with true if the user confirmed the modal
// or false if the user closed the modal with escape or clicked the cancel button
export default function useConfirm(
  props: Props,
): { modal?: React.ReactElement | ReactNull; open: () => void } {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);

  function close(ok: boolean) {
    setIsOpen(false);
    props.action(ok);
  }
  const confirmStyle = props.confirmStyle ?? "danger";
  const modal = !isOpen ? (
    ReactNull
  ) : (
    <RenderToBodyComponent>
      <Modal onRequestClose={() => close(false)}>
        <div className={styles.container}>
          <Title>{props.title ?? "Are you sure?"}</Title>
          <hr />
          <Flex col style={{ padding: "32px" }}>
            <div className={styles.prompt}>{props.prompt}</div>
            <div className={styles.controls}>
              {props.cancel !== false && (
                <Button onClick={() => close(false)}>{props.cancel ?? "Cancel"}</Button>
              )}
              <Button
                danger={confirmStyle === "danger"}
                primary={confirmStyle === "primary"}
                onClick={() => close(true)}
              >
                {props.ok ?? "OK"}
              </Button>
            </div>
          </Flex>
        </div>
      </Modal>
    </RenderToBodyComponent>
  );

  return { modal, open };
}
