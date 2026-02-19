create policy gyms_delete_owner
on public.gyms for delete to authenticated
using (owner_user_id = auth.uid());
