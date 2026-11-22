// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from "react-i18next";
import Card from "../../components/ui/Card";
import PlatformBadge from "../../components/ui/PlatformBadge";
import RelativeTime from "../../components/ui/RelativeTime";
import { formatMoney, maskMoney } from "../../lib/format";
import { useHideMoney } from "../../lib/privacyPref";
import type { RevenueItem } from "../../lib/types";

/** What a platform owes the author: the balance, and what each of the last months earned. Only Modrinth offers it. */
export default function RevenueCard({ item }: { item: RevenueItem }) {
  const { t } = useTranslation("overview");
  const [hidden] = useHideMoney();
  const money = (n: number, currency: string) => (hidden ? maskMoney(currency) : formatMoney(n, currency));
  const max = Math.max(...item.months.map((m) => m.amount), 0);
  const figures: { key: string; value: number }[] = [
    { key: "pending", value: item.pending },
    { key: "withdrawnYtd", value: item.withdrawnYtd },
    { key: "withdrawnLifetime", value: item.withdrawnLifetime },
  ];
  return (
    <Card id="revenue" title={t("revenue.title")} description={t("revenue.description")} actions={<PlatformBadge platform={item.platform} size="sm" iconOnly />}>
      <p className="text-xs text-muted">{t("revenue.available")}</p>
      <p className="num text-2xl font-semibold text-ink">{money(item.available, item.currency)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
        {figures.map((f) => (
          <div key={f.key}>
            <dt className="text-muted">{t(`revenue.${f.key}`)}</dt>
            <dd className="num mt-0.5 text-sm text-ink">{money(f.value, item.currency)}</dd>
          </div>
        ))}
      </dl>
      {item.months.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted">{t("revenue.months", { count: item.months.length })}</p>
          <ul
            aria-label={t("revenue.chart")}
            className="mt-2 flex h-14 items-end gap-1"
          >
            {item.months.map((m) => (
              <li key={m.month} className="flex h-full flex-1 items-end" title={`${m.month}: ${money(m.amount, item.currency)}`}>
                <span
                  className="block w-full rounded-sm bg-mr"
                  style={{ height: hidden ? "30%" : `${max > 0 ? Math.max(4, (m.amount / max) * 100) : 4}%`, opacity: hidden ? 0.4 : m.amount > 0 ? 1 : 0.25 }}
                />
                <span className="sr-only">{`${m.month}: ${money(m.amount, item.currency)}`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-faint">
        {t("revenue.updated")} <RelativeTime iso={item.fetchedAt} />. {t("revenue.curseforge")}
      </p>
    </Card>
  );
}
