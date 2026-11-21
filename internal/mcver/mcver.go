// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package mcver orders Minecraft version names. Alphabetical order puts 1.21.11 before 1.21.2 and 26.1 before 1.9,
// so every list of versions goes through here.
package mcver

import (
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Classes, oldest rank first: unknown names, snapshots, then releases and their pre-releases.
const (
	classUnknown = iota
	classSnapshot
	classRelease
)

// Suffix ranks within one base version. A plain release is the newest, then release candidates, then pre-releases.
const (
	rankSnapshot = iota
	rankPre
	rankRC
	rankRelease
)

var (
	releaseRe  = regexp.MustCompile(`^(\d+(?:\.\d+)*)(?:[-\s ]+(.+))?$`)
	snapshotRe = regexp.MustCompile(`^(\d{2})w(\d{2})([a-z])$`)
	suffixRe   = regexp.MustCompile(`^(?i)(pre|rc|snapshot)[-\s.]*(?:release[-\s.]*)?(\d*)$`)
)

type parsed struct {
	class int
	parts []int  // numeric parts of a release, or year, week and letter of a snapshot
	rank  int    // suffix rank of a release
	n     int    // suffix number: the 1 in Pre1
	raw   string // for unknown names
}

func parse(v string) parsed {
	v = strings.TrimSpace(v)
	if m := snapshotRe.FindStringSubmatch(strings.ToLower(v)); m != nil {
		y, _ := strconv.Atoi(m[1])
		w, _ := strconv.Atoi(m[2])
		return parsed{class: classSnapshot, parts: []int{y, w, int(m[3][0])}}
	}
	if m := releaseRe.FindStringSubmatch(v); m != nil {
		p := parsed{class: classRelease, rank: rankRelease}
		for _, s := range strings.Split(m[1], ".") {
			n, err := strconv.Atoi(s)
			if err != nil {
				return parsed{class: classUnknown, raw: v}
			}
			p.parts = append(p.parts, n)
		}
		if m[2] != "" {
			sm := suffixRe.FindStringSubmatch(m[2])
			if sm == nil {
				return parsed{class: classUnknown, raw: v}
			}
			switch strings.ToLower(sm[1]) {
			case "rc":
				p.rank = rankRC
			case "pre":
				p.rank = rankPre
			default:
				p.rank = rankSnapshot
			}
			p.n, _ = strconv.Atoi(sm[2])
		}
		return p
	}
	return parsed{class: classUnknown, raw: v}
}

func cmpInt(a, b int) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	}
	return 0
}

// Compare returns -1, 0 or 1 as a is older than, the same as or newer than b.
// Releases beat their own pre-releases, which beat the next older release; snapshots come after every
// release; names that parse as neither sort last, alphabetically.
func Compare(a, b string) int {
	pa, pb := parse(a), parse(b)
	if pa.class != pb.class {
		return cmpInt(pa.class, pb.class)
	}
	switch pa.class {
	case classUnknown:
		return strings.Compare(strings.ToLower(pb.raw), strings.ToLower(pa.raw))
	case classSnapshot:
		for i := range pa.parts {
			if c := cmpInt(pa.parts[i], pb.parts[i]); c != 0 {
				return c
			}
		}
		return 0
	}
	for i := 0; i < len(pa.parts) || i < len(pb.parts); i++ {
		var x, y int
		if i < len(pa.parts) {
			x = pa.parts[i]
		}
		if i < len(pb.parts) {
			y = pb.parts[i]
		}
		if c := cmpInt(x, y); c != 0 {
			return c
		}
	}
	if c := cmpInt(pa.rank, pb.rank); c != 0 {
		return c
	}
	return cmpInt(pa.n, pb.n)
}

// Sort orders versions newest first, in place.
func Sort(vs []string) {
	sort.SliceStable(vs, func(i, j int) bool { return Compare(vs[i], vs[j]) > 0 })
}

// IsRelease reports whether v is a full release: numeric parts and no suffix.
func IsRelease(v string) bool {
	p := parse(v)
	return p.class == classRelease && p.rank == rankRelease
}

// Latest returns the newest full release in vs, or the newest version of any kind when there is no release.
// A single pre-release must not make every other mod look a version behind.
func Latest(vs []string) string {
	best, bestRelease := "", ""
	for _, v := range vs {
		if best == "" || Compare(v, best) > 0 {
			best = v
		}
		if IsRelease(v) && (bestRelease == "" || Compare(v, bestRelease) > 0) {
			bestRelease = v
		}
	}
	if bestRelease != "" {
		return bestRelease
	}
	return best
}
