// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package curseforge

import "testing"

func TestParseProfile(t *testing.T) {
	cases := map[string]string{
		"https://www.curseforge.com/members/fireball1725":          "fireball1725",
		"https://www.curseforge.com/members/fireball1725/projects": "fireball1725",
		"curseforge.com/members/FireBall1725/":                     "FireBall1725",
		"FireBall1725":                                             "FireBall1725",
		"https://www.curseforge.com/minecraft/mc-mods/x":           "",
		"https://example.com/members/x":                            "",
		"":                                                         "",
		"fire ball":                                                "",
	}
	for in, want := range cases {
		if got := ParseProfile(in); got != want {
			t.Errorf("ParseProfile(%q) = %q, want %q", in, got, want)
		}
	}
}
