// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import DataTable, { type Column } from "../../components/ui/DataTable";
import DeltaText from "../../components/ui/DeltaText";
import Icon from "../../components/ui/Icon";
import ModIcon from "../../components/ui/ModIcon";
import PlatformBadge from "../../components/ui/PlatformBadge";
import ProgressBar from "../../components/ui/ProgressBar";
import { formatCount, formatPercent, NO_VALUE } from "../../lib/format";
import { share, type ModRow } from "./logic";

/** A platform figure, or a dash when the mod is not there. */
function Figure({ value }: { value: number | null }) {
  const { t } = useTranslation("downloads");
  if (value === null)
    return (
      <span className="num text-faint" title={t("compare.notThere")}>
        {NO_VALUE}
      </span>
    );
  return <span className="num">{formatCount(value)}</span>;
}

/** The platform a mod lives on alone: absent from one side, or at zero there. Null when both sides have downloads. */
function soleOwner(row: ModRow): "curseforge" | "modrinth" | null | "none" {
  const cf = row.curseforge ?? 0;
  const mr = row.modrinth ?? 0;
  if (cf === 0 && mr === 0)
    return row.curseforge !== null
      ? "curseforge"
      : row.modrinth !== null
        ? "modrinth"
        : "none";
  if (mr === 0) return "curseforge";
  if (cf === 0) return "modrinth";
  return null;
}

function SplitBar({
  row,
  showPercent = true,
}: {
  row: ModRow;
  showPercent?: boolean;
}) {
  const { t } = useTranslation("downloads");
  const { t: tc } = useTranslation("common");
  const only = soleOwner(row);
  if (only === "none") return <span className="text-faint">{NO_VALUE}</span>;
  if (only) return <PlatformBadge platform={only} size="sm" />;
  const cf = share(row.curseforge ?? 0, row.total);
  const segments = [
    {
      key: "curseforge",
      label: tc("platform.curseforge"),
      value: row.curseforge ?? 0,
      color: "var(--color-cf)",
      pattern: 0 as const,
    },
    {
      key: "modrinth",
      label: tc("platform.modrinth"),
      value: row.modrinth ?? 0,
      color: "var(--color-mr)",
      pattern: 1 as const,
    },
  ];
  const label = t("compare.splitLabel", {
    cf: formatPercent(cf),
    mr: formatPercent(1 - cf),
  });
  return (
    <div className="flex items-center gap-2">
      <ProgressBar
        segments={segments}
        height={8}
        ariaLabel={label}
        className="w-full min-w-24"
        format={formatCount}
      />
      {showPercent && (
        <span
          aria-hidden="true"
          className="num w-14 shrink-0 text-right text-xs text-muted"
        >
          {t("compare.splitCf", { value: formatPercent(cf) })}
        </span>
      )}
    </div>
  );
}

/** A short column header: the abbreviation shows, the full name is read out. */
function ShortHeader({
  short,
  full,
  className,
}: {
  short: string;
  full: string;
  className: string;
}) {
  return (
    <span className={className} title={full}>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}

/** The wide comparison table. Rows link to the mod page. */
export function ModTable({
  rows,
  caption,
}: {
  rows: ModRow[];
  caption: string;
}) {
  const { t } = useTranslation("downloads");
  const { t: tc } = useTranslation("common");
  const columns: Column<ModRow>[] = [
    {
      key: "name",
      header: t("compare.mod"),
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <ModIcon src={r.iconUrl} name={r.name} size={28} />
          <span className="truncate font-medium text-ink">{r.name}</span>
        </span>
      ),
    },
    {
      key: "curseforge",
      header: <span className="text-cf">{tc("platform.curseforge")}</span>,
      align: "right",
      sortValue: (r) => r.curseforge,
      cell: (r) => <Figure value={r.curseforge} />,
    },
    {
      key: "modrinth",
      header: <span className="text-mr">{tc("platform.modrinth")}</span>,
      align: "right",
      sortValue: (r) => r.modrinth,
      cell: (r) => <Figure value={r.modrinth} />,
    },
    {
      key: "split",
      header: t("compare.split"),
      width: "14rem",
      hideBelow: "lg",
      sortValue: (r) =>
        r.curseforge !== null && r.modrinth !== null
          ? share(r.curseforge, r.total)
          : null,
      cell: (r) => <SplitBar row={r} />,
    },
    {
      key: "total",
      header: t("compare.total"),
      align: "right",
      sortValue: (r) => r.total,
      cell: (r) => (
        <span className="num font-medium text-ink">{formatCount(r.total)}</span>
      ),
    },
    {
      key: "gain",
      header: t("compare.gain"),
      align: "right",
      sortValue: (r) => r.gain?.total ?? null,
      cell: (r) => <DeltaText value={r.gain?.total ?? null} />,
    },
    {
      key: "gainCf",
      header: (
        <ShortHeader
          className="text-cf"
          short={t("compare.cfShort")}
          full={t("compare.cfGain")}
        />
      ),
      align: "right",
      hideBelow: "xl",
      sortValue: (r) =>
        r.curseforge !== null ? (r.gain?.curseforge ?? null) : null,
      cell: (r) => (
        <DeltaText
          value={r.curseforge !== null ? (r.gain?.curseforge ?? null) : null}
          plain
        />
      ),
    },
    {
      key: "gainMr",
      header: (
        <ShortHeader
          className="text-mr"
          short={t("compare.mrShort")}
          full={t("compare.mrGain")}
        />
      ),
      align: "right",
      hideBelow: "xl",
      sortValue: (r) =>
        r.modrinth !== null ? (r.gain?.modrinth ?? null) : null,
      cell: (r) => (
        <DeltaText
          value={r.modrinth !== null ? (r.gain?.modrinth ?? null) : null}
          plain
        />
      ),
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.slug}
      caption={caption}
      defaultSort={{ key: "total", dir: "desc" }}
      rowHref={(r) => `/mods/${r.slug}`}
      dense
    />
  );
}

/** The narrow layout: one card per mod instead of a squeezed table. */
export function ModCards({ rows }: { rows: ModRow[] }) {
  const { t } = useTranslation("downloads");
  const { t: tc } = useTranslation("common");
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => (
        <li key={r.slug}>
          <Link
            to={`/mods/${r.slug}`}
            className="block min-h-11 space-y-2 px-4 py-3 hover:bg-raised"
          >
            <div className="flex items-center gap-2.5">
              <ModIcon src={r.iconUrl} name={r.name} size={32} />
              <span className="min-w-0 flex-1 truncate font-medium text-ink">
                {r.name}
              </span>
              <span className="text-right">
                <span className="num block font-medium text-ink">
                  {formatCount(r.total)}
                </span>
                <DeltaText value={r.gain?.total ?? null} className="text-xs" />
              </span>
              <Icon
                name="chevron_right"
                size={16}
                className="shrink-0 text-faint"
              />
            </div>
            <SplitBar row={r} showPercent={false} />
            <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
              <span className="text-ink">
                <span className="text-cf">{tc("platform.curseforge")}</span>{" "}
                <Figure value={r.curseforge} />
              </span>
              <span className="text-ink">
                <span className="text-mr">{tc("platform.modrinth")}</span>{" "}
                <Figure value={r.modrinth} />
              </span>
            </p>
          </Link>
        </li>
      ))}
      {rows.length === 0 && (
        <li className="sr-only">{t("compare.emptyTitle")}</li>
      )}
    </ul>
  );
}
