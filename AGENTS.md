
- Support chat: the support-chat function writes patient and assistant messages with the service role; only admins insert agent replies directly. Why: patients cannot fake assistant/agent messages.
- Admin access uses public.user_roles + has_role(). Why: avoids privilege escalation.
