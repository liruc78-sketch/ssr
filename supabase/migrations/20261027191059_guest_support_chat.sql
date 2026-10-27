-- Support chat for visitors who aren't signed in. Applied to project wovplubneljhoaliqkmk.
-- A guest is a users row without a login (is_guest), so the support tables and the
-- admin panel's chat, which key every conversation on users.id, work unchanged.
-- The browser keeps a random 256-bit key; the guest_support_* functions (callable
-- by anon) find the conversation by its SHA-256, so the key itself is never stored.
-- Signing in moves the guest's conversation into the account (claim_guest_support).
-- Guests get no realtime (anon has no table access): the open chat polls.

alter table public.users
    add column if not exists is_guest boolean not null default false,
    add column if not exists guest_key_hash text;
create unique index if not exists users_guest_key_hash_key on public.users (guest_key_hash);
-- A guest row carries nothing but its key hash; a real account never has one.
alter table public.users drop constraint if exists users_guest_shape;
alter table public.users add constraint users_guest_shape check (
    is_guest = (guest_key_hash is not null)
    and (not is_guest or (auth_id is null and wallet_address is null and email is null and phone is null and not is_admin)));

-- Recent guest activity per (hashed) client address, for the spam limits below.
-- RLS on and no grants: only the functions here touch it.
create table if not exists public.support_guest_events (
    ip_hash    text,
    kind       text not null check (kind in ('new', 'msg')),
    created_at timestamptz not null default now()
);
create index if not exists support_guest_events_ip_idx on public.support_guest_events (ip_hash, kind, created_at);
create index if not exists support_guest_events_kind_idx on public.support_guest_events (kind, created_at);
alter table public.support_guest_events enable row level security;
revoke all on public.support_guest_events from anon, authenticated;

-- SHA-256 of the browser's guest key (64 lowercase hex characters); NULL for anything else.
create or replace function public.guest_key_hash(p_key text)
returns text language sql immutable set search_path = '' as $$
    select case when p_key ~ '^[0-9a-f]{64}$' then encode(sha256(convert_to(p_key, 'UTF8')), 'hex') end
$$;
revoke execute on function public.guest_key_hash(text) from public, anon, authenticated;

-- SHA-256 of the caller's address as Cloudflare reports it (the first X-Forwarded-For
-- hop as a fallback); NULL outside an API request, which skips the per-address limits.
-- (A custom setting reads as '' once a transaction that set it has ended.)
create or replace function public.request_ip_hash()
returns text language sql stable set search_path = '' as $$
    select encode(sha256(convert_to(ip, 'UTF8')), 'hex')
      from (select coalesce(nullif(btrim(h ->> 'cf-connecting-ip'), ''),
                            nullif(btrim(split_part(h ->> 'x-forwarded-for', ',', 1)), '')) as ip
              from (select nullif(current_setting('request.headers', true), '')::json as h) s) r
     where ip is not null
$$;
revoke execute on function public.request_ip_hash() from public, anon, authenticated;

-- Send a guest message: { ok, message } or { ok: false, error: bad_key | empty |
-- too_long | rate_limited }. The first message creates the guest. Limits: 3 new
-- guests per address an hour and 30 site-wide per 10 minutes; 20 messages per
-- guest and 40 per address per 10 minutes.
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

    perform pg_advisory_xact_lock(hashtextextended('guest_support:' || v_hash, 0));
    select id into v_uid from public.users where guest_key_hash = v_hash;
    if v_uid is null then
        if (v_ip is not null and (select count(*) from public.support_guest_events
                                   where ip_hash = v_ip and kind = 'new' and created_at > now() - interval '1 hour') >= 3)
           or (select count(*) from public.support_guest_events
                where kind = 'new' and created_at > now() - interval '10 minutes') >= 30 then
            return json_build_object('ok', false, 'error', 'rate_limited');
        end if;
        -- Shown in the admin panel's chat list: '访客 <6 hex> (<UI language>)'.
        insert into public.users (is_guest, guest_key_hash, display_name)
        values (true, v_hash, '访客 ' || substr(v_hash, 1, 6)
                || case when p_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$' then ' (' || p_locale || ')' else '' end)
        returning id into v_uid;
        insert into public.support_guest_events (ip_hash, kind) values (v_ip, 'new');
        delete from public.support_guest_events where created_at < now() - interval '1 day';
    end if;

    if (select count(*) from public.support_messages
         where user_id = v_uid and sender = 'user' and created_at > now() - interval '10 minutes') >= 20
       or (v_ip is not null and (select count(*) from public.support_guest_events
                                  where ip_hash = v_ip and kind = 'msg' and created_at > now() - interval '10 minutes') >= 40) then
        return json_build_object('ok', false, 'error', 'rate_limited');
    end if;
    insert into public.support_messages (user_id, sender, content) values (v_uid, 'user', v_text) returning * into v_msg;
    insert into public.support_guest_events (ip_hash, kind) values (v_ip, 'msg');
    return json_build_object('ok', true, 'message', json_build_object(
        'id', v_msg.id, 'sender', v_msg.sender, 'content', v_msg.content, 'created_at', v_msg.created_at));
end;
$$;
revoke execute on function public.guest_support_send(text, text, text) from public;
grant execute on function public.guest_support_send(text, text, text) to anon, authenticated;

-- A guest's conversation (newest 200 messages, oldest first) and its unread count:
-- { ok, messages, unread }. p_mark_read (the chat is open) clears the count.
create or replace function public.guest_support_messages(p_key text, p_mark_read boolean default true)
returns json language plpgsql security definer set search_path = '' as $$
declare v_hash text := public.guest_key_hash(p_key); v_uid uuid; v_unread int := 0;
begin
    if v_hash is null then return json_build_object('ok', false, 'error', 'bad_key'); end if;
    select id into v_uid from public.users where guest_key_hash = v_hash;
    if v_uid is null then return json_build_object('ok', true, 'messages', '[]'::json, 'unread', 0); end if;
    if p_mark_read then
        update public.support_conversations set unread_user = 0 where user_id = v_uid and unread_user <> 0;
    else
        select coalesce(unread_user, 0) into v_unread from public.support_conversations where user_id = v_uid;
    end if;
    return json_build_object('ok', true, 'unread', coalesce(v_unread, 0), 'messages', coalesce((
        select json_agg(json_build_object('id', m.id, 'sender', m.sender, 'content', m.content, 'created_at', m.created_at)
                        order by m.created_at)
          from (select * from public.support_messages where user_id = v_uid order by created_at desc limit 200) m), '[]'::json));
end;
$$;
revoke execute on function public.guest_support_messages(text, boolean) from public;
grant execute on function public.guest_support_messages(text, boolean) to anon, authenticated;

-- On sign-in: move the guest's messages into the caller's own conversation (merging
-- unread counts and the latest message) and delete the guest. { ok, moved }.
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
    select id into v_guest from public.users where guest_key_hash = v_hash and is_guest;
    if v_guest is null then return json_build_object('ok', true, 'moved', 0); end if;

    update public.support_messages set user_id = v_me where user_id = v_guest;
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
revoke execute on function public.claim_guest_support(text) from public, anon;
grant execute on function public.claim_guest_support(text) to authenticated;
