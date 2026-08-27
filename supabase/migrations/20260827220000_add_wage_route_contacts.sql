-- Enrich the captain wage response with route contact details.
-- The private wage function remains the authorization gate. This wrapper only enriches
-- the ledger rows already returned for the authenticated captain.

create or replace function public.get_my_captain_wage_page(
  p_period text default 'daily',
  p_limit integer default 10,
  p_offset integer default 0,
  p_custom_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wages jsonb;
begin
  v_wages := private.get_my_captain_wage_page(
    p_period,
    p_limit,
    p_offset,
    p_custom_date
  );

  return jsonb_set(
    v_wages,
    '{rows}',
    coalesce(
      (
        select jsonb_agg(
          wage_row.value || jsonb_build_object(
            'pickup_contact_name', coalesce(pickup.contact_name, 'المصدر'),
            'pickup_contact_phone', coalesce(pickup.contact_phone, '-'),
            'delivery_contact_name', coalesce(delivery.contact_name, orders.customer_name, 'الوجهة'),
            'delivery_contact_phone', coalesce(delivery.contact_phone, orders.customer_phone, '-')
          )
          order by wage_row.ordinality
        )
        from jsonb_array_elements(v_wages->'rows') with ordinality as wage_row(value, ordinality)
        join public.orders orders
          on orders.id = (wage_row.value->>'order_id')::uuid
        left join lateral (
          select stops.contact_name, stops.contact_phone
          from public.order_stops stops
          where stops.order_id = orders.id
            and stops.stop_type = 'pickup'::public.order_stop_type
          order by stops.sequence asc
          limit 1
        ) pickup on true
        left join lateral (
          select stops.contact_name, stops.contact_phone
          from public.order_stops stops
          where stops.order_id = orders.id
            and stops.stop_type = 'delivery'::public.order_stop_type
          order by stops.sequence desc
          limit 1
        ) delivery on true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_my_captain_wage_page(text, integer, integer, date) from public, anon;
grant execute on function public.get_my_captain_wage_page(text, integer, integer, date) to authenticated;
