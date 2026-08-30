-- The public mutation RPCs call these private security-definer helpers.
-- Authenticated users need EXECUTE on the helpers; table access remains revoked.
grant execute on function private.append_treasury_transaction(public.treasury_transaction_type, numeric, text, uuid, uuid) to authenticated;
grant execute on function private.require_treasury_admin() to authenticated;
