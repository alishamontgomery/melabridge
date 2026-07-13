
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  href text,
  icon text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notifications read"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own notifications update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own notifications delete"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service role manages notifications"
  ON public.notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.notify_message_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  convo record;
  participant_id uuid;
  preview text;
BEGIN
  SELECT id, title, type, owner_id INTO convo
  FROM public.conversations WHERE id = NEW.conversation_id;

  preview := COALESCE(LEFT(NEW.body, 140), '');

  FOR participant_id IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
    UNION
    SELECT convo.owner_id WHERE convo.owner_id IS NOT NULL AND convo.owner_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, category, title, body, href, entity_type, entity_id)
    VALUES (
      participant_id,
      'messages',
      COALESCE(convo.title, 'New message'),
      preview,
      '/messaging',
      'conversation',
      NEW.conversation_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_participants ON public.messages;
CREATE TRIGGER trg_notify_message_participants
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_participants();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
