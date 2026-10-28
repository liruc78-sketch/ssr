-- Advisor lint 0028 (anon_security_definer_function_executable). Applied to project
-- wovplubneljhoaliqkmk. These SECURITY DEFINER functions predate the per-function grants
-- of later migrations, so they kept Postgres' default EXECUTE for PUBLIC plus Supabase's
-- default grants to anon and authenticated: anyone with the public anon key could call
-- them through /rest/v1/rpc/<name>. None of them is meant for anon:
-- * create_recharge_order, request_withdrawal, finance_subscribe, finance_redeem: the SPA
--   calls them only for a signed-in member (js/wallet.js, js/finance.js); anon only ever
--   got 'Please sign in' back. Members keep EXECUTE.
-- * is_admin(), current_app_user_id(): used by RLS policies that all apply TO authenticated
--   (public tables and storage.objects), and inside SECURITY DEFINER functions, which run
--   as their owner. No anon policy, column default, view or cron job uses them.
--   authenticated keeps EXECUTE, because those policies run as the caller.
-- * notify_* and handle_new_support_message only run as triggers. Postgres checks EXECUTE
--   on a trigger function at CREATE TRIGGER, not when it fires, so authenticated loses it
--   too: members' and the admin panel's writes still fire them.
-- guest_support_send / guest_support_messages stay executable by anon (the guest chat).
-- CREATE OR REPLACE FUNCTION keeps these grants; DROP + CREATE would bring back the defaults.

revoke execute on function public.create_recharge_order(text, text, text, text, numeric, numeric) from public, anon;
grant execute on function public.create_recharge_order(text, text, text, text, numeric, numeric) to authenticated;
revoke execute on function public.request_withdrawal(numeric, text) from public, anon;
grant execute on function public.request_withdrawal(numeric, text) to authenticated;
revoke execute on function public.finance_subscribe(text, text, text, numeric, numeric, integer) from public, anon;
grant execute on function public.finance_subscribe(text, text, text, numeric, numeric, integer) to authenticated;
revoke execute on function public.finance_redeem(uuid) from public, anon;
grant execute on function public.finance_redeem(uuid) to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.current_app_user_id() from public, anon;
grant execute on function public.current_app_user_id() to authenticated;

revoke execute on function public.notify_position_settle() from public, anon, authenticated;
revoke execute on function public.notify_recharge_update() from public, anon, authenticated;
revoke execute on function public.notify_withdrawal_insert() from public, anon, authenticated;
revoke execute on function public.notify_withdrawal_update() from public, anon, authenticated;
revoke execute on function public.handle_new_support_message() from public, anon, authenticated;
