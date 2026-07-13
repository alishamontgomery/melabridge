
-- =========================
-- Conversations
-- =========================
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  type text NOT NULL DEFAULT 'internal' CHECK (type IN ('internal','vendor','guest','payment','system')),
  is_pinned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  deleted_at timestamptz,
  labels text[] NOT NULL DEFAULT '{}',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Security-definer participant check to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = _conv AND c.owner_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.conversation_participants p WHERE p.conversation_id = _conv AND p.user_id = _user
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;

CREATE POLICY "conv: participants can read"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));
CREATE POLICY "conv: owner can insert"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "conv: owner can update"
  ON public.conversations FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "conv: owner can delete"
  ON public.conversations FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "cp: participants can read"
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "cp: owner manages"
  ON public.conversation_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.owner_id = auth.uid()));

-- =========================
-- Messages
-- =========================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read')),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg: participants can read"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "msg: participants can insert"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "msg: sender can update"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY "msg: sender can delete"
  ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_owner ON public.conversations(owner_id, last_message_at DESC);

-- =========================
-- Templates
-- =========================
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = global/seeded
  category text NOT NULL DEFAULT 'guest',
  title text NOT NULL,
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  is_favorite boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  tone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpl: read global or own"
  ON public.message_templates FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());
CREATE POLICY "tpl: insert own"
  ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tpl: update own"
  ON public.message_templates FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tpl: delete own"
  ON public.message_templates FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  edited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.message_template_versions TO authenticated;
GRANT ALL ON public.message_template_versions TO service_role;
ALTER TABLE public.message_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tplv: read own"
  ON public.message_template_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_templates t WHERE t.id = template_id AND (t.owner_id = auth.uid() OR t.owner_id IS NULL)));
CREATE POLICY "tplv: insert own"
  ON public.message_template_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.message_templates t WHERE t.id = template_id AND t.owner_id = auth.uid()));

-- =========================
-- Extend notification_preferences
-- =========================
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'messages',
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'instant' CHECK (frequency IN ('instant','hourly','daily','weekly','off')),
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_app_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS calendar_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start time,
  ADD COLUMN IF NOT EXISTS quiet_hours_end time,
  ADD COLUMN IF NOT EXISTS event_id uuid;

-- =========================
-- Triggers
-- =========================
CREATE TRIGGER trg_conversations_updated BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Seed 80+ global templates
-- =========================
INSERT INTO public.message_templates (owner_id, category, title, body, variables, tone) VALUES
-- Guest (14)
(NULL,'guest','RSVP reminder — 30 days','Hi {name}, just a friendly reminder our RSVP window closes in 30 days. Tap your invite link to confirm — can''t wait to celebrate with you!',ARRAY['name'],'friendly'),
(NULL,'guest','RSVP reminder — 7 days','Hi {name}, RSVPs close in one week. If you haven''t already, please confirm at {rsvp_link}.',ARRAY['name','rsvp_link'],'friendly'),
(NULL,'guest','RSVP final call — 48 hours','Hi {name}, final call for RSVPs — we close the guest list in 48 hours. Confirm here: {rsvp_link}.',ARRAY['name','rsvp_link'],'urgent'),
(NULL,'guest','Save-the-date','Save the date! {couple} are getting married on {date} in {city}. Formal invitation to follow.',ARRAY['couple','date','city'],'friendly'),
(NULL,'guest','Dietary preference check','Hi {name}, we want your meal to be perfect. Any dietary preferences or allergies we should know about?',ARRAY['name'],'friendly'),
(NULL,'guest','Plus-one confirmation','Hi {name}, could you share your plus-one''s full name so we can print place cards? Thank you!',ARRAY['name'],'friendly'),
(NULL,'guest','Kids policy note','Hi {name}, our celebration is adults-only. We''ve set aside a list of trusted local sitters if that helps — just let us know.',ARRAY['name'],'professional'),
(NULL,'guest','Travel details','Hi {name}, your travel packet: hotel block {hotel}, arrival window {arrival}, transfer info attached. Reply if anything looks off.',ARRAY['name','hotel','arrival'],'professional'),
(NULL,'guest','Hotel room block','Hi {name}, we''ve reserved a room block at {hotel}. Use code {code} before {cutoff} for our rate.',ARRAY['name','hotel','code','cutoff'],'professional'),
(NULL,'guest','Weekend itinerary','Hi {name}, here''s the full weekend at a glance: welcome dinner Friday, ceremony Saturday, farewell brunch Sunday. Full timeline attached.',ARRAY['name'],'friendly'),
(NULL,'guest','Ceremony dress code','Hi {name}, quick note on dress code: {dress_code}. Can''t wait to see you.',ARRAY['name','dress_code'],'friendly'),
(NULL,'guest','Ceremony timing update','Hi {name}, small timing update — ceremony now begins at {time}. Everything else on the itinerary stays the same.',ARRAY['name','time'],'professional'),
(NULL,'guest','Post-event thank you','Thank you so much for celebrating with us — it truly wouldn''t have been the same without you.',ARRAY[]::text[],'friendly'),
(NULL,'guest','Registry acknowledgement','Thank you {name} for the thoughtful gift — we''re so grateful for you.',ARRAY['name'],'friendly'),

-- Vendor (14)
(NULL,'vendor','Deposit invoice','Hi {vendor}, attaching the deposit invoice for our {event_date} event. Due by {due_date}. Let me know if you need anything else.',ARRAY['vendor','event_date','due_date'],'professional'),
(NULL,'vendor','Deposit reminder','Hi {vendor}, friendly reminder the deposit is due {due_date}. Happy to resend the invoice if useful.',ARRAY['vendor','due_date'],'professional'),
(NULL,'vendor','Contract sent','Hi {vendor}, contract is attached — please review and countersign at your convenience. Any redlines welcome.',ARRAY['vendor'],'professional'),
(NULL,'vendor','Contract follow-up','Hi {vendor}, checking in on the contract. Do you have any questions before signing?',ARRAY['vendor'],'professional'),
(NULL,'vendor','Timeline draft','Hi {vendor}, first draft of the day-of timeline attached. Please review your service window and flag anything that needs to move.',ARRAY['vendor'],'professional'),
(NULL,'vendor','Final walkthrough','Hi {vendor}, scheduling our final walkthrough for {date} at {time}. Please confirm.',ARRAY['vendor','date','time'],'professional'),
(NULL,'vendor','Load-in details','Hi {vendor}, load-in details for {event_date}: doors open {load_in}, service entry at {entry}. Contact on site: {coordinator}.',ARRAY['vendor','event_date','load_in','entry','coordinator'],'professional'),
(NULL,'vendor','COI request','Hi {vendor}, could you send a certificate of insurance naming {venue} as additional insured? Venue requires it by {due_date}.',ARRAY['vendor','venue','due_date'],'professional'),
(NULL,'vendor','Final headcount','Hi {vendor}, our final headcount is {headcount}. Please confirm receipt.',ARRAY['vendor','headcount'],'professional'),
(NULL,'vendor','Menu tasting scheduling','Hi {vendor}, could we book a tasting the week of {week}? Any afternoon works.',ARRAY['vendor','week'],'friendly'),
(NULL,'vendor','Final payment','Hi {vendor}, final payment sent today — thank you for everything you''re doing to make this special.',ARRAY['vendor'],'friendly'),
(NULL,'vendor','Post-event thank you','Thank you for making {event_date} unforgettable. Reviews on the way.',ARRAY['vendor','event_date'],'friendly'),
(NULL,'vendor','Review request','Hi {vendor}, would love to leave you a review — is there a preferred platform?',ARRAY['vendor'],'friendly'),
(NULL,'vendor','Referral introduction','Hi {vendor}, introducing {friend} who''s planning their {event_type}. I couldn''t recommend you more.',ARRAY['vendor','friend','event_type'],'friendly'),

-- Payment (8)
(NULL,'payment','Invoice sent','Hi {name}, invoice #{invoice} for {amount} is attached. Due {due_date}.',ARRAY['name','invoice','amount','due_date'],'professional'),
(NULL,'payment','Payment received','Hi {name}, confirming receipt of {amount} on {date}. Receipt attached.',ARRAY['name','amount','date'],'professional'),
(NULL,'payment','Past-due gentle nudge','Hi {name}, checking in on invoice #{invoice} — showing past due. Any issues on your end?',ARRAY['name','invoice'],'professional'),
(NULL,'payment','Past-due firm','Hi {name}, invoice #{invoice} is now {days} days past due. Please remit by {due_date} to avoid late fees.',ARRAY['name','invoice','days','due_date'],'urgent'),
(NULL,'payment','Payment plan proposal','Hi {name}, happy to split the balance into {installments} installments. Let me know if that works.',ARRAY['name','installments'],'professional'),
(NULL,'payment','Refund confirmation','Hi {name}, refund of {amount} processed today. Please allow 5–7 business days.',ARRAY['name','amount'],'professional'),
(NULL,'payment','Deposit received','Hi {name}, deposit received — you''re officially on the calendar for {event_date}.',ARRAY['name','event_date'],'friendly'),
(NULL,'payment','Change order','Hi {name}, change order attached reflecting the recent updates. New balance due: {amount}.',ARRAY['name','amount'],'professional'),

-- Internal (10)
(NULL,'internal','Weekly sync agenda','Team, agenda for {date}: 1) status by event 2) blockers 3) upcoming week. Add anything under AOB.',ARRAY['date'],'professional'),
(NULL,'internal','Decision needed','Team, need a call on {topic} by {deadline}. Context in thread.',ARRAY['topic','deadline'],'urgent'),
(NULL,'internal','Handoff','Handing off {event} to {owner}. Full brief in shared drive; ping me anytime.',ARRAY['event','owner'],'professional'),
(NULL,'internal','On-call rotation','You''re on-call for {event} from {start} to {end}. Emergency line: {phone}.',ARRAY['event','start','end','phone'],'professional'),
(NULL,'internal','Kudos','Huge shout-out to {name} for {reason}. Truly appreciated.',ARRAY['name','reason'],'friendly'),
(NULL,'internal','Post-mortem invite','Post-mortem for {event} on {date}. Come with wins, misses, and one thing to change.',ARRAY['event','date'],'professional'),
(NULL,'internal','Client escalation','Escalation on {event}: {issue}. Owning it — will update by {deadline}.',ARRAY['event','issue','deadline'],'urgent'),
(NULL,'internal','Weekend coverage','Need weekend coverage for {event}. Reply if you can cover any slot.',ARRAY['event'],'professional'),
(NULL,'internal','New team member','Welcome {name} — joining as {role}. Please make them feel at home.',ARRAY['name','role'],'friendly'),
(NULL,'internal','Sprint review','Sprint review Friday {time}. Bring demos, blockers, and priorities for next sprint.',ARRAY['time'],'professional'),

-- Timeline (6)
(NULL,'timeline','Timeline draft — planners','Attaching v1 of the day-of timeline. Review by {deadline} please.',ARRAY['deadline'],'professional'),
(NULL,'timeline','Timeline update','Timeline updated — key changes: {changes}. Latest version attached.',ARRAY['changes'],'professional'),
(NULL,'timeline','Rehearsal reminder','Rehearsal is {date} at {time}, {location}. Please arrive 10 minutes early.',ARRAY['date','time','location'],'friendly'),
(NULL,'timeline','Ceremony order','Ceremony order attached. Processional begins promptly at {time}.',ARRAY['time'],'professional'),
(NULL,'timeline','Reception flow','Reception flow: cocktail {time1}, seated dinner {time2}, first dance {time3}, cake {time4}.',ARRAY['time1','time2','time3','time4'],'professional'),
(NULL,'timeline','Wrap and load-out','Wrap begins {time}. Load-out complete by {end}. Contact on site: {coordinator}.',ARRAY['time','end','coordinator'],'professional'),

-- RSVP (4)
(NULL,'rsvp','RSVP confirmed','Thanks {name} — RSVP confirmed for {count}. Full details will follow closer to the date.',ARRAY['name','count'],'friendly'),
(NULL,'rsvp','RSVP declined ack','Thanks for letting us know, {name}. We''ll miss you and hope to celebrate together another time.',ARRAY['name'],'friendly'),
(NULL,'rsvp','RSVP change request','Hi {name}, we received your RSVP change to {count}. Confirming this is correct?',ARRAY['name','count'],'professional'),
(NULL,'rsvp','Waitlist offer','Hi {name}, a spot opened up — would you still like to join us on {date}?',ARRAY['name','date'],'friendly'),

-- Thank you (4)
(NULL,'thank_you','Guest thank you','Thank you {name} for celebrating with us. Your presence meant the world.',ARRAY['name'],'friendly'),
(NULL,'thank_you','Vendor thank you','Thank you {vendor} — your work was flawless. We''re still hearing from guests about it.',ARRAY['vendor'],'friendly'),
(NULL,'thank_you','Team thank you','Team — that was a masterclass. Thank you for the care and craft.',ARRAY[]::text[],'friendly'),
(NULL,'thank_you','Client thank you','Thank you for trusting us with {event}. It was an honor.',ARRAY['event'],'friendly'),

-- Emergency (6)
(NULL,'emergency','Weather advisory','Weather advisory for {date}: {details}. Backup plan attached — please confirm receipt.',ARRAY['date','details'],'urgent'),
(NULL,'emergency','Venue change','Important: venue change for {event}. New location: {venue}, same start time. Reply to confirm.',ARRAY['event','venue'],'urgent'),
(NULL,'emergency','Time change','Time change for {event}: now {time}. Please update calendars.',ARRAY['event','time'],'urgent'),
(NULL,'emergency','Vendor no-show','Backup plan in effect for {vendor} no-show. {solution} — I''ll update within the hour.',ARRAY['vendor','solution'],'urgent'),
(NULL,'emergency','Health notice','Small health notice for {event}: {details}. Precautions in place.',ARRAY['event','details'],'urgent'),
(NULL,'emergency','Postponement','With care and after much thought, {event} is being postponed. New date TBD; we''ll be in touch within {timeframe}.',ARRAY['event','timeframe'],'professional'),

-- Contracts (4)
(NULL,'contracts','Contract review','Hi {name}, contract attached — please review and share any redlines by {deadline}.',ARRAY['name','deadline'],'professional'),
(NULL,'contracts','Contract signed','Hi {name}, countersigned contract attached. Officially official.',ARRAY['name'],'professional'),
(NULL,'contracts','Amendment sent','Hi {name}, amendment reflecting {changes} attached. Please sign at your convenience.',ARRAY['name','changes'],'professional'),
(NULL,'contracts','Contract expiring','Hi {name}, contract expires {date}. Let''s discuss renewal.',ARRAY['name','date'],'professional'),

-- Travel (4)
(NULL,'travel','Flight details request','Hi {name}, share your flight details so we can arrange transfers.',ARRAY['name'],'professional'),
(NULL,'travel','Transfer schedule','Hi {name}, your transfer: {vehicle} at {time} from {pickup}. Driver: {driver}.',ARRAY['name','vehicle','time','pickup','driver'],'professional'),
(NULL,'travel','Airport pickup change','Hi {name}, pickup time moved to {time} due to traffic. Same driver.',ARRAY['name','time'],'professional'),
(NULL,'travel','Welcome bag delivered','Hi {name}, welcome bag is at the front desk under your name. Enjoy!',ARRAY['name'],'friendly'),

-- Announcements (4)
(NULL,'announcements','Event announcement','Excited to share {event} on {date} at {venue}. Details to follow.',ARRAY['event','date','venue'],'friendly'),
(NULL,'announcements','New feature announcement','New in your planner: {feature}. Try it in your dashboard.',ARRAY['feature'],'professional'),
(NULL,'announcements','Team announcement','Team update: {news}.',ARRAY['news'],'professional'),
(NULL,'announcements','Public announcement','We''re thrilled to share {news}. Thank you for being part of this journey.',ARRAY['news'],'friendly'),

-- Marketing (4)
(NULL,'marketing','Booking window opening','Booking for {season} events opens {date}. Early birds get first pick.',ARRAY['season','date'],'friendly'),
(NULL,'marketing','Case study share','Case study on {event}: how we brought {vision} to life. Link inside.',ARRAY['event','vision'],'professional'),
(NULL,'marketing','Referral program','Refer a couple, earn {reward}. Details attached.',ARRAY['reward'],'friendly'),
(NULL,'marketing','Testimonial request','Hi {name}, would you share a short testimonial about your experience?',ARRAY['name'],'friendly')
;
