-- Migration: Create Storage Bucket for Company Logos
-- Description: Creates a public bucket for company logos and sets up RLS policies.

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for the bucket
-- 1. Allow public read access to all files in the bucket
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

-- 2. Allow authenticated users to upload files to the bucket
CREATE POLICY "Authenticated Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

-- 3. Allow users to update/delete their own uploads (or admins to manage all)
CREATE POLICY "Authenticated Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');
