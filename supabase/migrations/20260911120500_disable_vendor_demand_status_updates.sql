-- Vendor demand is automated. Preserve historical status values, but prevent
-- clients from creating or operating a manual status workflow.

drop policy if exists "Users can update their vendor sourcing requests" on public.vendor_sourcing_requests;
revoke update on public.vendor_sourcing_requests from authenticated;