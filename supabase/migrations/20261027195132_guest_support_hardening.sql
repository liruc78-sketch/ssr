-- Guest support chat, hardened after review. Applied to project wovplubneljhoaliqkmk
-- (follows guest_support_chat).
-- * Messages moved into an account by claim_guest_support are marked from_guest: the
--   person who wrote them before signing in was never verified. Members can't set it.
-- * guest_support_send serializes its limit counts (they see only committed rows, so
--   parallel requests with fresh keys all passed), refuses a new guest before creating
--   anything, and reports the new-conversation limits as 'busy', not 'rate_limited'.
--   The site-wide cap is a circuit breaker (120 per 10 minutes), not a switch any
--   small group of addresses can hold down.
-- * claim_guest_support locks the guest row, so an admin reply sent during a claim is
--   either moved with the rest or refused (23503) — never cascade-deleted.

alter table public.support_messages add column if not exists from_guest boolean not null default false;
alter policy support_messages_insert_own on public.support_messages
    with check (user_id = public.current_app_user_id() and sender = 'user' and not from_guest);

-- { ok, message } or { ok: false, error: bad_key | empty | too_long | busy | rate_limited }.
-- busy: no new conversation now (3 per address an hour, 120 site-wide per 10 minutes).
-- rate_limited: 20 messages per guest or 40 per address per 10 minutes.
create or replace function public.guest_support_send(p_key text, p_content text, p_locale text default null)
returns json language plpgsql security definer set search_path = '' as $$
declare
    v_hash text := public.guest_key_hash(p_key);
    v_ip   text := public.request_ip_hash();
    v_text text := btrim(coalesce(p_content, ''));
    v_uid  uuid;
    v_msg  public.support_messages;
begin
    if v_hash is null then return json_build_object('ok', false, 'error', 'bad_key'); end if;
    if v_text = '' then return json_build_object('ok', false, 'error', 'empty'); end if;
    if length(v_text) > 2000 then return json_build_object('ok', false, 'error', 'too_long'); end if;

    -- The counts below see only committed rows, so serialize them. Lock order is
    -- always key, then address, then (new guests only) site-wide.
    perform pg_advisory_xact_lock(hashtextextended('guest_support:' || v_hash, 0));
    if v_ip is not null then
        perform pg_advisory_xact_lock(hashtextextended('guest_support_ip:' || v_ip, 0));
    end if;
    select id into v_uid from public.users where guest_key_hash = v_hash;
    if v_uid is null then
        perform pg_advisory_xact_lock(hashtextextended('guest_support_new', 0));
        if (v_ip is not null and (select count(*) from public.support_guest_events
                                   where ip_hash = v_ip and kind = 'new' and created_at > now() - interval '1 hour') >= 3)
           or (select count(*) from public.support_guest_events
                where kind = 'new' and created_at > now() - interval '10 minutes') >= 120 then
            return json_build_object('ok', false, 'error', 'busy');
        end if;
    end if;
    -- Checked before a new guest is created, so a refusal leaves nothing behind.
    if (v_uid is not null and (select count(*) from public.support_messages
                                where user_id = v_uid and sender = 'user' and created_at > now() - interval '10 minutes') >= 20)
       or (v_ip is not null and (select count(*) from public.support_guest_events
                                  where ip_hash = v_ip and kind = 'msg' and created_at > now() - interval '10 minutes') >= 40) then
        return json_build_object('ok', false, 'error', 'rate_limited');
    end if;

    if v_uid is null then
        -- Shown in the admin panel's chat list: '访客 <6 hex> (<UI language>)'.
        insert into public.users (is_guest, guest_key_hash, display_name)
        values (true, v_hash, '访客 ' || substr(v_hash, 1, 6)
                || case when p_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$' then ' (' || p_locale || ')' else '' end)
        returning id into v_uid;
        insert into public.support_guest_events (ip_hash, kind) values (v_ip, 'new');
        delete from public.support_guest_events where created_at < now() - interval '1 day';
    end if;
    insert into public.support_messages (user_id, sender, content) values (v_uid, 'user', v_text) returning * into v_msg;
    insert into public.support_guest_events (ip_hash, kind) values (v_ip, 'msg');
    return json_build_object('ok', true, 'message', json_build_object(
        'id', v_msg.id, 'sender', v_msg.sender, 'content', v_msg.content, 'created_at', v_msg.created_at));
end;
$$;

-- The client calls this only after the member's own sign-in in that tab, and only
-- once they confirm the chat is theirs (js/support.js offerGuestChat).
create or replace function public.claim_guest_support(p_key text)
returns json language plpgsql security definer set search_path = '' as $$
declare
    v_me    uuid := public.current_app_user_id();
    v_hash  text := public.guest_key_hash(p_key);
    v_guest uuid;
    v_moved int := 0;
    g       public.support_conversations;
begin
    if v_me is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
    if v_hash is null then return json_build_object('ok', true, 'moved', 0); end if;
    perform pg_advisory_xact_lock(hashtextextended('guest_support:' || v_hash, 0));
    -- FOR UPDATE: a concurrent admin reply (its FK check takes KEY SHARE) either
    -- commits first and is moved below, or waits and fails once the row is gone.
    select id into v_guest from public.users where guest_key_hash = v_hash and is_guest for update;
    if v_guest is null then return json_build_object('ok', true, 'moved', 0); end if;

    update public.support_messages set user_id = v_me, from_guest = true where user_id = v_guest;
    get diagnostics v_moved = row_count;
    delete from public.support_conversations where user_id = v_guest returning * into g;
    if found then
        insert into public.support_conversations as c
               (user_id, last_message, last_sender, last_message_at, unread_admin, unread_user, created_at)
        values (v_me, g.last_message, g.last_sender, g.last_message_at, g.unread_admin, g.unread_user, g.created_at)
        on conflict (user_id) do update set
            unread_admin    = c.unread_admin + excluded.unread_admin,
            unread_user     = c.unread_user + excluded.unread_user,
            last_message    = case when excluded.last_message_at > c.last_message_at then excluded.last_message else c.last_message end,
            last_sender     = case when excluded.last_message_at > c.last_message_at then excluded.last_sender else c.last_sender end,
            last_message_at = greatest(c.last_message_at, excluded.last_message_at);
    end if;
    delete from public.users where id = v_guest;
    return json_build_object('ok', true, 'moved', v_moved);
end;
$$;
