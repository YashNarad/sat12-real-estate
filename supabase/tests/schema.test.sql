select extensions.plan(60);

select extensions.has_table('public', 'profiles', 'profiles exists');
select extensions.has_table('public', 'properties', 'properties exists');
select extensions.has_table('public', 'property_revisions', 'property revisions exist');
select extensions.has_table('public', 'property_images', 'property images exist');
select extensions.has_table('public', 'enquiries', 'enquiries exist');
select extensions.has_table('public', 'listing_approvals', 'listing approvals exist');
select extensions.has_table('public', 'role_audit_log', 'role audit log exists');
select extensions.has_table('public', 'legal_holds', 'legal holds exist');
select extensions.has_table('public', 'retention_audit_log', 'retention audit log exists');

select extensions.has_type('public', 'app_role', 'app role enum exists');
select extensions.has_type('public', 'listing_intent', 'listing intent enum exists');
select extensions.has_type('public', 'property_type', 'property type enum exists');
select extensions.has_type('public', 'construction_status', 'construction status enum exists');
select extensions.has_type('public', 'revision_status', 'revision status enum exists');
select extensions.has_type('public', 'approval_decision', 'approval decision enum exists');
select extensions.has_type('public', 'enquiry_status', 'enquiry status enum exists');

select extensions.col_is_pk('public', 'properties', 'id', 'properties has a primary key');
select extensions.has_column('public', 'properties', 'published_revision_id', 'stable property points to a published revision');
select extensions.has_column('public', 'property_revisions', 'replaces_revision_id', 'revisions link to replaced revision');
select extensions.has_column('public', 'enquiries', 'property_revision_id_at_submission', 'enquiry records viewed revision');
select extensions.has_column('public', 'properties', 'retention_not_before', 'properties have retention guard');
select extensions.has_column('public', 'property_revisions', 'submitted_at', 'revisions track submission');
select extensions.has_column('public', 'property_revisions', 'approved_at', 'revisions track approval');
select extensions.has_column('public', 'property_revisions', 'published_at', 'revisions track publication');
select extensions.has_column('public', 'enquiries', 'closed_at', 'enquiries track closure');
select extensions.has_index('public', 'property_revisions', 'property_revisions_location_idx', 'revision location has a GiST index');
select extensions.has_index('public', 'property_revisions', 'property_revisions_one_working_idx', 'only one working revision is indexed');
select extensions.has_index('public', 'property_revisions', 'property_revisions_filter_idx', 'public filter fields are indexed');
select extensions.has_index('public', 'property_images', 'property_images_revision_idx', 'revision images are indexed');
select extensions.has_index('public', 'enquiries', 'enquiries_property_idx', 'property enquiries are indexed');
select extensions.has_index('public', 'listing_approvals', 'listing_approvals_revision_idx', 'revision approvals are indexed');

select extensions.has_fk('public', 'properties', 'properties points to a revision on the same property');
select extensions.has_fk('public', 'property_revisions', 'revisions link within the same property');
select extensions.has_fk('public', 'property_images', 'images reference revisions');
select extensions.has_fk('public', 'enquiries', 'enquiries reference stable properties and viewed revisions');
select extensions.has_fk('public', 'listing_approvals', 'approvals reference properties and revisions');
select extensions.has_fk('public', 'role_audit_log', 'role audit references profiles');

select extensions.has_check('public', 'profiles', 'profile field lengths are constrained');
select extensions.has_check('public', 'properties', 'property slugs are constrained');
select extensions.has_check('public', 'property_revisions', 'revision ranges and states are constrained');
select extensions.has_check('public', 'property_images', 'image metadata is constrained');
select extensions.has_check('public', 'enquiries', 'enquiry fields are constrained');
select extensions.has_check('public', 'listing_approvals', 'approval notes are constrained');
select extensions.has_unique('public', 'properties', 'properties have a stable unique slug');
select extensions.has_unique('public', 'property_revisions', 'revision identity is unique per property');
select extensions.has_unique('public', 'property_images', 'image position is unique per revision');

select extensions.has_trigger('public', 'profiles', 'profiles_set_updated_at', 'profiles update timestamp automatically');
select extensions.has_trigger('public', 'properties', 'properties_set_updated_at', 'properties update timestamp automatically');
select extensions.has_trigger('public', 'property_revisions', 'property_revisions_set_updated_at', 'revisions update timestamp automatically');
select extensions.has_trigger('public', 'enquiries', 'enquiries_set_updated_at', 'enquiries update timestamp automatically');

select extensions.ok(c.relrowsecurity, format('%I has RLS enabled', c.relname))
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles', 'properties', 'property_revisions', 'property_images',
    'enquiries', 'listing_approvals', 'role_audit_log', 'legal_holds',
    'retention_audit_log'
  )
order by c.relname;

select * from extensions.finish();
