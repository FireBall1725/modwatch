// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from "react-i18next";
import { useOverview } from "../../hooks/overviewContext";
import KpiCard from "../../components/ui/KpiCard";
import RelativeTime from "../../components/ui/RelativeTime";
import { formatTime } from "../../lib/format";
import { nextRun, pollSeconds, type Summary } from "./logic";

/** The answer first: sources up or down, what waits to be linked, the last poll and the next. */
export default function Strip({
  summary,
  loading,
}: {
  summary: Summary | null;
  loading: boolean;
}) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const o = useOverview();
  const d = o.data;
  const failed = d?.lastPoll?.state === "error";
  const last = d?.lastOkPoll ?? null;
  const next = d ? nextRun(d.schedule) : null;
  const failing = summary?.failing ?? [];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
      <KpiCard
        label={t("strip.sources")}
        icon={failing.length ? "warning" : "check"}
        tone={failing.length ? "bad" : "ok"}
        loading={o.loading}
        value={
          d
            ? t("strip.sourcesValue", {
                ok: d.sources.length - failing.length,
                total: d.sources.length,
              })
            : ""
        }
        footer={
          failing.length
            ? t("strip.sourcesFailing", {
                names: failing
                  .map((s) =>
                    tc(`source.${s.source}`, { defaultValue: s.source }),
                  )
                  .join(", "),
              })
            : t("strip.sourcesOk")
        }
      />
      <KpiCard
        label={t("strip.toLink")}
        icon="link"
        tone={summary && summary.toLink > 0 ? "review" : "ok"}
        loading={loading}
        value={summary?.toLink ?? ""}
        href={
          summary && summary.toLink > 0 ? "/settings/registry?view=unlinked" : undefined
        }
        footer={
          summary && summary.toLink > 0
            ? [
                summary.unlinkedOwned > 0
                  ? t("strip.toLinkProjects", { count: summary.unlinkedOwned })
                  : null,
                summary.unclaimedLabels > 0
                  ? t("strip.toLinkLabels", { count: summary.unclaimedLabels })
                  : null,
              ]
                .filter(Boolean)
                .join(", ")
            : t("strip.toLinkNone")
        }
      />
      <KpiCard
        label={t("strip.lastPoll")}
        icon={failed ? "warning" : "clock"}
        tone={failed ? "bad" : undefined}
        loading={o.loading}
        value={
          last ? (
            <span className="font-sans whitespace-nowrap tabular-nums">
              <RelativeTime iso={last.finishedAt} />
            </span>
          ) : (
            t("strip.lastPollNone")
          )
        }
        footer={
          failed ? (
            <span className="text-bad">{t("strip.lastPollFailed")}</span>
          ) : last ? (
            <>
              {t("strip.tookMods", {
                seconds: pollSeconds(last.startedAt, last.finishedAt),
                count: last.mods,
              })}
              {next ? (
                <span className="num">{` · ${t("strip.nextAt", { time: formatTime(next.toISOString()) })}`}</span>
              ) : null}
            </>
          ) : null
        }
      />
    </div>
  );
}
