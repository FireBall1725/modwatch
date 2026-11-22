// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 FireBall1725

package repository

import (
	"context"
	"testing"
	"time"
)

func TestSaveSettingsSetsReplacesAndDeletes(t *testing.T) {
	r := newRepo(t)
	ctx := context.Background()
	a, b := "one", "two"
	if err := r.SaveSettings(ctx, map[string]*string{"k1": &a, "k2": &b}, time.Now()); err != nil {
		t.Fatal(err)
	}
	c := "three"
	if err := r.SaveSettings(ctx, map[string]*string{"k1": &c, "k2": nil}, time.Now()); err != nil {
		t.Fatal(err)
	}
	got, err := r.Settings(ctx)
	if err != nil || len(got) != 1 || got["k1"] != "three" {
		t.Errorf("settings = %v, err %v", got, err)
	}
	// Deleting a key that isn't there is fine.
	if err := r.SaveSettings(ctx, map[string]*string{"missing": nil}, time.Now()); err != nil {
		t.Errorf("deleting a missing key: %v", err)
	}
}
