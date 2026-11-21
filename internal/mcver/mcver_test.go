// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package mcver

import (
	"reflect"
	"testing"
)

func TestSortNewestFirst(t *testing.T) {
	in := []string{"1.20.6", "1.21", "24w14a", "1.21.10", "26.1", "1.21.11", "26.3", "1.21-Pre1", "1.9", "weird", "1.21.2", "24w13b", "1.21-rc1", "1.21-Pre2", "1.21.0", "1.8.9", "1.10"}
	want := []string{"26.3", "26.1", "1.21.11", "1.21.10", "1.21.2", "1.21", "1.21.0", "1.21-rc1", "1.21-Pre2", "1.21-Pre1", "1.20.6", "1.10", "1.9", "1.8.9", "24w14a", "24w13b", "weird"}
	// 1.21 and 1.21.0 are equal; a stable sort keeps their input order, which is 1.21 first.
	Sort(in)
	if !reflect.DeepEqual(in, want) {
		t.Errorf("got  %v\nwant %v", in, want)
	}
}

func TestCompare(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"26.3", "26.1", 1},
		{"26.1", "1.21.11", 1},
		{"1.21.11", "1.21.10", 1},
		{"1.21.10", "1.21.9", 1},
		{"1.21.10", "1.21", 1},
		{"1.21", "1.20.6", 1},
		{"1.21", "1.21.0", 0},
		{"1.21", "1.21-Pre1", 1},
		{"1.21-Pre1", "1.20.6", 1},
		{"1.21-pre2", "1.21-Pre1", 1},
		{"1.21-rc1", "1.21-pre4", 1},
		{"1.21.4-rc2", "1.21.4-rc1", 1},
		{"26.1-snapshot-2", "26.1-snapshot-1", 1},
		{"26.1", "26.1-snapshot-2", 1},
		{"24w14a", "1.8", -1},
		{"24w14a", "1.21-Pre1", -1},
		{"24w14a", "24w13b", 1},
		{"24w14b", "24w14a", 1},
		{"25w01a", "24w52a", 1},
		{"24w14a", "nonsense", 1},
		{"nonsense", "1.0", -1},
		{"alpha", "beta", 1},
		{"", "1.0", -1},
		{"1.21 Pre-Release 1", "1.21-Pre1", 0},
	}
	for _, tt := range tests {
		if got := Compare(tt.a, tt.b); got != tt.want {
			t.Errorf("Compare(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
		if got := Compare(tt.b, tt.a); got != -tt.want {
			t.Errorf("Compare(%q, %q) = %d, want %d", tt.b, tt.a, got, -tt.want)
		}
	}
}

func TestLatest(t *testing.T) {
	tests := []struct {
		in   []string
		want string
	}{
		{nil, ""},
		{[]string{"1.20.1", "1.21.1", "1.21.11"}, "1.21.11"},
		{[]string{"1.21.1", "26.1", "26.2-Pre1"}, "26.1"},
		{[]string{"26.2-Pre1", "24w14a"}, "26.2-Pre1"},
		{[]string{"24w14a"}, "24w14a"},
	}
	for _, tt := range tests {
		if got := Latest(tt.in); got != tt.want {
			t.Errorf("Latest(%v) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestIsRelease(t *testing.T) {
	for v, want := range map[string]bool{"1.21": true, "26.1": true, "1.21-Pre1": false, "24w14a": false, "x": false, "1.21-rc1": false} {
		if got := IsRelease(v); got != want {
			t.Errorf("IsRelease(%q) = %v", v, got)
		}
	}
}
