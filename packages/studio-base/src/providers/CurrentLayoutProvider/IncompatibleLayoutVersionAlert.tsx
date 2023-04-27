// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

type Props = {
  isDesktop?: boolean;
  onClose: () => void;
};

export function IncompatibleLayoutVersionAlert(props: Props): JSX.Element {
  const { isDesktop, onClose } = props;
  const { t } = useTranslation("incompatibleLayoutVersion");

  const showDesktopText = isDesktop ?? isDesktopApp();

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>{t("title")}</DialogTitle>
      <DialogContent>
        {showDesktopText && (
          <DialogContentText>
            {t("desktopText")}
            <Link target="_blank" href="https://foxglove.dev/download">
              https://foxglove.dev/download
            </Link>
            .
          </DialogContentText>
        )}
        {!showDesktopText && <DialogContentText>{t("webText")}</DialogContentText>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}
