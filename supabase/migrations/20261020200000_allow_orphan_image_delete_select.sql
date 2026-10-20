create policy "owners read deletable orphan property images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'property-images'
  and private.can_delete_property_image_object(name)
);
