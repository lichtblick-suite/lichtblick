// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** @param {import("@actions/github/lib/utils").GitHub} github */
/** @param {import("@actions/github").context} context */
module.exports = async ({ github, context }) => {
  const { data } = await github.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: "SonarCloud (workflow_run PR)",
    head_sha: process.env.HEAD_SHA,
    status: "in_progress",
    details_url: `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
    output: {
      title: "SonarCloud PR scan",
      summary: "SonarCloud analysis is running…",
    },
  });
  return String(data.id);
};
