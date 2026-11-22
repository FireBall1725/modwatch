// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { useTranslation } from "react-i18next";
import Card from "../../components/ui/Card";
import Icon from "../../components/ui/Icon";
import { cx } from "../../lib/cx";
import { useTheme } from "../../lib/themePref";
import { THEMES, type ThemeInfo } from "../../themes/build";

/** A small drawing of a page in the theme's own colours: its background, a card, a line of text and the accent. */
function Preview({ theme }: { theme: ThemeInfo }) {
  const [ground, surface, ink, accent, blue, green] = theme.swatch;
  return (
    <span aria-hidden="true" className="block rounded-md border border-line p-2" style={{ background: ground }}>
      <span className="block rounded-sm p-2" style={{ background: surface }}>
        <span className="block h-1.5 w-2/3 rounded-full" style={{ background: ink }} />
        <span className="mt-1.5 block h-1.5 w-1/2 rounded-full" style={{ background: ink, opacity: 0.45 }} />
        <span className="mt-2.5 flex gap-1">
          <span className="block h-2.5 w-6 rounded-full" style={{ background: accent }} />
          <span className="block h-2.5 w-3 rounded-full" style={{ background: blue }} />
          <span className="block h-2.5 w-3 rounded-full" style={{ background: green }} />
        </span>
      </span>
    </span>
  );
}

function Group({ title, themes }: { title: string; themes: ThemeInfo[] }) {
  const [current, setTheme] = useTheme();
  const { t } = useTranslation("settings");
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 border-b border-line pb-2 text-sm font-semibold text-ink">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {themes.map((th) => {
          const on = th.id === current;
          return (
            <label
              key={th.id}
              className={cx(
                "relative block cursor-pointer rounded-lg border p-2.5 transition-colors has-[:focus-visible]:shadow-[var(--focus-ring)]",
                on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={th.id}
                checked={on}
                onChange={() => setTheme(th.id)}
                className="sr-only"
              />
              <Preview theme={th} />
              <span className="mt-2 flex items-center justify-between gap-2 text-sm font-medium text-ink">
                <span className="min-w-0 truncate">{th.name}</span>
                {on && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-accent">
                    <Icon name="check" size={12} />
                    {t("appearance.inUse")}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The colour theme. It applies at once and is kept in this browser, so a laptop and a wall display can differ. */
export default function AppearanceCard() {
  const { t } = useTranslation("settings");
  return (
    <Card id="appearance" title={t("appearance.title")} description={t("appearance.description")} className="min-w-0 scroll-mt-20">
      <div className="space-y-6">
        <Group title={t("appearance.dark")} themes={THEMES.filter((x) => x.scheme === "dark")} />
        <Group title={t("appearance.light")} themes={THEMES.filter((x) => x.scheme === "light")} />
      </div>
    </Card>
  );
}
