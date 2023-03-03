// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography, List } from "@mui/material";
import { MouseEvent } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import { Layout } from "@foxglove/studio-base/services/ILayoutStorage";

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
}: {
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
}): JSX.Element {
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
        {items != undefined && items.length === 0 && (
          <Stack paddingX={2}>
            <Typography variant="body2" color="text.secondary">
              {emptyText}
            </Typography>
          </Stack>
        )}
        {items?.map((layout) => (
          <LayoutRow
            anySelectedModifiedLayouts={anySelectedModifiedLayouts}
            multiSelectedIds={multiSelectedIds}
            selected={layout.id === selectedId}
            key={layout.id}
            layout={layout}
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
    </Stack>
  );
}
