// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useApi } from "../../hooks/useApi";
import { useOverview } from "../../hooks/overviewContext";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import Toggle from "../../components/ui/Toggle";
import Skeleton from "../../components/ui/Skeleton";

/** One switch per Minecraft version any file has. Switched off versions leave the charts, the matrix and the health checks; their history is kept. */
export default function VersionsCard() {
  const { t } = useTranslation("settings");
  const settings = useApi(api.settings, []);
  const overview = useOverview();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const item = settings.data?.items.find((i) => i.key === "disabledMinecraftVersions");
  const off = new Set((item?.value ?? "").split(",").map((v) => v.trim()).filter(Boolean));
  const versions = settings.data?.minecraftVersions ?? [];

  const flip = async (version: string, trackIt: boolean) => {
    const next = new Set(off);
    if (trackIt) next.delete(version);
    else next.add(version);
    const value = versions.filter((v) => next.has(v)).join(",");
    setBusy(version);
    setFailure(null);
    try {
      await api.settingsPut({ disabledMinecraftVersions: value || null });
      await Promise.all([settings.reload(), overview.reload()]);
      setNotice(t("versions.saved", { version, state: trackIt ? t("versions.on") : t("versions.off") }));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card id="versions" title={t("versions.title")} description={t("versions.description")} className="min-w-0 scroll-mt-20">
      <div aria-live="polite" className={notice ? "mb-4 text-sm text-ok" : "sr-only"}>
        {notice}
      </div>
      {failure && (
        <p role="alert" className="mb-4 text-sm break-words text-bad">
          {t("registry.failed", { message: failure })}
        </p>
      )}
      {settings.loading && !settings.data ? (
        <Skeleton className="h-24" />
      ) : versions.length === 0 ? (
        <EmptyState compact title={t("versions.empty")} icon="info" />
      ) : (
        <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {versions.map((v) => {
            const tracked = !off.has(v);
            return (
              <li key={v}>
                <Toggle
                  checked={tracked}
                  disabled={busy !== null}
                  onChange={(next) => void flip(v, next)}
                  label={<span className="font-mono text-sm text-ink">{`${v}: ${tracked ? t("versions.on") : t("versions.off")}`}</span>}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
