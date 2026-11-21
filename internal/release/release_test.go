// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package release

import "testing"

func TestParseReadsEveryShapeTheSameWay(t *testing.T) {
	cases := []struct {
		text     string
		games    []string
		want     Info
		wantName string
	}{
		{"26.11.0 for Minecraft 1.21.1", nil, Info{"26.11.0", "", "1.21.1"}, "26.11.0"},
		{"26.11.0-mc1.21.1", nil, Info{"26.11.0", "", "1.21.1"}, "26.11.0"},
		{"26.11.0-rc.1 for Minecraft 26.2", nil, Info{"26.11.0", "rc.1", "26.2"}, "26.11.0-rc.1"},
		{"26.11.0-rc.1-mc26.1", nil, Info{"26.11.0", "rc.1", "26.1"}, "26.11.0-rc.1"},
		{"v26.11.0+mc26.3", nil, Info{"26.11.0", "", "26.3"}, "26.11.0"},
		{"1.2.3-1.21.1", []string{"1.21.1"}, Info{"1.2.3", "", "1.21.1"}, "1.2.3"},
		{"1.2.3-4", []string{"1.21.1"}, Info{"1.2.3", "", ""}, "1.2.3"},
		{"2.0.0-beta3", nil, Info{"2.0.0", "beta.3", ""}, "2.0.0-beta.3"},
		{"nightly", nil, Info{"nightly", "", ""}, "nightly"},
		// The product number in front is not the release.
		{"3 26.10.0 (fabric 26.3)", []string{"26.3"}, Info{"26.10.0", "", "26.3"}, "26.10.0"},
		{"DevWorld 3 26.10.0 (neoforge 1.21.1)", []string{"1.21.1", "1.21"}, Info{"26.10.0", "", "1.21.1"}, "26.10.0"},
		// A Minecraft version in front of the real one is skipped.
		{"2-1.15.2-1.0.3-client.jar", []string{"1.15.2"}, Info{"1.0.3", "", ""}, "1.0.3"},
		// Only Minecraft versions to choose from: the first is used. A mod like this needs its own pattern.
		{"1.11-b15-client.jar", []string{"1.11"}, Info{"1.11", "", ""}, "1.11"},
		{"AELights-0.0.1.jar", nil, Info{"0.0.1", "", ""}, "0.0.1"},
		{"AE2 Lights 26.11.0-rc.1-mc26.2.jar", nil, Info{"26.11.0", "rc.1", "26.2"}, "26.11.0-rc.1"},
	}
	for _, c := range cases {
		got := Parse(c.text, c.games, nil)
		if got != c.want || got.Name() != c.wantName {
			t.Errorf("Parse(%q) = %+v (%s), want %+v (%s)", c.text, got, got.Name(), c.want, c.wantName)
		}
	}
}

func TestAModsOwnPatternWinsAndFallsBack(t *testing.T) {
	re, err := Compile(`^(?P<version>\d+\.\d+\.\d+)(?:-(?P<pre>rc\.\d+))?-(?:mc)?(?P<minecraft>\d+(?:\.\d+)+)$`)
	if err != nil {
		t.Fatal(err)
	}
	got := Parse("26.11.0-rc.1-mc26.1", nil, re)
	if got != (Info{"26.11.0", "rc.1", "26.1"}) {
		t.Errorf("pattern match = %+v", got)
	}
	// The CurseForge wording doesn't match the pattern, so the default reading takes over.
	if got := Parse("26.11.0 for Minecraft 1.21.1", nil, re); got != (Info{"26.11.0", "", "1.21.1"}) {
		t.Errorf("fallback = %+v", got)
	}
}

func TestCompileRejectsBadPatterns(t *testing.T) {
	for _, bad := range []string{"(", `\d+`, `(?P<pre>rc)`, string(make([]byte, 301))} {
		if _, err := Compile(bad); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
}
