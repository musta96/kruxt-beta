UPDATE storage.buckets
SET public = false
WHERE id = 'privacy-exports';

DROP POLICY IF EXISTS privacy_export_owner_select ON storage.objects;

CREATE POLICY privacy_export_owner_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'privacy-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);