// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cx } from "../../lib/cx";

const TABS = ["connections", "registry", "versions", "appearance"] as const;

/** The settings sub pages. Each is its own address, so a link can point at one. */
export default function SettingsTabs() {
  const { t } = useTranslation("settings");
  return (
    <nav aria-label={t("tabs.label")} className="mb-4 flex flex-wrap gap-x-1 border-b border-line">
      {TABS.map((tab) => (
        <NavLink
          key={tab}
          to={`/settings/${tab}`}
          className={({ isActive }) =>
            cx(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap no-underline",
              isActive ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )
          }
        >
          {t(`tabs.${tab}`)}
        </NavLink>
      ))}
    </nav>
  );
}
