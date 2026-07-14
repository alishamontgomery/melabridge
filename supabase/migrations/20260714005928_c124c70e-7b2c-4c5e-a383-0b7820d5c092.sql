REVOKE EXECUTE ON FUNCTION public.fn_compute_booking_stage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recompute_booking_stage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_apply_confirmation_rule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_booking_stage_watcher() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recompute_time_based_stages() FROM PUBLIC, anon, authenticated;