// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles, Stack, Text } from "@fluentui/react";

import { Layout } from "@foxglove/studio-base/services/ILayoutStorage";

import LayoutRow from "./LayoutRow";

const useStyles = makeStyles((theme) => ({
  sectionHeader: [
    theme.fonts.medium,
    {
      fontVariant: "small-caps",
      textTransform: "lowercase",
      color: theme.palette.neutralSecondaryAlt,
      letterSpacing: "0.5px",
      paddingLeft: theme.spacing.m,
      paddingRight: theme.spacing.m,
      marginTop: theme.spacing.m,
      marginBottom: theme.spacing.s1,
    },
  ],

  emptyText: {
    display: "block",
    paddingLeft: theme.spacing.m,
    paddingRight: theme.spacing.m,
  },
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
  const styles = useStyles();
  return (
    <Stack>
      {title != undefined && (
        <Text as="h2" className={styles.sectionHeader}>
          {title}
        </Text>
      )}
      <Stack.Item>
        <Text className={styles.emptyText} styles={{ root: { lineHeight: "1.3" } }}>
          {items != undefined && items.length === 0 && emptyText}
        </Text>
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
      </Stack.Item>
    </Stack>
  );
}
