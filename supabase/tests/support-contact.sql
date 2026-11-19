-- Regression: the designated verified support account can handle human handoffs.
-- All three columns must be true.
select
  count(*) = 1 as designated_account_exists,
  coalesce(bool_and(email_confirmed_at is not null), false) as account_verified,
  coalesce(bool_and(public.has_role(id, 'admin'::public.app_role)), false) as can_access_support_inbox
from auth.users
where lower(email) = 'p87090406@gmail.com';