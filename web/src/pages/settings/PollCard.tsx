// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from "react-i18next";
import { useOverview } from "../../hooks/overviewContext";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Skeleton from "../../components/ui/Skeleton";
import RelativeTime from "../../components/ui/RelativeTime";
import { describeCron, pollSeconds } from "./logic";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Schedule, the last poll's result, Poll now, and the version and build of this binary. */
export default function PollCard() {
  const { t } = useTranslation("settings");
  const o = useOverview();
  const d = o.data;
  const desc = d ? describeCron(d.schedule) : null;
  const last = d?.lastPoll ?? null;
  const scheduleText = !desc
    ? ""
    : desc.kind === "everyMinutes"
      ? t("poll.everyMinutes", { count: desc.n })
      : desc.kind === "everyHours"
        ? t("poll.everyHours", {
            count: desc.n,
            minute: String(desc.minute).padStart(2, "0"),
          })
        : desc.kind === "hourly"
          ? t("poll.hourly", { minute: String(desc.minute).padStart(2, "0") })
          : desc.kind === "daily"
            ? t("poll.daily", {
                time: `${String(desc.hour).padStart(2, "0")}:${String(desc.minute).padStart(2, "0")}`,
              })
            : t("poll.raw");
  return (
    <Card
      title={t("poll.title")}
      id="poll"
      actions={
        <Button
          variant="primary"
          size="sm"
          icon="refresh"
          loading={o.polling}
          onClick={() => void o.pollNow()}
        >
          {o.polling ? t("poll.running") : t("poll.now")}
        </Button>
      }
    >
      {o.pollError && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-ink"
        >
          {o.pollError}
        </p>
      )}
      {o.loading || !d ? (
        <div className="mt-3 space-y-3">
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
          <Skeleton className="h-6" />
        </div>
      ) : (
        <dl className="mt-2 divide-y divide-line">
          <Row label={t("poll.schedule")}>
            <span className="block">{scheduleText}</span>
            <span className="num block text-xs text-faint">{d.schedule}</span>
          </Row>
          <Row label={t("poll.lastResult")}>
            {last ? (
              <>
                <span
                  className={
                    last.state === "ok" ? "text-ok" : "font-medium text-bad"
                  }
                >
                  {last.state === "ok" ? t("poll.ok") : t("poll.failed")}
                </span>{" "}
                <RelativeTime iso={last.finishedAt} />
                <span className="num block text-xs text-faint">
                  {t("poll.took", {
                    seconds: pollSeconds(last.startedAt, last.finishedAt),
                    count: last.mods,
                  })}
                </span>
                {last.error && (
                  <span className="block text-xs break-words text-bad">
                    {last.error}
                  </span>
                )}
              </>
            ) : (
              t("strip.lastPollNone")
            )}
          </Row>
          <Row label={t("poll.version")}>
            <span className="num">{d.version}</span>
          </Row>
          <Row label={t("poll.build")}>
            <span className="num">{__APP_VERSION__}</span>
          </Row>
        </dl>
      )}
    </Card>
  );
}
