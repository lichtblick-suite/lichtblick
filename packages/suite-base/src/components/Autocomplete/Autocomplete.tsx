// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Autocomplete as MuiAutocomplete, Popper, PopperProps, TextField } from "@mui/material";
import { Fzf, FzfResultItem } from "fzf";
import * as React from "react";
import { SyntheticEvent, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";

import { useStyles } from "@lichtblick/suite-base/components/Autocomplete/Autocomplete.style";
import {
  EMPTY_SET,
  FAST_FIND_ITEM_CUTOFF,
  MAX_FZF_MATCHES,
} from "@lichtblick/suite-base/components/Autocomplete/constants";
import {
  AutocompleteProps,
  IAutocomplete,
} from "@lichtblick/suite-base/components/Autocomplete/types";

import { ListboxAdapterChild, ReactWindowListboxAdapter } from "./ReactWindowListboxAdapter";

function itemToFzfResult<T>(item: T): FzfResultItem<T> {
  return {
    item,
    score: 0,
    positions: EMPTY_SET,
    start: 0,
    end: 0,
  };
}

// We use fzf to filter the input items to make autocompleteItems so we don't need the
// MuiAutocomplete to also filter the items. Using a passthrough function for filterOptions
// disables the internal filtering of MuiAutocomplete
//
// https://mui.com/material-ui/react-autocomplete/#search-as-you-type
const filterOptions = (options: FzfResultItem[]) => options;

const getOptionLabel = (item: string | FzfResultItem) =>
  typeof item === "string" ? item : item.item;

// The builtin Popper in MuiAutocomplete uses the width hint from the parent Autocomplete to set
// the width. We want to set the minWidth to allow the popper to grow wider than the input field width,
// so we can show long topic paths and autocomplete entries.
const CustomPopper = function (props: PopperProps) {
  const width = props.style?.width ?? 0;
  return <Popper {...props} style={{ minWidth: width }} placement="bottom-start" />;
};

/**
 * <Autocomplete> is a Studio-specific wrapper of MUI autocomplete with support
 * for things like multiple autocompletes that seamlessly transition into each
 * other, e.g. when building more complex strings like in the Plot panel.
 */
export const Autocomplete = React.forwardRef(function Autocomplete(
  props: AutocompleteProps,
  ref: React.ForwardedRef<IAutocomplete>,
): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(ReactNull);

  const { classes, cx } = useStyles();

  const [stateValue, setValue] = useState<string | undefined>(undefined);

  const {
    className,
    value = stateValue,
    disabled,
    filterText = value ?? "",
    items,
    onBlur: onBlurCallback,
    onChange: onChangeCallback,
    onSelect: onSelectCallback,
    placeholder,
    readOnly,
    selectOnFocus,
    sortWhenFiltering = true,
    variant = "filled",
  }: AutocompleteProps = props;

  const fzfUnfiltered = useMemo(() => {
    return items.map((item) => itemToFzfResult(item));
  }, [items]);

  const fzf = useMemo(() => {
    return new Fzf(items, {
      // v1 algorithm is significantly faster on long lists of items.
      fuzzy: items.length > FAST_FIND_ITEM_CUTOFF ? "v1" : "v2",
      sort: sortWhenFiltering,
      limit: MAX_FZF_MATCHES,
    });
  }, [items, sortWhenFiltering]);

  const autocompleteItems = useMemo(() => {
    return filterText ? fzf.find(filterText) : fzfUnfiltered;
  }, [filterText, fzf, fzfUnfiltered]);

  const hasError = props.hasError ?? (autocompleteItems.length === 0 && value?.length !== 0);

  const setSelectionRange = useCallback((selectionStart: number, selectionEnd: number): void => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(selectionStart, selectionEnd);
  }, []);

  const focus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const blur = useCallback(() => {
    inputRef.current?.blur();
    onBlurCallback?.();
  }, [onBlurCallback]);

  // Give callers an opportunity to control autocomplete
  useImperativeHandle(ref, () => ({ setSelectionRange, focus, blur }), [
    setSelectionRange,
    focus,
    blur,
  ]);

  const onChange = useCallback(
    (_event: ReactNull | React.SyntheticEvent, newValue: string): void => {
      if (onChangeCallback) {
        if (_event) {
          onChangeCallback(_event, newValue);
        }
      } else {
        setValue(newValue);
      }
    },
    [onChangeCallback],
  );

  // To allow multiple completions in sequence, it's up to the parent component
  // to manually blur the input to finish a completion.
  const onSelect = useCallback(
    (_event: SyntheticEvent, selectedValue: ReactNull | string | FzfResultItem): void => {
      if (selectedValue != undefined && typeof selectedValue !== "string") {
        setValue(undefined);
        onSelectCallback(selectedValue.item, { setSelectionRange, focus, blur });
      }
    },
    [onSelectCallback, blur, focus, setSelectionRange],
  );

  return (
    <MuiAutocomplete
      className={cx(className, classes.root)}
      getOptionLabel={getOptionLabel}
      disableCloseOnSelect
      disabled={disabled}
      freeSolo
      fullWidth
      slotProps={{
        paper: { elevation: 8 },
        listbox: {
          component: ReactWindowListboxAdapter,
        },
      }}
      slots={{ popper: CustomPopper }}
      filterOptions={filterOptions}
      onChange={onSelect}
      onInputChange={onChange}
      openOnFocus
      options={autocompleteItems}
      readOnly={readOnly}
      renderInput={(params) => (
        <TextField
          {...params}
          variant={variant}
          inputRef={inputRef}
          data-testid="autocomplete-textfield"
          placeholder={placeholder}
          className={cx({ [classes.inputError]: hasError })}
          size="small"
        />
      )}
      renderOption={(optProps, option: FzfResultItem, state) => {
        // The return values of renderOption are passed as the _child_ argument to the ListboxComponent.
        // Our ReactWindowListboxAdapter expects a tuple for each item in the list and will itself manage
        // when and which items to render using virtualization.
        //
        // The final as ReactNode cast is to appease the expected return type of renderOption because
        // it does not understand that our ListboxAdapter needs a tuple and not a ReactNode
        return [optProps, option, state] satisfies ListboxAdapterChild as React.ReactNode;
      }}
      selectOnFocus={selectOnFocus}
      size="small"
      value={value ?? ReactNull}
    />
  );
});
