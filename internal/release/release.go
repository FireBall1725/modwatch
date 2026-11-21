// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package release splits a file's version text into the release it belongs to and the Minecraft version it targets,
// so "26.11.0 for Minecraft 1.21.1" and "26.11.0-mc1.21.1" read as the same release.
package release

import (
	"errors"
	"regexp"
	"strings"
)

// Info is what a version text says.
type Info struct {
	// Version is the release number, such as 26.11.0.
	Version string `json:"version"`
	// Pre is the pre-release tag, such as rc.1. Empty for a final release.
	Pre string `json:"pre"`
	// Minecraft is the Minecraft version the text names, such as 1.21.1. Empty when it names none.
	Minecraft string `json:"minecraft"`
}

// Name is the release as people say it: 26.11.0, or 26.11.0-rc.1 for a pre-release.
func (i Info) Name() string {
	if i.Pre == "" {
		return i.Version
	}
	return i.Version + "-" + i.Pre
}

var (
	// mcSuffix is a trailing "for Minecraft 1.21.1", "-mc1.21.1" or "+mc1.21.1".
	mcSuffix = regexp.MustCompile(`(?i)[\s\-_+]*(?:for\s+)?(?:minecraft|mc)[\s\-_]*v?(\d+(?:\.\d+)+)\s*$`)
	// parenSuffix is a trailing loader and Minecraft version in brackets, as in "3 26.10.0 (fabric 26.3)".
	parenSuffix = regexp.MustCompile(`\s*\(\s*[A-Za-z][A-Za-z ]*?\s+(\d+(?:\.\d+)+)\s*\)\s*$`)
	// bareSuffix is a trailing "-1.21.1" with no mc in front; it only counts when the file lists that version.
	bareSuffix = regexp.MustCompile(`[\-_+](\d+(?:\.\d+)+)\s*$`)
	// fileExt is a file extension left on a name used as a version.
	fileExt = regexp.MustCompile(`(?i)\.(jar|zip|mrpack)$`)
	// dotted is a version number with at least two parts. A bare integer in front, such as the 3 in
	// "DevWorld 3 26.10.0", is a product number and not the release.
	dotted = regexp.MustCompile(`(?i)v?(\d+\.\d+(?:\.\d+)*)`)
	// preTag is a pre-release tag right after the version: -rc.1, -beta3, " snapshot".
	preTag = regexp.MustCompile(`(?i)^[\s\-_+.]?(rc|beta|alpha|pre|snapshot)[\s.\-_]?(\d+)?`)
	// core is a plain number at the start, for texts with no dotted version such as "v3" or "42".
	core = regexp.MustCompile(`(?i)^\s*v?(\d+)`)
)

// Parse reads a version text. gameVersions are the Minecraft versions the file lists, which settles a bare
// trailing version such as "1.2.3-1.21.1". re is the mod's own pattern, if it has one: it needs a named group
// version, and may have pre and minecraft. A text the pattern doesn't match is read the default way.
func Parse(text string, gameVersions []string, re *regexp.Regexp) Info {
	text = strings.TrimSpace(text)
	if re != nil {
		if m := re.FindStringSubmatch(text); m != nil {
			info := Info{}
			for i, name := range re.SubexpNames() {
				switch name {
				case "version":
					info.Version = strings.TrimSpace(m[i])
				case "pre":
					info.Pre = strings.Trim(strings.TrimSpace(m[i]), "-_+. ")
				case "minecraft":
					info.Minecraft = strings.TrimSpace(m[i])
				}
			}
			if info.Version != "" {
				return info
			}
		}
	}
	return parseDefault(text, gameVersions)
}

func parseDefault(text string, gameVersions []string) Info {
	info := Info{}
	rest := fileExt.ReplaceAllString(text, "")
	if m := mcSuffix.FindStringSubmatchIndex(rest); m != nil {
		info.Minecraft = rest[m[2]:m[3]]
		rest = rest[:m[0]]
	} else if m := parenSuffix.FindStringSubmatchIndex(rest); m != nil {
		info.Minecraft = rest[m[2]:m[3]]
		rest = rest[:m[0]]
	} else if m := bareSuffix.FindStringSubmatchIndex(rest); m != nil {
		token := rest[m[2]:m[3]]
		for _, g := range gameVersions {
			if g == token {
				info.Minecraft = token
				rest = rest[:m[0]]
				break
			}
		}
	}
	isGame := func(v string) bool {
		for _, g := range gameVersions {
			if g == v {
				return true
			}
		}
		return false
	}
	// The release is the first dotted version that isn't one of the file's Minecraft versions, which a name such as
	// "2-1.15.2-1.0.3-client.jar" carries in front of the real one. If every candidate is a Minecraft version, the
	// first is used.
	var pick []int
	for _, m := range dotted.FindAllStringSubmatchIndex(rest, -1) {
		if pick == nil {
			pick = m
		}
		if !isGame(rest[m[2]:m[3]]) {
			pick = m
			break
		}
	}
	if pick != nil {
		info.Version = rest[pick[2]:pick[3]]
		if t := preTag.FindStringSubmatch(rest[pick[1]:]); t != nil {
			info.Pre = strings.ToLower(t[1])
			if t[2] != "" {
				info.Pre += "." + t[2]
			}
		}
		return info
	}
	if c := core.FindStringSubmatch(rest); c != nil {
		info.Version = c[1]
		return info
	}
	info.Version = strings.TrimSpace(rest)
	return info
}

// Compile checks a mod's pattern: it must compile, be short, and name a version group.
func Compile(pattern string) (*regexp.Regexp, error) {
	if len(pattern) > 300 {
		return nil, errors.New("the version pattern can't be longer than 300 characters")
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, errors.New("the version pattern isn't a valid regular expression")
	}
	for _, n := range re.SubexpNames() {
		if n == "version" {
			return re, nil
		}
	}
	return nil, errors.New("the version pattern needs a group named version, such as (?P<version>\\d+\\.\\d+\\.\\d+)")
}
