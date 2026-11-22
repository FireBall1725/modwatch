// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import Dialog from "../../components/ui/Dialog";
import Select from "../../components/ui/Select";
import TextInput from "../../components/ui/TextInput";
import Toggle from "../../components/ui/Toggle";
import PlatformBadge from "../../components/ui/PlatformBadge";
import type {
  Catalog,
  CatalogEntry,
  CatalogUpdate,
  Platform,
} from "../../lib/types";
import {
  diff,
  formFrom,
  holderOf,
  stillUnlinked,
  validate,
  wouldDelete,
  type Form,
} from "./logic";

interface Props {
  entry: CatalogEntry;
  catalog: Catalog;
  onClose: () => void;
  onSave: (update: CatalogUpdate) => Promise<void>;
}

/** The link editor for one entry: name, both project ids, the issue label and whether it is hidden. */
export default function EditDialog({ entry, catalog, onClose, onSave }: Props) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const [form, setForm] = useState<Form>(() => formFrom(entry));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = validate(form);
  const update = diff(entry, form);
  const changed = Object.keys(update).length > 0;
  const projects = useMemo(() => stillUnlinked(catalog), [catalog]);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!changed || Object.keys(errors).length) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSave(update);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const errText = (k: keyof typeof errors) =>
    errors[k]
      ? t(`edit.${errors[k] === "label" ? "labelBad" : errors[k] === "repo" ? "repoBad" : errors[k] === "pattern" ? "patternBad" : errors[k]}`)
      : null;

  const platformField = (platform: Platform) => {
    const key = platform === "curseforge" ? "curseforgeId" : "modrinthId";
    const value = form[key];
    const holder = holderOf(catalog.entries, entry.slug, platform, value);
    const options = projects.filter((p) => p.platform === platform);
    return (
      <div className="space-y-2">
        <div className="flex items-end gap-2">
          <TextInput
            className="flex-1"
            mono
            label={t(`edit.${platform}`)}
            value={value}
            onChange={(v) => set({ [key]: v } as Partial<Form>)}
            helper={t("edit.idHelper")}
            error={errText(key)}
            inputMode={platform === "curseforge" ? "numeric" : "text"}
            autoComplete="off"
            spellCheck={false}
          />
          {value !== "" && (
            <Button
              variant="ghost"
              icon="unlink"
              className="mb-6"
              onClick={() => set({ [key]: "" } as Partial<Form>)}
            >
              {t("edit.unlink")}
            </Button>
          )}
        </div>
        {options.length > 0 && (
          <Select
            label={t("edit.adopt")}
            hideLabel
            value=""
            onChange={(id) => id && set({ [key]: id } as Partial<Form>)}
            options={[
              { value: "", label: t("edit.adopt") },
              ...options.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.id})`,
              })),
            ]}
          />
        )}
        {holder && (
          <p className="text-xs text-review">
            {t("edit.moves", { name: holder.name })}{" "}
            {wouldDelete(holder, platform) &&
              t("edit.movesDeletes", { name: holder.name })}
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("edit.title", { name: entry.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc("word.cancel")}
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!changed || Object.keys(errors).length > 0}
            onClick={() => void submit()}
          >
            {t("edit.save")}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {failure && (
          <p
            role="alert"
            className="rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-ink"
          >
            {t("registry.failed", { message: failure })}
          </p>
        )}
        <TextInput
          label={t("edit.name")}
          value={form.name}
          onChange={(v) => set({ name: v })}
          error={errText("name")}
        />
        <fieldset className="space-y-3">
          <legend className="sr-only">{t("registry.title")}</legend>
          <PlatformBadge platform="curseforge" size="sm" />
          {platformField("curseforge")}
          <PlatformBadge platform="modrinth" size="sm" />
          {platformField("modrinth")}
        </fieldset>
        <TextInput
          mono
          label={t("edit.label")}
          value={form.githubLabel}
          onChange={(v) => set({ githubLabel: v })}
          helper={t("edit.labelHelper", { slug: entry.slug })}
          error={errText("githubLabel")}
          autoComplete="off"
          spellCheck={false}
        />
        <TextInput
          mono
          label={t("edit.repo")}
          value={form.githubRepo}
          onChange={(v) => set({ githubRepo: v })}
          helper={form.githubRepo.trim() !== "" ? t("edit.repoHelperSet") : t("edit.repoHelper")}
          error={errText("githubRepo")}
          placeholder="owner/name"
          autoComplete="off"
          spellCheck={false}
        />
        <TextInput
          mono
          label={t("edit.versionPattern")}
          value={form.versionRegex}
          onChange={(v) => set({ versionRegex: v })}
          helper={t("edit.versionPatternHelper")}
          error={errText("versionRegex")}
          placeholder="^(?P<version>\d+\.\d+\.\d+)(?:-(?P<pre>rc\.\d+))?-(?:mc)?(?P<minecraft>.+)$"
          autoComplete="off"
          spellCheck={false}
        />
        <Toggle
          checked={form.hidden}
          onChange={(v) => set({ hidden: v })}
          label={t("edit.hidden")}
          description={t("edit.hiddenHelper")}
        />
        {!changed && (
          <p className="text-xs text-muted">{t("edit.noChanges")}</p>
        )}
        <button
          type="submit"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
        />
      </form>
    </Dialog>
  );
}
