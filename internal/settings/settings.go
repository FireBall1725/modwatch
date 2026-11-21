// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

// Package settings joins the environment's configuration with the values the author set in the UI.
package settings

import (
	"context"
	"strings"
	"time"

	"github.com/fireball1725/modwatch/internal/config"
	"github.com/fireball1725/modwatch/internal/repository"
)

// Source says where a value in use comes from.
const (
	SourceUI   = "ui"
	SourceEnv  = "env"
	SourceNone = "none"
)

// Item is one setting as the UI sees it. A secret's Value is always nil.
type Item struct {
	Key    string  `json:"key"`
	Secret bool    `json:"secret"`
	Value  *string `json:"value"`
	Set    bool    `json:"set"`
	Source string  `json:"source"`
	EnvSet bool    `json:"envSet"`
}

// Store reads and writes the UI-set values over a base configuration read from the environment.
type Store struct {
	base *config.Config
	repo *repository.Repo
	now  func() time.Time
}

func New(base *config.Config, repo *repository.Repo) *Store {
	return &Store{base: base, repo: repo, now: time.Now}
}

// Base is the configuration the environment gave, before any UI value.
func (s *Store) Base() *config.Config { return s.base }

// Effective is the configuration to use now: the environment's, with the UI's values over it.
func (s *Store) Effective(ctx context.Context) (*config.Config, error) {
	ui, err := s.repo.Settings(ctx)
	if err != nil {
		return nil, err
	}
	return s.base.With(ui), nil
}

// Items describes every setting, in display order.
func (s *Store) Items(ctx context.Context) ([]Item, error) {
	ui, err := s.repo.Settings(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Item, 0, len(config.Settings))
	for _, def := range config.Settings {
		env := s.base.Value(def.Key)
		item := Item{Key: def.Key, Secret: def.Secret, Source: SourceNone, EnvSet: env != ""}
		value := env
		if v := strings.TrimSpace(ui[def.Key]); v != "" && config.ValidateSetting(def.Key, v) == nil {
			value, item.Source = v, SourceUI
		} else if env != "" {
			item.Source = SourceEnv
		}
		item.Set = value != ""
		if item.Set && !def.Secret {
			v := value
			item.Value = &v
		}
		out = append(out, item)
	}
	return out, nil
}

// InvalidError is a rejected update; its text is safe to show the author.
type InvalidError struct{ Msg string }

func (e *InvalidError) Error() string { return e.Msg }

// Update applies a partial change. A non-empty string sets the value, nil or an empty string clears the UI value
// so the environment's applies again. It returns *InvalidError for an unknown key or a bad value, and saves nothing then.
func (s *Store) Update(ctx context.Context, changes map[string]*string) error {
	save := make(map[string]*string, len(changes))
	for key, v := range changes {
		if _, ok := config.SettingFor(key); !ok {
			return &InvalidError{Msg: "unknown setting " + key}
		}
		if v == nil || strings.TrimSpace(*v) == "" {
			save[key] = nil
			continue
		}
		t := strings.TrimSpace(*v)
		if err := config.ValidateSetting(key, t); err != nil {
			return &InvalidError{Msg: err.Error()}
		}
		save[key] = &t
	}
	return s.repo.SaveSettings(ctx, save, s.now())
}
