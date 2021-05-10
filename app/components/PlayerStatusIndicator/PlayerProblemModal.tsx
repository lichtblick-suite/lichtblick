// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyleSets } from "@fluentui/react";
import { ComponentProps } from "react";

import Modal, { Title } from "@foxglove-studio/app/components/Modal";
import { PlayerProblem } from "@foxglove-studio/app/players/types";
import mixins from "@foxglove-studio/app/styles/mixins.module.scss";

type ModalProps = ComponentProps<typeof Modal>;

type Props = {
  problem: PlayerProblem;
  onRequestClose: ModalProps["onRequestClose"];
};

const styles = mergeStyleSets({
  modalBody: {
    padding: "28px",
    maxWidth: "600px",
    minWidth: "300px",
    maxHeight: "80vh",
    overflow: "auto",
  },
  tip: {
    paddingBottom: "8px",
  },
  error: {
    fontFamily: mixins.monospaceFont,
    whiteSpace: "normal",
  },
});

export default function PlayerProblemModal(props: Props): JSX.Element {
  const { problem } = props;

  return (
    <Modal onRequestClose={props.onRequestClose}>
      <Title>{problem.message}</Title>
      <hr />
      <div className={styles.modalBody}>
        {problem.tip != undefined && (
          <div className={styles.tip}>
            <span>{problem.tip}</span>
          </div>
        )}
        {problem.error?.stack != undefined && (
          <pre className={styles.error}>{problem.error.stack}</pre>
        )}
      </div>
    </Modal>
  );
}
