-- The CRM server throttles sign-in attempts with the same rate limiter.
grant execute on function public.hit_rate_limit(text, integer, integer) to crm_server;
