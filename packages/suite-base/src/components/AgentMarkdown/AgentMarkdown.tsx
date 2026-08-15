// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Link } from "@mui/material";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import LinkHandlerContext from "@lichtblick/suite-base/context/LinkHandlerContext";

import { useStyles } from "./AgentMarkdown.style";

const MarkdownLink: NonNullable<Components["a"]> = ({ children, href }) => {
  const handleLink = useContext(LinkHandlerContext);

  return (
    <Link
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      onClick={(event) => {
        handleLink(event, href ?? "");
      }}
    >
      {children}
    </Link>
  );
};

type ImageTarget = {
  hasAdditionalParameters: boolean;
  label: string;
};

function imageTarget(src: string): ImageTarget {
  const parameterIndex = src.search(/[?#]/u);
  const fallbackLabel = parameterIndex === -1 ? src : src.slice(0, parameterIndex);
  try {
    const url = new URL(src, globalThis.location.href);
    return {
      hasAdditionalParameters: url.search !== "" || url.hash !== "",
      label: url.origin === "null" ? fallbackLabel : `${url.origin}${url.pathname}`,
    };
  } catch {
    return {
      hasAdditionalParameters: parameterIndex !== -1,
      label: fallbackLabel,
    };
  }
}

function DeferredMarkdownImage(props: { alt?: string; src: string }): React.JSX.Element {
  const { alt, src } = props;
  const { classes } = useStyles();
  const { t } = useTranslation("agentChat");
  const [approvedSrc, setApprovedSrc] = useState<string>();
  const target = imageTarget(src);
  const additionalParametersLabel = target.hasAdditionalParameters
    ? t("imageHasAdditionalParameters", { defaultValue: "Includes additional parameters" })
    : undefined;
  const approvalLabel =
    additionalParametersLabel == undefined
      ? target.label
      : `${target.label} (${additionalParametersLabel})`;

  if (approvedSrc === src) {
    return (
      <img
        className={classes.markdownImage}
        alt={alt ?? ""}
        decoding="async"
        loading="lazy"
        referrerPolicy="no-referrer"
        src={src}
      />
    );
  }

  return (
    <Button
      aria-label={alt == undefined || alt === "" ? approvalLabel : `${approvalLabel}: ${alt}`}
      className={classes.imagePlaceholder}
      size="small"
      title={src}
      variant="outlined"
      onClick={() => {
        setApprovedSrc(src);
      }}
    >
      {approvalLabel}
    </Button>
  );
}

const MarkdownImage: NonNullable<Components["img"]> = ({ alt, src }) => {
  return src == undefined || src === "" ? <>{alt}</> : <DeferredMarkdownImage alt={alt} src={src} />;
};

/**
 * Tables are the one block that cannot be made to fit a narrow sidebar by wrapping, so each gets
 * its own horizontal scroll container. Without this a wide table stretches the message bubble and
 * pushes the whole conversation sideways.
 */
const MarkdownTable: NonNullable<Components["table"]> = ({ children }) => {
  const { classes } = useStyles();

  return (
    <div className={classes.tableScroll}>
      <table>{children}</table>
    </div>
  );
};

const MARKDOWN_COMPONENTS: Components = {
  a: MarkdownLink,
  img: MarkdownImage,
  table: MarkdownTable,
};

const MARKDOWN_PLUGINS = [remarkGfm];

/**
 * Renders agent markdown: GFM, links routed through the app's link handler, and images the user
 * must approve before they load.
 *
 * Shared by the chat transcript and the skill editor preview so a skill is previewed exactly as the
 * agent's own output would render. The image gate stays on in both: skill text is user-authored,
 * but it is still content the app should not fetch remote resources for unprompted.
 */
export function AgentMarkdown({ children }: { children: string }): React.JSX.Element {
  const { classes } = useStyles();

  return (
    <div className={classes.markdown}>
      <Markdown components={MARKDOWN_COMPONENTS} remarkPlugins={MARKDOWN_PLUGINS} skipHtml>
        {children}
      </Markdown>
    </div>
  );
}
