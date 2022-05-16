// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography, styled as muiStyled } from "@mui/material";

import Stack from "@foxglove/studio-base/components/Stack";
import { Layout } from "@foxglove/studio-base/services/ILayoutStorage";

import LayoutRow from "./LayoutRow";

const SectionHeader = muiStyled(Typography)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));

const EmptyText = muiStyled(Typography)(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

export default function LayoutSection({
  title,
  emptyText,
  items,
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
  emptyText: string | undefined;
  items: readonly Layout[] | undefined;
  selectedId?: string;
  onSelect: (item: Layout, params?: { selectedViaClick?: boolean }) => void;
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
        <SectionHeader as="h2" variant="overline">
          {title}
        </SectionHeader>
      )}
      <div>
        <EmptyText>{items != undefined && items.length === 0 && emptyText}</EmptyText>
        {items?.map((layout) => (
          <LayoutRow
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
      </div>
    </Stack>
  );
}
