// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { ButtonBase, Collapse, Typography, List } from "@mui/material";
import { MouseEvent } from "react";

import Stack from "@lichtblick/suite-base/components/Stack";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

import LayoutRow from "./LayoutRow";
import { useLayoutSectionStyles } from "./LayoutSection.style";

export default function LayoutSection({
  title,
  disablePadding = false,
  expanded = true,
  emptyText,
  items,
  anySelectedModifiedLayouts,
  multiSelectedIds,
  selectedId,
  onToggleExpanded,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  onExport,
  onOverwrite,
  onRevert,
  onMakePersonalCopy,
}: Readonly<{
  title: string | undefined;
  disablePadding?: boolean;
  expanded?: boolean;
  emptyText: string | undefined;
  items: readonly Layout[] | undefined;
  anySelectedModifiedLayouts: boolean;
  multiSelectedIds: readonly string[];
  selectedId?: string;
  onToggleExpanded?: () => void;
  onSelect: (item: Layout, params?: { selectedViaClick?: boolean; event?: MouseEvent }) => void;
  onRename: (item: Layout, newName: string) => void;
  onDuplicate: (item: Layout) => void;
  onDelete: (item: Layout) => void;
  onShare: (item: Layout) => void;
  onExport: (item: Layout) => void;
  onOverwrite: (item: Layout) => void;
  onRevert: (item: Layout) => void;
  onMakePersonalCopy: (item: Layout) => void;
}>): React.JSX.Element {
  const { classes, cx } = useLayoutSectionStyles();

  const isCollapsible = title != undefined;

  return (
    <Stack>
      {title != undefined && (
        <ButtonBase
          className={classes.sectionHeader}
          onClick={onToggleExpanded}
          disableRipple
          data-testid={`layout-section-header-${title}`}
        >
          <ArrowDropDownIcon
            className={cx(classes.arrow, { [classes.arrowCollapsed]: !expanded })}
          />
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
        </ButtonBase>
      )}
      <Collapse in={!isCollapsible || expanded} unmountOnExit>
        <List disablePadding={disablePadding}>
          {items?.length === 0 && (
            <Stack paddingX={2}>
              <Typography variant="body2" color="text.secondary">
                {emptyText}
              </Typography>
            </Stack>
          )}
          {items?.map((layout) => (
            <LayoutRow
              key={layout.id}
              layout={layout}
              anySelectedModifiedLayouts={anySelectedModifiedLayouts}
              multiSelectedIds={multiSelectedIds}
              selected={selectedId === layout.id}
              onSelect={onSelect}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onShare={onShare}
              onExport={onExport}
              onOverwrite={onOverwrite}
              onRevert={onRevert}
              onMakePersonalCopy={onMakePersonalCopy}
            />
          ))}
        </List>
      </Collapse>
    </Stack>
  );
}
