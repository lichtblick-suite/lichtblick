#!/bin/bash
# SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
# SPDX-License-Identifier: MPL-2.0
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/

# Used by .github/workflows/release.yml to detect a prior successful run of the
# same PR merge (e.g. a re-run after a later step failed), so retries don't
# create a duplicate "chore: release" commit. Searches the full ancestry path
# (not just origin/main's tip), since other commits may have landed on main
# after the release commit was pushed.
#
# Requires a full (unshallow) checkout: `fetch-depth: 0` in actions/checkout.
# Requires $MERGE_COMMIT_SHA (the PR's merge_commit_sha, not github.sha/HEAD).
# Writes already_released, version, and release_commit_sha to $GITHUB_ENV.

set -euo pipefail

: "${MERGE_COMMIT_SHA:?MERGE_COMMIT_SHA env var is required}"

git fetch origin main

merge_commit="$MERGE_COMMIT_SHA"
release_commit_pattern='^chore: release v(.*) \[skip actions\]$'
already_released=false

if git merge-base --is-ancestor "$merge_commit" origin/main; then
  # --max-count is applied before --reverse (see git-rev-list(1) Commit Limiting), so it's only
  # safe to combine them while the true count is under the cap - otherwise we'd silently get
  # origin/main's tip instead of the immediate child of merge_commit. Fail loudly if the cap is
  # hit instead of guessing.
  ancestry_path_cap=1000
  mapfile -t ancestry_path < <(git rev-list --ancestry-path --reverse --max-count="$ancestry_path_cap" "${merge_commit}..origin/main")
  if [[ "${#ancestry_path[@]}" -eq "$ancestry_path_cap" ]]; then
    echo "ERROR: more than $ancestry_path_cap commits between $merge_commit and origin/main; refusing to guess the immediate child commit." >&2
    exit 1
  fi
  child_commit="${ancestry_path[0]:-}"
  if [[ -n "$child_commit" ]]; then
    child_parent="$(git rev-parse "${child_commit}^")"
    child_subject="$(git log -1 --format=%s "$child_commit")"
    if [[ "$child_parent" == "$merge_commit" && "$child_subject" =~ $release_commit_pattern ]]; then
      already_released=true
      version="${BASH_REMATCH[1]}"
      release_commit_sha="$child_commit"
    fi
  fi
fi

if [[ "$already_released" == "true" ]]; then
  echo "already_released=true" >> "$GITHUB_ENV"
  echo "version=$version" >> "$GITHUB_ENV"
  echo "release_commit_sha=$release_commit_sha" >> "$GITHUB_ENV"
else
  echo "already_released=false" >> "$GITHUB_ENV"
fi
