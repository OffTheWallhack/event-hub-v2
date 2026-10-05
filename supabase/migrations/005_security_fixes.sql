-- 002–004 boli dočasné pomocné migrácie na prenos dát (vytvorené a hneď zmazané), v repe nie sú.
alter function public.set_updated_at() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_approved() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_approved() to authenticated;
