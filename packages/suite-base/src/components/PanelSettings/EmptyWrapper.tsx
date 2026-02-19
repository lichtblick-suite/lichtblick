// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import { SidebarContent } from "@lichtblick/suite-base/components/SidebarContent";

export type EmptyWrapperProps = {
  children: React.ReactNode;
  enableNewTopNav: boolean;
};

export const EmptyWrapper = ({
  children,
  enableNewTopNav,
}: EmptyWrapperProps): React.JSX.Element => {
  const { t } = useTranslation("panelSettings");

  if (enableNewTopNav) {
    return <EmptyState>{children}</EmptyState>;
  }

  return (
    <SidebarContent title={t("panelSettings")}>
      <Typography variant="body2" color="text.secondary">
        {children}
      </Typography>
    </SidebarContent>
  );
};
