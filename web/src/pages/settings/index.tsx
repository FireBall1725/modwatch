// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useOverview } from "../../hooks/overviewContext";
import { api } from "../../lib/api";
import type {
  CatalogEntry,
  CatalogUpdate,
  Platform,
  UnlinkedProject,
} from "../../lib/types";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import ConnectionsCard from "./ConnectionsCard";
import Dialog from "../../components/ui/Dialog";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import PageHeader from "../../components/ui/PageHeader";
import SearchInput from "../../components/ui/SearchInput";
import SegmentedControl from "../../components/ui/SegmentedControl";
import Select from "../../components/ui/Select";
import Skeleton from "../../components/ui/Skeleton";
import EditDialog from "./EditDialog";
import PollCard from "./PollCard";
import RegistryTable from "./RegistryTable";
import SourcesCard from "./SourcesCard";
import Strip from "./Strip";
import UnlinkedList from "./UnlinkedList";
import {
  counts,
  filterEntries,
  readParams,
  stillUnclaimedLabels,
  stillUnlinked,
  summarise,
  writeParams,
  type Params,
  type Show,
  type View,
} from "./logic";
import { useNarrow } from "./useNarrow";

interface Unlink {
  entry: CatalogEntry;
  platform: Platform;
}

function without<T>(m: Record<string, T>, key: string): Record<string, T> {
  const out = { ...m }
  delete out[key]
  return out
}

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [sp, setSp] = useSearchParams();
  const params = readParams(sp);
  const overview = useOverview();
  const cat = useApi(api.catalog, []);
  const narrow = useNarrow();
  const [notice, setNotice] = useState<{
    tone: "ok" | "bad";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlink, setUnlink] = useState<Unlink | null>(null);

  const setParams = useCallback(
    (p: Partial<Params>, replace = true) =>
      setSp((cur) => writeParams(p, cur), { replace }),
    [setSp],
  );

  const catalog = cat.data;
  const projects = useMemo(
    () => (catalog ? stillUnlinked(catalog) : []),
    [catalog],
  );
  const labels = useMemo(
    () => (catalog ? stillUnclaimedLabels(catalog) : []),
    [catalog],
  );
  const summary = useMemo(
    () =>
      overview.data && catalog
        ? summarise(overview.data.sources, projects, labels)
        : null,
    [overview.data, catalog, projects, labels],
  );
  const icons = useMemo(
    () => new Map((overview.data?.mods ?? []).map((m) => [m.slug, m.iconUrl])),
    [overview.data],
  );
  const [pendingLegacy, setPendingLegacy] = useState<Record<string, boolean>>(
    {},
  );
  const [legacyErrors, setLegacyErrors] = useState<Record<string, string>>({});
  const entries = useMemo(
    () =>
      (catalog?.entries ?? []).map((e) =>
        e.slug in pendingLegacy ? { ...e, legacy: pendingLegacy[e.slug] } : e,
      ),
    [catalog, pendingLegacy],
  );
  const shown = useMemo(
    () => filterEntries(entries, params),
    [entries, params],
  );
  const tally = useMemo(() => counts(entries), [entries]);
  const editing = params.edit
    ? (entries.find((e) => e.slug === params.edit) ?? null)
    : null;

  const put = async (
    entry: CatalogEntry,
    update: CatalogUpdate,
    done: string,
  ) => {
    setBusy(true);
    try {
      await api.catalogPut(entry.slug, update);
      await Promise.all([cat.reload(), overview.reload()]);
      setNotice({ tone: "ok", text: done });
    } catch (e) {
      setNotice({
        tone: "bad",
        text: t("registry.failed", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const toggleLegacy = async (entry: CatalogEntry, legacy: boolean) => {
    setLegacyErrors((m) => without(m, entry.slug));
    setPendingLegacy((p) => ({ ...p, [entry.slug]: legacy }));
    try {
      await api.catalogPut(entry.slug, { legacy });
      await Promise.all([cat.reload(), overview.reload()]);
    } catch (e) {
      setLegacyErrors((m) => ({
        ...m,
        [entry.slug]: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setPendingLegacy((m) => without(m, entry.slug));
    }
  };

  const relink = async () => {
    setBusy(true);
    try {
      await api.catalogRelink();
      await Promise.all([cat.reload(), overview.reload()]);
      setNotice({ tone: "ok", text: t("registry.relinked") });
    } catch (e) {
      setNotice({
        tone: "bad",
        text: t("registry.failed", {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setBusy(false);
    }
  };

  const link = (p: UnlinkedProject, entry: CatalogEntry) =>
    put(
      entry,
      p.platform === "curseforge"
        ? { curseforgeId: Number(p.id) }
        : { modrinthId: p.id },
      t("registry.linkedDone", { what: p.name, name: entry.name }),
    ).catch(() => undefined);

  const views = [
    {
      value: "linked" as View,
      label: `${t("registry.linked")} ${entries.length}`,
    },
    {
      value: "unlinked" as View,
      label: `${t("registry.unlinked")} ${projects.length + labels.length}`,
    },
  ];
  const showOptions: { value: Show; label: string }[] = [
    { value: "all", label: `${t("registry.showAll")} (${tally.all})` },
    { value: "single", label: `${t("registry.showSingle")} (${tally.single})` },
    { value: "manual", label: `${t("registry.showManual")} (${tally.manual})` },
    { value: "hidden", label: `${t("registry.showHidden")} (${tally.hidden})` },
  ];
  const filtering = params.q !== "" || params.show !== "all";

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Strip summary={summary} loading={cat.loading} />
      <ConnectionsCard />
      <div className="flex flex-col gap-4">
        <Card
          id="registry"
          title={t("registry.title")}
          description={t("registry.description")}
          padded={false}
          className="min-w-0"
          actions={
            <div className="flex min-w-0 flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                size="sm"
                variant="ghost"
                icon="wand"
                disabled={busy}
                onClick={() => void relink()}
                title={t("registry.relinkHint")}
              >
                {t("registry.relink")}
              </Button>
              <SegmentedControl
                label={t("registry.view")}
                options={views}
                value={params.view}
                onChange={(v) => setParams({ view: v })}
              />
            </div>
          }
        >
          <div
            aria-live="polite"
            className={notice ? "px-4 pt-3 sm:px-5" : "sr-only"}
          >
            {notice && (
              <p
                className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm text-ink ${notice.tone === "ok" ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft"}`}
                role={notice.tone === "bad" ? "alert" : undefined}
              >
                <span className="min-w-0 break-words">{notice.text}</span>
                <button
                  type="button"
                  className="cursor-pointer text-xs text-muted underline hover:text-ink"
                  onClick={() => setNotice(null)}
                >
                  {tc("word.close")}
                </button>
              </p>
            )}
          </div>
          {cat.loading ? (
            <div className="space-y-3 p-4 sm:p-5">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : cat.error && !catalog ? (
            <div className="p-4 sm:p-5">
              <ErrorState
                error={cat.error}
                title={t("error.title")}
                onRetry={() => void cat.reload()}
              />
            </div>
          ) : params.view === "unlinked" ? (
            <div className="mt-2">
              <UnlinkedList
                projects={projects}
                labels={labels}
                entries={entries}
                busy={busy}
                onLinkProject={(p, e) => void link(p, e)}
                onLinkLabel={(label, e) =>
                  void put(
                    e,
                    { githubLabel: label },
                    t("registry.linkedDone", {
                      what: t("registry.labelDefault", { label }),
                      name: e.name,
                    }),
                  ).catch(() => undefined)
                }
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:flex-row sm:items-end sm:px-5">
                <SearchInput
                  className="min-w-0 flex-1"
                  value={params.q}
                  onChange={(q) => setParams({ q })}
                  placeholder={t("registry.search")}
                />
                <Select
                  className="sm:w-56"
                  label={t("registry.show")}
                  hideLabel
                  value={params.show}
                  onChange={(v) => setParams({ show: v as Show })}
                  options={showOptions}
                />
              </div>
              <p className="num px-4 pb-2 text-xs text-faint sm:px-5">
                {t("registry.count", { count: shown.length })}
              </p>
              <RegistryTable
                entries={shown}
                icons={icons}
                narrow={narrow}
                onEdit={(e) => setParams({ edit: e.slug }, false)}
                onToggleHidden={(e) =>
                  void put(
                    e,
                    { hidden: !e.hidden },
                    t(e.hidden ? "registry.shownDone" : "registry.hiddenDone", {
                      name: e.name,
                    }),
                  ).catch(() => undefined)
                }
                onUnlink={(entry, platform) => setUnlink({ entry, platform })}
                onToggleLegacy={(e, v) => void toggleLegacy(e, v)}
                legacyErrors={legacyErrors}
                empty={
                  filtering ? (
                    <EmptyState
                      icon="search"
                      title={t("registry.empty")}
                      description={t("registry.emptyHint")}
                      action={
                        <Button
                          size="sm"
                          onClick={() => setParams({ q: "", show: "all" })}
                        >
                          {tc("word.clear")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon="package"
                      title={t("registry.emptyNone")}
                      description={t("registry.emptyNoneHint")}
                    />
                  )
                }
              />
            </>
          )}
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <SourcesCard />
          <PollCard />
        </div>
      </div>

      {editing && (
        <EditDialog
          key={editing.slug}
          entry={editing}
          catalog={catalog!}
          onClose={() => setParams({ edit: null }, false)}
          onSave={async (update) => {
            await put(
              editing,
              update,
              t("registry.saved", { name: update.name ?? editing.name }),
            );
            setParams({ edit: null }, false);
          }}
        />
      )}
      {params.edit && !editing && catalog && (
        <Dialog
          open
          onClose={() => setParams({ edit: null }, false)}
          title={t("confirm.notFound")}
          footer={
            <Button onClick={() => setParams({ edit: null }, false)}>
              {tc("word.close")}
            </Button>
          }
        >
          <p className="text-sm text-muted">{t("confirm.notFoundBody")}</p>
        </Dialog>
      )}
      {unlink && (
        <Dialog
          open
          onClose={() => setUnlink(null)}
          title={t("confirm.unlinkTitle", {
            platform: tc(`platform.${unlink.platform}`),
            name: unlink.entry.name,
          })}
          footer={
            <>
              <Button variant="ghost" onClick={() => setUnlink(null)}>
                {tc("word.cancel")}
              </Button>
              <Button
                variant="danger"
                icon="unlink"
                loading={busy}
                onClick={() => {
                  const { entry, platform } = unlink;
                  void put(
                    entry,
                    platform === "curseforge"
                      ? { curseforgeId: null }
                      : { modrinthId: null },
                    t("registry.unlinkedDone", {
                      platform: tc(`platform.${platform}`),
                      name: entry.name,
                    }),
                  )
                    .catch(() => undefined)
                    .finally(() => setUnlink(null));
                }}
              >
                {t("confirm.unlink")}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">{t("confirm.unlinkBody")}</p>
          {(unlink.platform === "curseforge"
            ? unlink.entry.modrinthId
            : unlink.entry.curseforgeId) === null && (
            <p className="mt-2 text-sm text-review">
              {t("confirm.unlinkLast", { name: unlink.entry.name })}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
