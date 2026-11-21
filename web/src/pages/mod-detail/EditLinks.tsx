// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import type { CatalogUpdate } from "../../lib/types";
import { useApi } from "../../hooks/useApi";
import Button from "../../components/ui/Button";
import Dialog from "../../components/ui/Dialog";
import EditDialog from "../settings/EditDialog";

interface Props {
  slug: string;
  onClose: () => void;
  /** Called after a save, to read the page again. */
  onSaved: () => Promise<void>;
}

/** The registry's link editor for this mod, opened over its page so the author doesn't leave it. */
export default function EditLinks({ slug, onClose, onSaved }: Props) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const cat = useApi(api.catalog, []);
  const catalog = cat.data;
  const entry = catalog?.entries.find((e) => e.slug === slug);

  if (!catalog) return null; // the dialog appears as soon as the registry has loaded
  if (!entry) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={t("confirm.notFound")}
        footer={<Button onClick={onClose}>{tc("word.close")}</Button>}
      >
        <p className="text-sm text-muted">{t("confirm.notFoundBody")}</p>
      </Dialog>
    );
  }
  return (
    <EditDialog
      entry={entry}
      catalog={catalog}
      onClose={onClose}
      onSave={async (update: CatalogUpdate) => {
        await api.catalogPut(entry.slug, update);
        await onSaved();
        onClose();
      }}
    />
  );
}
