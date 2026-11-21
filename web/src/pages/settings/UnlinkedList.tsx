// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import ExternalLink from "../../components/ui/ExternalLink";
import ModIcon from "../../components/ui/ModIcon";
import PlatformBadge from "../../components/ui/PlatformBadge";
import Pill from "../../components/ui/Pill";
import Select from "../../components/ui/Select";
import type { CatalogEntry, UnlinkedProject } from "../../lib/types";
import { hasPlatform, suggestEntries, suggestForLabel } from "./logic";

interface Props {
  projects: UnlinkedProject[];
  labels: { label: string; issues: number }[];
  entries: CatalogEntry[];
  busy: boolean;
  onLinkProject: (p: UnlinkedProject, entry: CatalogEntry) => void;
  onLinkLabel: (label: string, entry: CatalogEntry) => void;
}

function Chooser({
  options,
  suggested,
  label,
  busy,
  onLink,
}: {
  options: CatalogEntry[];
  suggested: string | null;
  label: string;
  busy: boolean;
  onLink: (e: CatalogEntry) => void;
}) {
  const { t } = useTranslation("settings");
  const [choice, setChoice] = useState<string>("");
  const value = choice || suggested || "";
  const picked = options.find((e) => e.slug === value);
  if (options.length === 0)
    return <p className="text-sm text-faint">{t("unlinked.noTargets")}</p>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <Select
        className="min-w-0 w-full sm:w-64 sm:flex-none"
        label={`${t("unlinked.linkTo")}: ${label}`}
        hideLabel
        value={value}
        onChange={setChoice}
        options={[
          { value: "", label: t("unlinked.choose") },
          ...options.map((e) => ({ value: e.slug, label: e.name })),
        ]}
      />
      <Button
        className="w-full sm:w-auto"
        variant={suggested && value === suggested ? "primary" : "secondary"}
        icon="link"
        disabled={!picked || busy}
        onClick={() => picked && onLink(picked)}
      >
        {t("unlinked.link")}
      </Button>
    </div>
  );
}

/** Projects and issue labels that no entry points at, each with the best match preselected so linking is one click. */
export default function UnlinkedList({
  projects,
  labels,
  entries,
  busy,
  onLinkProject,
  onLinkLabel,
}: Props) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  if (projects.length === 0 && labels.length === 0) {
    return (
      <EmptyState
        icon="check"
        title={t("unlinked.emptyTitle")}
        description={t("unlinked.emptyBody")}
      />
    );
  }
  return (
    <div className="divide-y divide-line">
      {projects.length > 0 && (
        <section aria-labelledby="unlinked-projects">
          <h3
            id="unlinked-projects"
            className="px-4 pt-4 pb-1 text-xs font-medium tracking-wide text-muted uppercase sm:px-5"
          >
            {t("unlinked.projects")}{" "}
            <span className="num text-faint">{projects.length}</span>
          </h3>
          <ul className="divide-y divide-line">
            {projects.map((p) => {
              const sugg = suggestEntries(p, entries);
              const options = entries.filter(
                (e) => !hasPlatform(e, p.platform),
              );
              const best = sugg[0]?.entry.slug ?? null;
              return (
                <li
                  key={`${p.platform}:${p.id}`}
                  className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ModIcon src={p.iconUrl} name={p.name} size={40} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink">
                        <span className="min-w-0 break-words">{p.name}</span>
                        {p.owned ? (
                          <Pill tone="accent" size="sm">
                            {t("unlinked.owned")}
                          </Pill>
                        ) : (
                          <Pill
                            tone="neutral"
                            size="sm"
                            title={t("unlinked.memberHint")}
                          >
                            {t("unlinked.member")}
                          </Pill>
                        )}
                        {best && (
                          <Pill tone="ok" size="sm" icon="wand">
                            {t("unlinked.likely")}
                          </Pill>
                        )}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <PlatformBadge platform={p.platform} size="sm" />
                        <span className="num">{p.id}</span>
                        <ExternalLink href={p.url}>
                          <span className="sr-only">
                            {t("unlinked.open", {
                              platform: tc(`platform.${p.platform}`),
                            })}
                          </span>
                          <span aria-hidden="true">{p.slug}</span>
                        </ExternalLink>
                      </p>
                    </div>
                  </div>
                  <Chooser
                    options={options}
                    suggested={best}
                    label={p.name}
                    busy={busy}
                    onLink={(e) => onLinkProject(p, e)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {labels.length > 0 && (
        <section aria-labelledby="unlinked-labels">
          <h3
            id="unlinked-labels"
            className="px-4 pt-4 pb-1 text-xs font-medium tracking-wide text-muted uppercase sm:px-5"
          >
            {t("unlinked.labels")}{" "}
            <span className="num text-faint">{labels.length}</span>
          </h3>
          <ul className="divide-y divide-line">
            {labels.map((l) => {
              const options = entries.filter((e) => !e.githubLabel);
              const best =
                suggestForLabel(l.label, entries)[0]?.entry.slug ?? null;
              return (
                <li
                  key={l.label}
                  className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <p className="num font-medium break-all text-ink">
                      {t("unlinked.labelName", { label: l.label })}
                    </p>
                    <p className="text-xs text-muted">
                      {t("unlinked.issues", { count: l.issues })}
                    </p>
                  </div>
                  <Chooser
                    options={options}
                    suggested={best}
                    label={l.label}
                    busy={false}
                    onLink={(e) => onLinkLabel(l.label, e)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
