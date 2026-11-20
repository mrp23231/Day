-- Private, immutable images. Each account can access only its own UUID folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('day-photos','day-photos',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy day_photos_select on storage.objects
for select to authenticated
using (bucket_id='day-photos' and (storage.foldername(name))[1]=(select auth.uid()::text));

create policy day_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='day-photos'
  and (storage.foldername(name))[1]=(select auth.uid()::text)
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- No anonymous access, public URLs, overwrites or client-side deletion policies.
-- Previous versions stay available to another device until account cleanup.
