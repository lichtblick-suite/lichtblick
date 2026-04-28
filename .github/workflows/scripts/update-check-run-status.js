// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** @param {import("@actions/github/lib/utils").GitHub} github */
/** @param {import("@actions/github").context} context */
module.exports = async ({ github, context }) => {
  const conclusion = process.env.JOB_STATUS === "success" ? "success" : "failure";
  await github.rest.checks.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    check_run_id: parseInt(process.env.CHECK_RUN_ID, 10),
    status: "completed",
    conclusion,
    details_url: `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
    output: {
      title: "SonarCloud PR scan",
      summary: `SonarCloud analysis completed with status: ${conclusion}.`,
    },
  });
};
