// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import type { CurseForgeAuthor } from "../../lib/types";
import Button from "../../components/ui/Button";
import TextInput from "../../components/ui/TextInput";

/** Finds the author id from the profile link, so the author never has to dig it out. Shows the match and saves only when they say so. */
export default function AuthorFinder({ onSaved }: { onSaved: (text: string) => Promise<void> }) {
  const { t } = useTranslation("settings");
  const [link, setLink] = useState("");
  const [found, setFound] = useState<CurseForgeAuthor | null>(null);
  const [busy, setBusy] = useState<"find" | "use" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setBusy("find");
    setError(null);
    setFound(null);
    try {
      setFound(await api.curseforgeAuthor(link.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const use = async () => {
    if (!found) return;
    setBusy("use");
    setError(null);
    try {
      await api.settingsPut({ curseforgeAuthorId: String(found.id) });
      setLink("");
      setFound(null);
      await onSaved(t("connections.keys.curseforgeAuthorId.saved", { name: found.name, id: found.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 rounded-md border border-line bg-sunk px-3 py-3">
      <p className="text-sm font-medium text-ink">{t("authorFinder.title")}</p>
      <p className="mt-0.5 text-xs text-muted">{t("authorFinder.help")}</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim() && !busy) void find();
        }}
      >
        <div className="min-w-0 flex-1">
          <TextInput
            value={link}
            onChange={setLink}
            label={t("authorFinder.label")}
            placeholder="https://www.curseforge.com/members/<name>"
            mono
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="secondary" icon="link" loading={busy === "find"} disabled={!link.trim() || busy !== null}>
          {t("authorFinder.find")}
        </Button>
      </form>
      {found && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" role="status">
          <span className="text-ink">
            {t("authorFinder.found", { name: found.name, id: found.id })}
          </span>
          <Button size="sm" icon="check" loading={busy === "use"} disabled={busy !== null} onClick={() => void use()}>
            {t("authorFinder.use")}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm break-words text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
