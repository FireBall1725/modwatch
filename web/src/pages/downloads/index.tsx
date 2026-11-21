// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import BarList from "../../components/charts/BarList";
import TimeSeriesChart from "../../components/charts/TimeSeriesChart";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DeltaText from "../../components/ui/DeltaText";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import Icon from "../../components/ui/Icon";
import KpiCard from "../../components/ui/KpiCard";
import ModIcon from "../../components/ui/ModIcon";
import PageHeader from "../../components/ui/PageHeader";
import ProgressBar from "../../components/ui/ProgressBar";
import SearchInput from "../../components/ui/SearchInput";
import SegmentedControl from "../../components/ui/SegmentedControl";
import Select from "../../components/ui/Select";
import Skeleton from "../../components/ui/Skeleton";
import Toggle from "../../components/ui/Toggle";
import { useApi } from "../../hooks/useApi";
import { api } from "../../lib/api";
import {
  formatCompact,
  formatCount,
  formatDelta,
  formatPercent,
  formatShortDate,
} from "../../lib/format";
import { ModCards, ModTable } from "./ModTable";
import {
  PLATFORM_FILTERS,
  RANGES,
  SORT_KEYS,
  averagePerDay,
  buildModRows,
  dailyRows,
  filterRows,
  isFlat,
  parsePlatformFilter,
  parseRange,
  parseSortKey,
  parseView,
  peakDay,
  rangeGain,
  share,
  sortRows,
  topMovers,
  type View,
} from "./logic";

const CF = "var(--color-cf)";
const MR = "var(--color-mr)";

export default function DownloadsPage() {
  const { t } = useTranslation("downloads");
  const { t: tc } = useTranslation("common");
  const [params, setParams] = useSearchParams();

  const range = parseRange(params.get("range"));
  const view = parseView(params.get("view"));
  const q = params.get("q") ?? "";
  const platform = parsePlatformFilter(params.get("platform"));
  const sort = parseSortKey(params.get("sort"));
  const members = params.get("members") === "1";

  /** Writes one query value; a default value removes the key so links stay short. */
  const setParam = useCallback(
    (key: string, value: string | null, dflt: string | null = null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null || value === "" || value === dflt)
            next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const history = useApi(() => api.downloadsHistory(range), [range]);
  const modsReq = useApi(() => api.mods(), []);

  const rangeOptions = RANGES.map((r) => ({
    value: r,
    label: tc(`range.days_${r}`),
  }));

  const rangeControl = (
    <SegmentedControl
      options={rangeOptions}
      value={range}
      onChange={(v) => setParam("range", String(v), "30")}
      label={tc("range.label")}
    />
  );
  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      actions={rangeControl}
    />
  );

  const hist = history.data;
  const mods = modsReq.data;

  /** The API returns about one point per day, so fewer points than the range means the history is short; label the real span then. */
  const pointCount = hist?.total.length ?? 0;
  const shortHistory = pointCount > 0 && pointCount < range;
  const rangeLabel = shortHistory
    ? t("span.days", { count: Math.max(1, pointCount - 1) })
    : tc(`range.days_${range}`);

  const derived = useMemo(() => {
    if (!hist || !mods) return null;
    const daily = dailyRows(hist.total);
    const gain = rangeGain(hist.total);
    const rows = buildModRows(mods, hist.perMod);
    const owned = rows.filter((r) => r.owned);
    const cf = mods
      .filter((m) => m.owned)
      .reduce((a, m) => a + (m.curseforge?.downloads ?? 0), 0);
    const mr = mods
      .filter((m) => m.owned)
      .reduce((a, m) => a + (m.modrinth?.downloads ?? 0), 0);
    return {
      daily,
      gain,
      rows,
      movers: topMovers(owned, 6),
      cf,
      mr,
      total: cf + mr,
      peak: peakDay(daily),
      avg: averagePerDay(daily),
    };
  }, [hist, mods]);

  if ((history.error && !hist) || (modsReq.error && !mods)) {
    const err = history.error ?? modsReq.error;
    return (
      <>
        {header}
        <ErrorState
          error={err}
          onRetry={() => void Promise.all([history.reload(), modsReq.reload()])}
        />
      </>
    );
  }

  if (!derived || !hist || !mods) {
    return (
      <>
        {header}
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KpiCard key={i} label="" value="" loading />
          ))}
        </div>
        <Card>
          <Skeleton className="h-72 w-full" />
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <Skeleton className="h-40 w-full" />
          </Card>
          <Card>
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
        <Card>
          <Skeleton className="h-64 w-full" />
        </Card>
      </>
    );
  }

  const { daily, gain, rows, movers, cf, mr, total, peak, avg } = derived;

  if (hist.total.length === 0) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            title={t("empty.title")}
            description={t("empty.body")}
            icon="downloads"
          />
        </Card>
      </>
    );
  }

  const filtered = filterRows(rows, { q, platform, members });
  const mobileRows = sortRows(filtered, sort);
  const filtersActive = q !== "" || platform !== "all";
  const stacked = hist.total;
  const mrAll = share(mr, total);
  const rangeTotal = (gain?.curseforge ?? 0) + (gain?.modrinth ?? 0);
  const mrRange = share(gain?.modrinth ?? 0, rangeTotal);
  const shift =
    rangeTotal > 0
      ? t("share.shift", {
          gain: formatPercent(mrRange),
          all: formatPercent(mrAll),
          points: `${mrRange >= mrAll ? "+" : "-"}${Math.abs(Math.round((mrRange - mrAll) * 100))}`,
        })
      : t("share.shiftNone", { all: formatPercent(mrAll) });

  const chartX =
    view === "daily" ? daily.map((d) => d.at) : stacked.map((p) => p.at);
  const chartSeries =
    view === "daily"
      ? [
          {
            key: "curseforge",
            label: tc("platform.curseforge"),
            color: CF,
            values: daily.map((d) => d.curseforge),
          },
          {
            key: "modrinth",
            label: tc("platform.modrinth"),
            color: MR,
            values: daily.map((d) => d.modrinth),
          },
        ]
      : [
          {
            key: "curseforge",
            label: tc("platform.curseforge"),
            color: CF,
            values: stacked.map((p) => p.curseforge),
          },
          {
            key: "modrinth",
            label: tc("platform.modrinth"),
            color: MR,
            values: stacked.map((p) => p.modrinth),
          },
        ];

  return (
    <>
      {header}

      {isFlat(gain) && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-review/40 bg-review-soft px-4 py-3 text-sm"
        >
          <Icon
            name="warning"
            size={18}
            className="mt-0.5 shrink-0 text-review"
          />
          <div>
            <p className="font-medium text-ink">
              {t("flat.title", { range: rangeLabel })}
            </p>
            <p className="text-muted">{t("flat.body")}</p>
          </div>
        </div>
      )}

      <section
        aria-label={t("title")}
        className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label={t("kpi.combined")}
          value={formatCount(total)}
          icon="downloads"
          footer={
            <span className="flex flex-col gap-0.5 text-xs text-muted">
              <span>
                {t("kpi.split", {
                  cf: formatPercent(share(cf, total)),
                  mr: formatPercent(share(mr, total)),
                })}
              </span>
              <DeltaText value={gain?.total ?? null} suffix={rangeLabel} />
            </span>
          }
        />
        <KpiCard
          label={tc("platform.curseforge")}
          value={formatCount(cf)}
          footer={
            <span className="flex flex-col gap-0.5 text-xs text-muted">
              <span>
                {t("kpi.share", { value: formatPercent(share(cf, total)) })}
              </span>
              <DeltaText value={gain?.curseforge ?? null} suffix={rangeLabel} />
            </span>
          }
          className="border-t-2 border-t-cf"
        />
        <KpiCard
          label={tc("platform.modrinth")}
          value={formatCount(mr)}
          footer={
            <span className="flex flex-col gap-0.5 text-xs text-muted">
              <span>
                {t("kpi.share", { value: formatPercent(share(mr, total)) })}
              </span>
              <DeltaText value={gain?.modrinth ?? null} suffix={rangeLabel} />
            </span>
          }
          className="border-t-2 border-t-mr"
        />
        <KpiCard
          label={t("kpi.average")}
          value={avg === null ? "–" : formatCount(avg)}
          unit={avg === null ? undefined : t("kpi.averageUnit")}
          footer={
            <span className="flex flex-col gap-0.5 text-xs text-muted">
              <span>{t("kpi.window", { range: rangeLabel })}</span>
              <span>
                {peak && peak.total > 0
                  ? t("kpi.peak", {
                      value: formatCount(peak.total),
                      date: formatShortDate(peak.at),
                    })
                  : t("kpi.noPeak")}
              </span>
            </span>
          }
        />
      </section>

      <Card
        title={t("chart.title")}
        description={
          <>
            {shortHistory && (
              <span>
                {t("chart.partial", {
                  count: Math.max(0, pointCount - 1),
                })}{" "}
              </span>
            )}
            {view === "daily" && <span>{t("chart.today")}</span>}
          </>
        }
        actions={
          <SegmentedControl<View>
            size="sm"
            label={t("chart.view")}
            value={view}
            onChange={(v) => setParam("view", v, "daily")}
            options={[
              { value: "daily", label: t("chart.daily") },
              { value: "total", label: t("chart.total") },
            ]}
          />
        }
      >
        <div className="block w-full min-w-0">
          <TimeSeriesChart
            key={`${range}-${view}`}
            x={chartX}
            series={chartSeries}
            kind={view === "daily" ? "bar" : "area"}
            stacked
            height={300}
            caption={t(
              view === "daily" ? "chart.dailyCaption" : "chart.totalCaption",
              { range: rangeLabel },
            )}
          />
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title={t("share.title")} className="min-w-0">
          <div className="space-y-5">
            {[
              { key: "all", label: t("share.allTime"), a: cf, b: mr },
              {
                key: "range",
                label: t("share.range", { range: rangeLabel }),
                a: gain?.curseforge ?? 0,
                b: gain?.modrinth ?? 0,
              },
            ].map((r) => (
              <div key={r.key}>
                <p className="mb-2 text-sm text-muted">{r.label}</p>
                {r.a + r.b > 0 ? (
                  <ProgressBar
                    height={12}
                    legend
                    format={formatCount}
                    segments={[
                      {
                        key: "cf",
                        label: tc("platform.curseforge"),
                        value: r.a,
                        color: CF,
                        pattern: 0,
                      },
                      {
                        key: "mr",
                        label: tc("platform.modrinth"),
                        value: r.b,
                        color: MR,
                        pattern: 1,
                      },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-faint">{t("share.none")}</p>
                )}
              </div>
            ))}
            <p className="border-t border-line pt-3 text-sm text-muted">
              {shift}
            </p>
          </div>
        </Card>

        <Card
          title={t("movers.title")}
          description={t("movers.description", { range: rangeLabel })}
          className="min-w-0"
        >
          {movers.length === 0 ? (
            <EmptyState compact icon="trend_up" title={t("movers.empty")} />
          ) : (
            <BarList
              ariaLabel={t("movers.title")}
              topN={0}
              format={formatCompact}
              items={movers.map((m) => ({
                key: m.slug,
                label: m.name,
                href: `/mods/${m.slug}`,
                value: m.gain?.total ?? 0,
                leading: <ModIcon src={m.iconUrl} name={m.name} size={22} />,
                trailing: formatDelta(m.gain?.total ?? 0),
                parts: [
                  {
                    key: "cf",
                    label: tc("platform.curseforge"),
                    value: m.gain?.curseforge ?? 0,
                    color: CF,
                  },
                  {
                    key: "mr",
                    label: tc("platform.modrinth"),
                    value: m.gain?.modrinth ?? 0,
                    color: MR,
                  },
                ],
              }))}
            />
          )}
        </Card>
      </div>

      <Card
        title={t("compare.title")}
        description={t("compare.count", { count: filtered.length })}
        padded={false}
        className="min-w-0"
      >
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
          <SearchInput
            value={q}
            onChange={(v) => setParam("q", v)}
            placeholder={t("compare.search")}
            className="w-full sm:w-64"
          />
          <Select
            label={t("compare.platform")}
            hideLabel
            value={platform}
            onChange={(v) => setParam("platform", v, "all")}
            options={PLATFORM_FILTERS.map((p) => ({
              value: p,
              label: t(`compare.filter.${p}`),
            }))}
          />
          <Select
            className="md:hidden"
            label={t("compare.sort")}
            value={sort}
            onChange={(v) => setParam("sort", v, "total")}
            options={SORT_KEYS.map((k) => ({
              value: k,
              label: t(`compare.sortKey.${k}`),
            }))}
          />
          <Toggle
            checked={members}
            onChange={(v) => setParam("members", v ? "1" : null)}
            label={t("compare.members")}
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            compact
            icon="search"
            title={t("compare.emptyTitle")}
            description={t("compare.emptyBody")}
            action={
              filtersActive ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setParam("q", null);
                    setParam("platform", null);
                  }}
                >
                  {t("compare.reset")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <ModTable
                rows={filtered}
                caption={t("compare.caption", { range: rangeLabel })}
              />
            </div>
            <div className="md:hidden">
              <ModCards rows={mobileRows} />
            </div>
          </>
        )}
      </Card>
    </>
  );
}
