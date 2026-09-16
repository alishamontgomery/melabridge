-- Add category_fields JSONB column to vendor_packages.
-- Stores category-specific structured data (guest capacity, service style, equipment, etc.)
-- populated by the single-scroll package builder for 11 special vendor categories.

ALTER TABLE public.vendor_packages
  ADD COLUMN IF NOT EXISTS category_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
