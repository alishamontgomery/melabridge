
DROP FUNCTION IF EXISTS public.seed_test_data(uuid, uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.seed_test_data(planner_id uuid, vendor_id uuid, admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_draft     uuid := gen_random_uuid();
  event_upcoming  uuid := gen_random_uuid();
  event_completed uuid := gen_random_uuid();
  vendor_convo_id uuid := gen_random_uuid();
BEGIN
  PERFORM public.wipe_test_data();

  UPDATE public.profiles SET is_test_seed = true, account_type = 'personal', display_name = 'Test Planner' WHERE id = planner_id;
  UPDATE public.profiles SET is_test_seed = true, account_type = 'vendor',   display_name = 'Test Vendor'  WHERE id = vendor_id;
  UPDATE public.profiles SET is_test_seed = true,                            display_name = 'Test Admin'   WHERE id = admin_id;

  INSERT INTO public.user_roles (user_id, role) VALUES
    (planner_id, 'personal'),
    (vendor_id,  'vendor'),
    (admin_id,   'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.events (id, owner_id, name, event_type, description, event_date, event_time, location, budget_target, guest_target, status, is_test_seed) VALUES
    (event_draft,     planner_id, 'Priya & Arjun Sangeet',   'Sangeet',      'Draft plan for the sangeet night.', (CURRENT_DATE + 90)::date, '18:00', 'Rosewood Hall, Atlanta GA',   15000, 120, 'draft',     true),
    (event_upcoming,  planner_id, 'The Patel Wedding',       'Wedding',      'Multi-day wedding celebration.',    (CURRENT_DATE + 30)::date, '16:00', 'Grand Palazzo, Miami FL',     85000, 350, 'confirmed', true),
    (event_completed, planner_id, 'Sharma Anniversary Gala', 'Anniversary',  '25th anniversary celebration.',     (CURRENT_DATE - 45)::date, '19:00', 'Ritz Carlton, Chicago IL',    42000, 180, 'completed', true);

  INSERT INTO public.event_members (event_id, user_id, role) VALUES
    (event_upcoming,  planner_id, 'owner'),
    (event_upcoming,  vendor_id,  'editor'),
    (event_completed, planner_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.guests (event_id, full_name, email, phone, household, rsvp_status, plus_ones, meal_choice, is_test_seed) VALUES
    (event_upcoming, 'Rajesh Kumar', 'rajesh.k@example.com', '+1-555-0101', 'Kumar Family',  'yes',     2, 'Vegetarian', true),
    (event_upcoming, 'Anita Sharma', 'anita.s@example.com',  '+1-555-0102', 'Sharma Family', 'yes',     1, 'Vegan',      true),
    (event_upcoming, 'Vikram Singh', 'vikram.s@example.com', '+1-555-0103', 'Singh Family',  'no',      0, NULL,         true),
    (event_upcoming, 'Meera Patel',  'meera.p@example.com',  '+1-555-0104', 'Patel Family',  'maybe',   1, 'Non-Veg',    true),
    (event_upcoming, 'Deepak Iyer',  'deepak.i@example.com', '+1-555-0105', 'Iyer Family',   'yes',     0, 'Vegetarian', true),
    (event_upcoming, 'Kavya Reddy',  'kavya.r@example.com',  '+1-555-0106', 'Reddy Family',  'pending', 0, NULL,         true),
    (event_upcoming, 'Arjun Mehta',  'arjun.m@example.com',  '+1-555-0107', 'Mehta Family',  'yes',     2, 'Non-Veg',    true);

  INSERT INTO public.tasks (event_id, title, description, status, priority, due_date, assigned_to, created_by, is_test_seed) VALUES
    (event_upcoming, 'Finalize catering menu',      'Confirm final menu with Spice Route Caterers.', 'in_progress', 'high',   (CURRENT_DATE+7),  planner_id, planner_id, true),
    (event_upcoming, 'Confirm floral arrangements', 'Sign off on centerpieces and mandap decor.',    'todo',        'medium', (CURRENT_DATE+10), planner_id, planner_id, true),
    (event_upcoming, 'Send save-the-dates',         'All guests confirmed via email.',               'done',        'low',    (CURRENT_DATE-14), planner_id, planner_id, true),
    (event_upcoming, 'Book DJ',                     'Confirm DJ Ravi for reception.',                'todo',        'urgent', (CURRENT_DATE+3),  planner_id, planner_id, true),
    (event_upcoming, 'Order welcome bags',          'Include itinerary and local treats.',           'todo',        'low',    (CURRENT_DATE+21), planner_id, planner_id, true);

  INSERT INTO public.budget_items (event_id, category, label, estimated_amount, actual_amount, paid_amount, vendor_name, created_by, is_test_seed) VALUES
    (event_upcoming, 'Venue',       'Grand Palazzo rental', 25000, 25000, 12500, 'Grand Palazzo',     planner_id, true),
    (event_upcoming, 'Catering',    'Dinner + appetizers',  18000, 17500,  8000, 'Spice Route',       planner_id, true),
    (event_upcoming, 'Florals',     'Mandap + centerpieces', 8000,  7200,     0, 'Bloom & Petal',     planner_id, true),
    (event_upcoming, 'Photography', 'Full-day coverage',    12000, 12000,  6000, 'Lens Story Studio', planner_id, true),
    (event_upcoming, 'Music',       'DJ + live musicians',   7000,     0,     0, NULL,                planner_id, true),
    (event_upcoming, 'Attire',      'Bridal outfits',       15000, 14200, 14200, 'Anokhi Couture',    planner_id, true);

  INSERT INTO public.event_files (event_id, uploaded_by, category, storage_path, filename, mime_type, size_bytes, is_test_seed) VALUES
    (event_upcoming, planner_id, 'contracts', 'test-seed/venue-contract.pdf',   'venue-contract.pdf',   'application/pdf', 245000, true),
    (event_upcoming, planner_id, 'invoices',  'test-seed/catering-invoice.pdf', 'catering-invoice.pdf', 'application/pdf',  85000, true),
    (event_upcoming, planner_id, 'photos',    'test-seed/venue-preview.jpg',    'venue-preview.jpg',    'image/jpeg',      420000, true);

  INSERT INTO public.conversations (id, owner_id, title, type, labels, last_message_at, last_message_preview, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Spice Route — catering thread', 'direct', ARRAY['vendor'], now(), 'Menu locked in — thanks!', true);
  INSERT INTO public.conversation_participants (conversation_id, user_id, participant_role) VALUES
    (vendor_convo_id, planner_id, 'owner'),
    (vendor_convo_id, vendor_id,  'member')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.messages (conversation_id, sender_id, body, attachments, status, is_test_seed) VALUES
    (vendor_convo_id, planner_id, 'Hi, sending over the guest count update — 350 confirmed.', '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, vendor_id,  'Got it. I''ll update the menu proposal today.',            '[]'::jsonb, 'delivered', true),
    (vendor_convo_id, planner_id, 'Menu locked in — thanks!',                                 '[]'::jsonb, 'delivered', true);

  INSERT INTO public.notifications (user_id, category, title, body, href, is_test_seed) VALUES
    (planner_id, 'messages', 'New reply from Spice Route', 'Menu proposal updated.',         '/messaging', true),
    (planner_id, 'team',     'Vendor accepted invite',     'Test Vendor joined your event.', '/events',    true),
    (vendor_id,  'messages', 'New inquiry from Test Planner', 'Wants pricing for 350 guests.', '/messaging',   true),
    (vendor_id,  'payments', 'Deposit received',              '$8,000 deposit from Patel Wedding.', '/subscription', true),
    (admin_id,   'system',   '3 vendor applications pending review', NULL, '/admin',   true),
    (admin_id,   'system',   'Platform activity summary ready',       NULL, '/reports', true);

  INSERT INTO public.subscriptions (user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment, is_test_seed) VALUES
    (planner_id, 'sub_test_seed_planner', 'cus_test_seed_planner', 'prod_test_planner_pro', 'planner_pro_monthly', 'active', now(), now() + interval '30 days', false, 'sandbox', true);

  INSERT INTO public.vendor_profiles (user_id, business_name, business_category, business_description, phone, email, website, city, state, starting_price, years_in_business, accepted_terms, onboarding_completed, is_test_seed)
  VALUES (vendor_id, 'Spice Route Caterers', 'Catering', 'Award-winning South Asian catering for weddings and events.', '+1-555-0200', 'vendor@test.melabridge.com', 'https://example.com/spice-route', 'Miami', 'FL', 85, 12, true, true, true)
  ON CONFLICT (user_id) DO UPDATE SET is_test_seed = true, onboarding_completed = true;

  RETURN jsonb_build_object('ok', true, 'events', 3, 'guests', 7, 'tasks', 5, 'budget_items', 6, 'files', 3, 'messages', 3, 'notifications', 6);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_test_data(uuid, uuid, uuid) TO service_role;
