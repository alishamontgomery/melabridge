
REVOKE EXECUTE ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_ticket_refund(uuid, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_tickets(uuid, text, text, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_ticket_refund(uuid, int, text) TO service_role;
