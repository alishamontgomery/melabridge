-- Restrict calendar RLS policies to authenticated role for defense in depth
DROP POLICY IF EXISTS avail_owner_all ON public.calendar_availability;
CREATE POLICY avail_owner_all ON public.calendar_availability
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS blocked_owner_all ON public.calendar_blocked_dates;
CREATE POLICY blocked_owner_all ON public.calendar_blocked_dates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS settings_owner_all ON public.calendar_settings;
CREATE POLICY settings_owner_all ON public.calendar_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- calendar_booking_requests: scope to authenticated
DROP POLICY IF EXISTS req_planner_insert ON public.calendar_booking_requests;
CREATE POLICY req_planner_insert ON public.calendar_booking_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = planner_id);

DROP POLICY IF EXISTS req_planner_read ON public.calendar_booking_requests;
CREATE POLICY req_planner_read ON public.calendar_booking_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = planner_id);

DROP POLICY IF EXISTS req_planner_update_own ON public.calendar_booking_requests;
CREATE POLICY req_planner_update_own ON public.calendar_booking_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = planner_id AND status = ANY (ARRAY['pending'::calendar_request_status, 'alternate_proposed'::calendar_request_status]))
  WITH CHECK (auth.uid() = planner_id);

DROP POLICY IF EXISTS req_vendor_all ON public.calendar_booking_requests;
CREATE POLICY req_vendor_all ON public.calendar_booking_requests
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = calendar_booking_requests.vendor_id AND vp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = calendar_booking_requests.vendor_id AND vp.user_id = auth.uid()));

-- calendar_events: vendor policy via vendor_profiles link (consistent with vendor_bookings)
DROP POLICY IF EXISTS cal_events_planner_read ON public.calendar_events;
CREATE POLICY cal_events_planner_read ON public.calendar_events
  FOR SELECT TO authenticated
  USING (auth.uid() = planner_id);

DROP POLICY IF EXISTS cal_events_vendor_all ON public.calendar_events;
CREATE POLICY cal_events_vendor_all ON public.calendar_events
  FOR ALL TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);