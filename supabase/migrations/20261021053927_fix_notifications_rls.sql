-- Fix the bell's RLS. Applied to project wovplubneljhoaliqkmk.
-- notifications.user_id holds public.users.id (the notify_* triggers copy it from
-- positions / recharge_orders / withdrawals), not the Supabase Auth id, so the
-- original auth.uid() = user_id policies never matched a member's rows: empty
-- bell, markAllRead updated nothing, realtime INSERTs were filtered out.
-- Match the other member tables: authenticated only, keyed on current_app_user_id().
-- The notify_* triggers are SECURITY DEFINER (owner postgres, bypasses RLS), so
-- these policies don't affect them. No admin policy: the admin panel never reads
-- this table.

drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
    for select to authenticated
    using (user_id = public.current_app_user_id());

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
    for update to authenticated
    using (user_id = public.current_app_user_id())
    with check (user_id = public.current_app_user_id());

drop policy if exists notif_insert_own on public.notifications;
create policy notif_insert_own on public.notifications
    for insert to authenticated
    with check (user_id = public.current_app_user_id());

-- Last member table anon could still read or write.
revoke all on public.notifications from anon;
