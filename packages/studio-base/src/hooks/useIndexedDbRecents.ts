// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { set as idbSet, get as idbGet, createStore as idbCreateStore } from "idb-keyval";
import { isEqual } from "lodash";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "react-use";
import { v4 as uuid } from "uuid";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

const IDB_KEY = "recents";
const IDB_STORE = idbCreateStore("foxglove-recents", "recents");

type RecentRecordCommon = {
  // Record id - use IndexedDbRecentsStore.GenerateRecordId() to generate
  id: string;

  // The source id
  sourceId: string;

  // The primary text for the recent record
  title: string;

  // Optional label for the recent record
  label?: string;
};

type RecentConnectionRecord = RecentRecordCommon & {
  type: "connection";
  // Optional arguments stored with the recent entry
  extra?: Record<string, string | undefined>;
};

type RecentFileRecord = RecentRecordCommon & {
  type: "file";
  handle: FileSystemFileHandle; // foxglove-depcheck-used: @types/wicg-file-system-access
};

type UnsavedRecentRecord = Omit<RecentConnectionRecord, "id"> | Omit<RecentFileRecord, "id">;

type RecentRecord = RecentConnectionRecord | RecentFileRecord;

interface IRecentsStore {
  // Recent records
  recents: RecentRecord[];

  // Add a new recent
  addRecent: (newRecent: UnsavedRecentRecord) => void;

  // Save changes
  save: () => Promise<void>;
}

function useIndexedDbRecents(): IRecentsStore {
  const { value: initialRecents, loading } = useAsync(
    async () => await idbGet<RecentRecord[] | undefined>(IDB_KEY, IDB_STORE),
    [],
  );

  const [recents, setRecents] = useState<RecentRecord[]>([]);

  // Track new recents in a ref and update the state after persisting
  const newRecentsRef = useRef<RecentRecord[]>([]);

  const save = useCallback(async () => {
    // We don't save until we've loaded our existing recents. This ensures we include stored recents when we save
    if (loading) {
      return;
    }

    // The new recent appears at the start of the list
    const recentsToSave: RecentRecord[] = [];

    // For every ref in newRecentsRef, we need to eliminate any potential duplicates already in
    // recentsToSave
    for (const newRecent of newRecentsRef.current) {
      let exists = false;
      for (const savedRecent of recentsToSave) {
        if (exists) {
          continue;
        }

        // Filter file recents to ignore any previous recent that match this record.
        // This happens if we want to add a file to recents that we already have
        if (
          savedRecent.type === "file" &&
          newRecent.type === savedRecent.type &&
          (await savedRecent.handle.isSameEntry(newRecent.handle))
        ) {
          exists = true;
        }

        // Filter connection recents which match the same sourceId and extra args
        if (
          savedRecent.type === "connection" &&
          newRecent.type === savedRecent.type &&
          savedRecent.sourceId === newRecent.sourceId &&
          isEqual(newRecent.extra, savedRecent.extra)
        ) {
          exists = true;
        }
      }

      // Max 5 entries
      if (!exists && recentsToSave.length < 5) {
        recentsToSave.push(newRecent);
      }
    }

    setRecents(recentsToSave);
    idbSet(IDB_KEY, recentsToSave, IDB_STORE).catch((err) => {
      log.error(err);
    });
  }, [loading]);

  // Set the first load records from the store to the state
  useLayoutEffect(() => {
    if (loading) {
      return;
    }

    const haveUnsavedRecents = newRecentsRef.current.length > 0;

    if (initialRecents) {
      newRecentsRef.current.push(...initialRecents);
    }

    if (haveUnsavedRecents) {
      void save();
    } else {
      // No new recents by the time we loaded our initial recents so we don't need to save
      // Normally a save invokes set - but since we don't need to save we set here
      setRecents(newRecentsRef.current);
    }
  }, [loading, initialRecents, save]);

  const addRecent = useCallback(
    (record: UnsavedRecentRecord) => {
      const fullRecord: RecentRecord = {
        id: uuid(),
        ...record,
      };
      newRecentsRef.current.unshift(fullRecord);
      void save();
    },
    [save],
  );

  return useMemo<IRecentsStore>(() => {
    return {
      recents,
      addRecent,
      save,
    };
  }, [addRecent, recents, save]);
}

export default useIndexedDbRecents;
