// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import ArrowDownIcon from "@mdi/svg/svg/chevron-down.svg";
import ArrowUpIcon from "@mdi/svg/svg/chevron-up.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import SearchIcon from "@mdi/svg/svg/magnify.svg";
import { vec3 } from "gl-matrix";
import { range, throttle } from "lodash";
import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { CameraState, cameraStateSelectors } from "regl-worldview";

import Button from "@foxglove/studio-base/components/Button";
import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyInput } from "@foxglove/studio-base/components/LegacyStyledComponents";
import useDeepChangeDetector from "@foxglove/studio-base/hooks/useDeepChangeDetector";
import { Interactive } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import Transforms from "@foxglove/studio-base/panels/ThreeDimensionalViz/Transforms";
import styles from "@foxglove/studio-base/panels/ThreeDimensionalViz/sharedStyles";
import { TextMarker, Color } from "@foxglove/studio-base/types/Messages";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export const YELLOW = { r: 1, b: 0, g: 1, a: 1 };
export const ORANGE = { r: 0.97, g: 0.58, b: 0.02, a: 1 };

export type GLTextMarker = TextMarker & {
  highlightedIndices?: number[];
  highlightColor?: Color;
};

export type WorldSearchTextProps = {
  searchTextOpen: boolean;
  searchText: string;
  setSearchTextMatches: (markers: GLTextMarker[]) => void;
  searchTextMatches: GLTextMarker[];
  selectedMatchIndex: number;
};

export type SearchTextProps = WorldSearchTextProps & {
  toggleSearchTextOpen: (bool: boolean) => void;
  setSearchText: (searchText: string) => void;
  setSelectedMatchIndex: (index: number) => void;
  searchInputRef: { current: HTMLInputElement | ReactNull };
};

export const getHighlightedIndices = (text: string, searchText: string): number[] => {
  const highlightedIndicesSet = new Set<number>();
  let match;
  let startingIndex = 0;
  const lowerCaseSearchText = searchText.toLowerCase();
  const lowerCaseText = text.toLowerCase();
  while ((match = lowerCaseText.indexOf(lowerCaseSearchText, startingIndex)) !== -1) {
    range(match, match + searchText.length).forEach((index) => {
      highlightedIndicesSet.add(index);
    });
    startingIndex = match + 1;
  }

  return Array.from(highlightedIndicesSet);
};

export const useGLText = ({
  text,
  searchText,
  searchTextOpen,
  selectedMatchIndex,
  setSearchTextMatches,
  searchTextMatches,
}: WorldSearchTextProps & {
  text: Interactive<TextMarker>[];
}): Interactive<GLTextMarker>[] => {
  const glText: Interactive<GLTextMarker>[] = React.useMemo(() => {
    let numMatches = 0;
    return text.map((marker) => {
      const scale = {
        // RViz ignores scale.x/y for text and only uses z
        x: marker.scale.z,
        y: marker.scale.z,
        z: marker.scale.z,
      };

      if (searchText.length === 0 || !searchTextOpen) {
        return { ...marker, scale };
      }

      const highlightedIndices = getHighlightedIndices(marker.text, searchText);

      if (highlightedIndices.length > 0) {
        numMatches += 1;
        const highlightedMarker = {
          ...marker,
          scale,
          highlightColor: selectedMatchIndex + 1 === numMatches ? ORANGE : YELLOW,
          highlightedIndices,
        };
        return highlightedMarker;
      }

      return { ...marker, scale };
    });
  }, [searchText, searchTextOpen, selectedMatchIndex, text]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledSetSearchTextMatches = useCallback(
    throttle(setSearchTextMatches, 200, { trailing: true }),
    [setSearchTextMatches],
  );

  useEffect(() => {
    if (!searchTextOpen && searchTextMatches.length === 0) {
      return;
    }
    const matches = glText.filter((marker) => marker.highlightedIndices?.length);
    if (matches.length > 0) {
      throttledSetSearchTextMatches(matches);
    } else if (searchTextMatches.length > 0) {
      throttledSetSearchTextMatches([]);
    }
  }, [throttledSetSearchTextMatches, glText, searchText, searchTextMatches.length, searchTextOpen]);

  return glText;
};

export const useSearchText = (): SearchTextProps => {
  const [searchTextOpen, toggleSearchTextOpen] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>("");
  const [searchTextMatches, setSearchTextMatches] = useState<GLTextMarker[]>([]);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(ReactNull);

  return {
    searchTextOpen,
    toggleSearchTextOpen,
    searchText,
    setSearchText,
    setSearchTextMatches,
    searchTextMatches,
    selectedMatchIndex,
    setSelectedMatchIndex,
    searchInputRef,
  };
};
type SearchTextComponentProps = SearchTextProps & {
  onCameraStateChange: (arg0: CameraState) => void;
  cameraState: CameraState;
  rootTf?: string;
  transforms: Transforms;
};

// Exported for tests.
export const useSearchMatches = ({
  cameraState,
  currentMatch,
  onCameraStateChange,
  rootTf,
  searchTextOpen,
  transforms,
}: {
  cameraState: CameraState;
  currentMatch?: GLTextMarker;
  onCameraStateChange: (arg0: CameraState) => void;
  rootTf?: string;
  searchTextOpen: boolean;
  transforms: Transforms;
}): void => {
  const hasCurrentMatchChanged = useDeepChangeDetector([currentMatch], true);
  React.useEffect(() => {
    if (!currentMatch || !searchTextOpen || !rootTf || !hasCurrentMatchChanged) {
      return;
    }

    const { header, pose } = currentMatch;

    const output = transforms.apply(
      { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 0 } },
      pose,
      header.frame_id,
      rootTf,
    );
    if (!output) {
      return;
    }
    const {
      position: { x, y, z },
    } = output;

    const targetHeading = cameraStateSelectors.targetHeading(cameraState);
    const targetOffset: vec3 = [0, 0, 0];
    vec3.rotateZ(
      targetOffset,
      vec3.subtract(targetOffset, [x, y, z], cameraState.target),
      [0, 0, 0],
      targetHeading,
    );
    onCameraStateChange({ ...cameraState, targetOffset });
  }, [
    cameraState,
    currentMatch,
    hasCurrentMatchChanged,
    onCameraStateChange,
    rootTf,
    searchTextOpen,
    transforms,
  ]);
};

const SearchText = React.memo<SearchTextComponentProps>(function SearchText({
  searchTextOpen,
  toggleSearchTextOpen,
  searchText,
  setSearchText,
  searchInputRef,
  setSelectedMatchIndex,
  selectedMatchIndex,
  searchTextMatches,
  onCameraStateChange,
  cameraState,
  transforms,
  rootTf,
}: SearchTextComponentProps) {
  const currentMatch = searchTextMatches[selectedMatchIndex];
  const iterateCurrentIndex = useCallback(
    (iterator: number) => {
      const newIndex = selectedMatchIndex + iterator;
      if (newIndex >= searchTextMatches.length) {
        setSelectedMatchIndex(0);
      } else if (newIndex < 0) {
        setSelectedMatchIndex(searchTextMatches.length - 1);
      } else {
        setSelectedMatchIndex(newIndex);
      }
    },
    [searchTextMatches, selectedMatchIndex, setSelectedMatchIndex],
  );

  React.useEffect(() => {
    if (searchTextMatches.length === 0) {
      setSelectedMatchIndex(0);
    }
  }, [searchTextMatches.length, setSelectedMatchIndex]);

  useSearchMatches({
    cameraState,
    currentMatch,
    onCameraStateChange,
    rootTf,
    searchTextOpen,
    transforms,
  });

  if (!searchTextOpen) {
    return (
      <Button className={styles.iconButton} onClick={() => toggleSearchTextOpen(!searchTextOpen)}>
        <Icon tooltip="Search text markers">
          <SearchIcon />
        </Icon>
      </Button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: "row",
        padding: "0 4px",
        height: "36px",
        /* Hack to match the heights of the other toolbar components */
      }}
    >
      <div style={{ backgroundColor: "#1A191F", padding: "0px 4px 0px 8px", borderRadius: "4px" }}>
        <Icon size="medium">
          <SearchIcon />
        </Icon>
        <LegacyInput
          autoFocus
          ref={searchInputRef}
          type="text"
          placeholder="Find in scene"
          spellCheck={false}
          value={searchText}
          style={{ backgroundColor: "transparent" }}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== "Enter") {
              return;
            }
            if (e.shiftKey) {
              iterateCurrentIndex(-1);
              return;
            }
            iterateCurrentIndex(1);
          }}
        />
        <span style={{ color: colors.TEXT_MUTED, width: "50px", display: "inline-block" }}>
          {searchTextMatches.length > 0 ? selectedMatchIndex + 1 : "0"} of{" "}
          {searchTextMatches.length}
        </span>
      </div>
      <Icon size="medium" onClick={() => iterateCurrentIndex(-1)}>
        <ArrowUpIcon />
      </Icon>
      <Icon size="medium" onClick={() => iterateCurrentIndex(1)}>
        <ArrowDownIcon />
      </Icon>
      <Icon onClick={() => toggleSearchTextOpen(false)} tooltip="[esc]" size="medium">
        <CloseIcon />
      </Icon>
    </div>
  );
});

export default SearchText;
