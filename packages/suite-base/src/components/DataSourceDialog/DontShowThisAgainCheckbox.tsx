// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Checkbox, FormControlLabel } from "@mui/material";
import { useTranslation } from "react-i18next";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

const DontShowThisAgainCheckbox = (): React.JSX.Element => {
  const { t } = useTranslation("openDialog");

  const [checked = true, setChecked] = useAppConfigurationValue<boolean>(
    AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP,
  );

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await setChecked(!event.target.checked);
  };

  const LabelComponent = <span style={{ fontSize: "0.7rem" }}>{t("dontShowThisAgain")}</span>;

  return (
    <Stack direction="row" justifyContent="right">
      <FormControlLabel
        label={LabelComponent}
        control={<Checkbox size="small" checked={!checked} onChange={handleChange} />}
      />
    </Stack>
  );
};

export default DontShowThisAgainCheckbox;
