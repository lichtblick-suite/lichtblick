// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography, List } from "@mui/material";
import { MouseEvent } from "react";

import Stack from "@lichtblick/suite-base/components/Stack";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

import LayoutRow from "./LayoutRow";

export default function LayoutSection({
  title,
  disablePadding = false,
  emptyText,
  items,
  anySelectedModifiedLayouts,
  multiSelectedIds,
  selectedId,
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
  emptyText: string | undefined;
  items: readonly Layout[] | undefined;
  anySelectedModifiedLayouts: boolean;
  multiSelectedIds: readonly string[];
  selectedId?: string;
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
  // Get multiple selected layouts and handle bulk actions
  const selectedLayouts = items?.filter((layout) => multiSelectedIds.includes(layout.id)) ?? [];
  const handleDuplicateSelected = () => {
    selectedLayouts.forEach(onDuplicate);
  };
  const handleDeleteSelected = () => {
    selectedLayouts.forEach(onDelete);
  };
  const handleOverwriteSelected = () => {
    selectedLayouts.forEach(onOverwrite);
  };
  const handleRevertSelected = () => {
    selectedLayouts.forEach(onRevert);
  };

  return (
    <Stack>
      {title != undefined && (
        <Stack paddingX={2} paddingY={disablePadding ? 1 : 0}>
          <Typography variant="overline" color="text.secondary">
            {title}
          </Typography>
        </Stack>
      )}
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
            onDuplicate={handleDuplicateSelected}
            onDelete={(clickedLayout) => {
              if (multiSelectedIds.includes(clickedLayout.id)) {
                handleDeleteSelected();
              } else {
                onDelete(clickedLayout);
              }
            }}
            onShare={onShare}
            onExport={onExport}
            onOverwrite={handleOverwriteSelected}
            onRevert={handleRevertSelected}
            onMakePersonalCopy={onMakePersonalCopy}
          />
        ))}
      </List>
    </Stack>
  );
}
