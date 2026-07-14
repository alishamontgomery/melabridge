DROP POLICY IF EXISTS req_vendor_all ON public.calendar_booking_requests;
CREATE POLICY req_vendor_all ON public.calendar_booking_requests
  FOR ALL TO authenticated
  USING (auth.uid() = vendor_id)
  WITH CHECK (auth.uid() = vendor_id);