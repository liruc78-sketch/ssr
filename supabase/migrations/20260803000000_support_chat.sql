-- ════════════════════════════════════════════════════════════════
--  客服通道 / Customer-service live chat
--  Run this once in the Supabase SQL Editor (project wovplubneljhoaliqkmk).
--  Safe to re-run: every statement is idempotent.
-- ════════════════════════════════════════════════════════════════

-- ── 每个用户一条会话记录（后台会话列表 + 未读数） ──
CREATE TABLE IF NOT EXISTS support_conversations (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_message    text,
  last_sender     text,                       -- 'user' | 'admin'
  last_message_at timestamptz DEFAULT now(),
  unread_admin    integer NOT NULL DEFAULT 0, -- 用户发来、管理员未读
  unread_user     integer NOT NULL DEFAULT 0, -- 管理员发来、用户未读
  created_at      timestamptz DEFAULT now()
);

-- ── 聊天消息 ──
CREATE TABLE IF NOT EXISTS support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender     text NOT NULL CHECK (sender IN ('user','admin')),
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_created
  ON support_messages (user_id, created_at);

-- ── 权限：沿用本项目现有的 admin_all 开放策略（anon key 直连） ──
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all" ON support_conversations;
CREATE POLICY "admin_all" ON support_conversations USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all" ON support_messages;
CREATE POLICY "admin_all" ON support_messages USING (true) WITH CHECK (true);

-- ── 触发器：每收到一条消息就刷新会话摘要与未读计数 ──
CREATE OR REPLACE FUNCTION handle_new_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO support_conversations
    (user_id, last_message, last_sender, last_message_at, unread_admin, unread_user)
  VALUES (
    NEW.user_id, NEW.content, NEW.sender, NEW.created_at,
    CASE WHEN NEW.sender = 'user'  THEN 1 ELSE 0 END,
    CASE WHEN NEW.sender = 'admin' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    last_message    = NEW.content,
    last_sender     = NEW.sender,
    last_message_at = NEW.created_at,
    unread_admin    = support_conversations.unread_admin + (CASE WHEN NEW.sender = 'user'  THEN 1 ELSE 0 END),
    unread_user     = support_conversations.unread_user  + (CASE WHEN NEW.sender = 'admin' THEN 1 ELSE 0 END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_support_message ON support_messages;
CREATE TRIGGER trg_new_support_message
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_support_message();

-- ── 开启 Realtime（前端/后台实时收发消息） ──
-- UPDATE 事件需要完整旧行，才能实时刷新会话列表的未读数。
ALTER TABLE support_conversations REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
