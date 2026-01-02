// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { useAsyncFn } from "react-use";
import { useDebounce } from "use-debounce";

import Log from "@lichtblick/log";
import { UseExtensionSettingsHook } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { useExtensionMarketplace } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

const log = Log.getLogger(__filename);

const useExtensionSettings = (): UseExtensionSettingsHook => {
  const [undebouncedFilterText, setUndebouncedFilterText] = useState<string>("");
  const [debouncedFilterText] = useDebounce(undebouncedFilterText, 50);

  const installed = useExtensionCatalog((state) => state.installedExtensions);
  const marketplace = useExtensionMarketplace();

  const [marketplaceEntries, refreshMarketplaceEntries] = useAsyncFn(
    async () => await marketplace.getAvailableExtensions(),
    [marketplace],
  );

  const marketplaceMap = useMemo(
    () => _.keyBy(marketplaceEntries.value ?? [], (entry) => entry.id),
    [marketplaceEntries],
  );

  const groupedMarketplaceEntries = useMemo(() => {
    const entries = marketplaceEntries.value ?? [];
    return _.groupBy(entries, (entry) => entry.namespace ?? "default");
  }, [marketplaceEntries]);

  const groupedMarketplaceData = useMemo(() => {
    return Object.entries(groupedMarketplaceEntries).map(([namespace, entries]) => ({
      namespace,
      entries: entries
        .filter((entry) => entry.name.toLowerCase().includes(debouncedFilterText.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [groupedMarketplaceEntries, debouncedFilterText]);

  const installedEntries = useMemo(() => {
    return (installed ?? []).map((entry) => {
      const marketplaceEntry = marketplaceMap[entry.id];
      if (marketplaceEntry != undefined) {
        return { ...marketplaceEntry, namespace: entry.namespace };
      }

      return {
        id: entry.id,
        installed: true,
        name: entry.displayName,
        displayName: entry.displayName,
        description: entry.description,
        publisher: entry.publisher,
        homepage: entry.homepage,
        license: entry.license,
        version: entry.version,
        keywords: entry.keywords,
        namespace: entry.namespace,
        qualifiedName: entry.qualifiedName,
        readme: entry.readme,
        changelog: entry.changelog,
      };
    });
  }, [installed, marketplaceMap]);

  const namespacedEntries = useMemo(
    () => _.groupBy(installedEntries, (entry) => entry.namespace),
    [installedEntries],
  );

  useEffect(() => {
    refreshMarketplaceEntries().catch((error: unknown) => {
      log.error(error);
    });
  }, [refreshMarketplaceEntries]);

  const namespacedData = Object.entries(namespacedEntries).map(([namespace, entries]) => ({
    namespace,
    entries: entries
      .filter((entry) => entry.name.toLowerCase().includes(debouncedFilterText.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return {
    setUndebouncedFilterText,
    marketplaceEntries,
    refreshMarketplaceEntries,
    undebouncedFilterText,
    namespacedData,
    groupedMarketplaceData,
    debouncedFilterText,
  };
};

export default useExtensionSettings;
