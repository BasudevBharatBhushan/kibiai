-- ============================================================
-- Migration: 016_access_control_permissions.sql
-- Ticket:    T-016 — Access Control & Dual-View Architecture
-- Purpose:   Update user_template_permissions to support
--            granular chart permission model
-- ============================================================

-- Step 1: Rename can_create_charts → can_generate_charts
-- (user-level: generate charts from existing chart templates)
ALTER TABLE user_template_permissions
  RENAME COLUMN can_create_charts TO can_generate_charts;

-- Step 2: Add can_analyze_charts (admin-level: AI chart analysis)
ALTER TABLE user_template_permissions
  ADD COLUMN IF NOT EXISTS can_analyze_charts boolean DEFAULT false;

-- ============================================================
-- NOTES:
-- can_generate_charts = User-level: run chart templates on a
--   saved report to produce a new chart instance.
-- can_analyze_charts  = Admin-level: use AI to build/edit
--   chart templates (previously conflated with can_create_charts).
-- ============================================================
