// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography } from "@mui/material";
import { ReactNode } from "react";

import { useStylesDiffStats } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import { diffLabels, DiffObject } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import { getChangeCounts } from "@lichtblick/suite-base/panels/RawMessagesCommon/utils";

export default function DiffStats({
  data,
  itemType,
}: {
  data: DiffObject;
  itemType: ReactNode;
}): React.JSX.Element {
  const { classes } = useStylesDiffStats();
  const { ADDED, DELETED, CHANGED, ID } = diffLabels;
  const id = data[ID.labelText] as DiffObject | undefined;
  const idLabel = id
    ? Object.keys(id)
        .map((key) => `${key}: ${id[key]}`)
        .join(", ")
    : undefined;

  const counts = getChangeCounts(data, {
    [ADDED.labelText]: 0,
    [CHANGED.labelText]: 0,
    [DELETED.labelText]: 0,
  });

  return (
    <>
      {id && (
        <>
          {itemType} {idLabel}
        </>
      )}
      <div className={classes.diff}>
        {(counts[ADDED.labelText] !== 0 || counts[DELETED.labelText] !== 0) && (
          <div className={classes.badge}>
            {counts[ADDED.labelText] !== 0 && (
              <Typography variant="caption" color="success.main">
                {`${diffLabels.ADDED.indicator}${counts[ADDED.labelText]}`}
              </Typography>
            )}
            {counts[DELETED.labelText] !== 0 && (
              <Typography variant="caption" color="error.main">
                {`${diffLabels.DELETED.indicator}${counts[DELETED.labelText]}`}
              </Typography>
            )}
          </div>
        )}
        {counts[CHANGED.labelText] !== 0 && <div className={classes.changeIndicator} />}
      </div>
    </>
  );
}
