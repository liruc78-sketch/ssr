-- ============================================================================
-- Crypto.ssr — throttle the server-side settle sweep (pg_cron job 1)
-- APPLIED 2026-10-08 to project `wovplubneljhoaliqkmk` as migration `throttle_settle_sweep_cron`.
--
-- The job called the trade-settle edge function every 30 s even with nothing to
-- settle (~2,900 invocations/day, each adding gateway + function logs — the main
-- driver of the Free-plan "Log Ingestion" quota). Now it runs every minute and only
-- calls the function when an Active position has actually reached its expiry.
-- Open browser tabs still settle their own expired trades within ~15 s.
-- ============================================================================
select cron.alter_job(
  job_id   := (select jobid from cron.job where jobname = 'settle-expired-positions'),
  schedule := '* * * * *',
  command  := $cmd$
  select net.http_post(
    url     := 'https://wovplubneljhoaliqkmk.supabase.co/functions/v1/trade-settle',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'apikey', '<anon key — public, same as js/supabase.js>'
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  where exists (
    select 1 from public.positions
    where status = 'Active'
      and created_at + make_interval(secs => coalesce(duration_seconds, 0)) <= now()
  );
  $cmd$
);
