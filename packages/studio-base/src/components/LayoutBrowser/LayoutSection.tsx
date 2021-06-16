// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles, Stack, Text } from "@fluentui/react";
import { AsyncState } from "react-use/lib/useAsyncFn";

import LayoutRow from "./LayoutRow";
import { LayoutItem } from "./types";

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
}));

export default function LayoutSection<T extends LayoutItem>({
  title,
  items,
  selectedId,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
}: {
  title?: string;
  items: AsyncState<readonly T[]>;
  selectedId?: string;
  onSelect: (item: T) => void;
  onRename: (item: T, newName: string) => void;
  onDuplicate: (item: T) => void;
  onDelete: (item: T) => void;
  onExport: (item: T) => void;
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
        {items.error ? `Error: ${items.error}` : undefined}
        {items.value?.map((layout) => (
          <LayoutRow
            selected={layout.id === selectedId}
            key={layout.id}
            layout={layout}
            onSelect={onSelect}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onExport={onExport}
          />
        ))}
      </Stack.Item>
    </Stack>
  );
}
