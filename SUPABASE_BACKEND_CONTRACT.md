# عقد Supabase الرسمي — دليفري طرطوس

> **الإصدار:** 2026-08-20. هذا الملف و`database.types.ts` هما مرجع Kilo الوحيد لطبقة Supabase. لا تُخترع جداول أو RPCs أو أنواع أخرى.

## 1. مصدر الحقيقة

| المصدر | القاعدة |
|---|---|
| `src/data/supabase/database.types.ts` | مولّد من Schema الحي. ممنوع تعديله يدوياً. |
| `src/data/supabase/supabaseContract.ts` | واجهة التطبيق الوحيدة للشاشات والـHooks. |
| `supabase/migrations/` | التاريخ الكامل للـSchema الحي؛ لا تعاد تطبيقها على المشروع الحي. |
| `supabase/functions/` | Edge Functions المنشورة. لا تُستدعى `invite-user` لأنها متقاعدة. |

## 2. المصادقة وتفعيل الحساب

لا يوجد Self-signup ولا رابط بريد. الأدمن أو المشرف ينشئ `Pending Account` من التطبيق عبر `deliverySupabase.actions.createPendingAccount`.

```text
إنشاء Pending → المستخدم يفتح أول تفعيل → email + password + confirmation
→ activate-pending-account Edge Function → Auth user + Profile + role + custody
→ تسجيلات لاحقة: email + password
```

لا يستخدم Expo `auth.signUp()` ولا `SERVICE_ROLE_KEY`. وظيفة `activate-pending-account` فقط هي التي تستخدم Service Role داخل Supabase.

| Function | الحالة |
|---|---|
| `activate-pending-account` | نشطة؛ تستقبل البريد وكلمة المرور وتعيد نتيجة عامة عند الفشل. |
| `invite-user` | متقاعدة؛ تعيد `410 DEPRECATED_ENDPOINT` ولا تنشئ حساباً ولا ترسل بريداً. |

## 3. الأدوار وحدودها

| الدور | العمليات المسموحة |
|---|---|
| `admin` | جميع عمليات النظام، إدارة Admin/Supervisor/Captain، تعديل Permission Overrides، الأجور، الدفعات، والأمانات. |
| `supervisor` | الطلبات، الكباتن فقط (إنشاء/إلغاء Pending، تعطيل/تفعيل)، الأمانات، كشف الأجور، وتسجيل دفعات الكباتن. لا يدير Admin/Supervisor ولا يغير الأدوار أو Permission Overrides. |
| `captain` | حالته، طلباته المعيّنة، مراحل التسليم، وأماناته الخاصة. |

## 4. الجداول الموجودة

| المجال | الجداول |
|---|---|
| الهوية والصلاحيات | `profiles`, `permissions`, `role_permissions`, `user_permission_overrides` |
| الكباتن | `captain_status`, `captain_custody` |
| Pending Activation | `pending_account_activations`, `pending_captain_custody` |
| الطلبات | `orders`, `order_stops`, `order_status_history` |
| المال | `financial_ledger`, `captain_payouts`, `captain_payout_items` |
| التتبع | `audit_logs` |

RLS مفعّل على الجداول. التطبيق لا يكتب مباشرة على الجداول الحساسة.

## 5. RPCs المعتمدة

### الطلبات والكابتن

```text
create_order                         # Legacy single-stop RPC; يبقى للتوافق فقط
create_order_with_stops              # RPC المعتمدة للويب والواجهات الجديدة متعددة النقاط
assign_order_captain
cancel_order
transition_assigned_order
set_captain_availability
set_captain_active
```

`create_order_with_stops(p_stops, p_fee)` هو مسار الإنشاء الجديد. يستقبل مصفوفة نقاط مرتبة من `pickup` و`delivery`، ويشترط مصدر استلام واحداً ووجهة تسليم واحدة على الأقل. الأجرة `p_fee` هي **أجرة واحدة للطلب كله**؛ لا يحمل `order_stops` أي أجر. ينشئ الطلب والنقاط وسجل الحالة وسجل التدقيق في معاملة واحدة، ثم تستدعي الواجهة `assign_order_captain` باستخدام `order.id` الناتج.

قراءة تفاصيل الطلب تستخدم `deliverySupabase.reads.orderStops(orderId)` فقط. RLS تسمح بالقراءة إذا كان الطلب نفسه مرئياً للمستخدم، وتمنع أي كتابة مباشرة على `order_stops`.

### المستخدمون وPending

```text
create_pending_account
cancel_pending_account
list_pending_accounts
set_user_role                 # Admin فقط
set_user_permission_override  # Admin فقط
```

### الأمانات

```text
assign_captain_custody
return_captain_custody
```

### تبويب الأجور والدفعات

```text
get_wage_totals
get_captain_wage_summary
get_captain_wage_details
create_captain_payout
```

`create_captain_payout` يستقبل سجلات `financial_ledger` محددة من كابتن واحد فقط. ينشئ دفعة موثقة في `captain_payouts` ويمنع دفع السجل نفسه مرتين.

## 6. تبويب الأجور المطلوب في الواجهة

```text
الأجور
├─ إجمالي الأجور لكل الكباتن: get_wage_totals
└─ اختيار كابتن
   ├─ ملخص الكابتن: get_captain_wage_summary
   ├─ طلباته المكتملة/الكاذبة: get_captain_wage_details
   ├─ صافي المستحق = 70%
   ├─ حالة السجل: paid إذا payout_id موجود، وإلا unpaid
   └─ اختيار unpaid rows → تم الدفع → create_captain_payout
```

## 7. الأمانات

عند إنشاء Pending كابتن، `custodyItemsText` يقبل غرضاً في كل سطر. بعد التفعيل تنقل تلقائياً إلى `captain_custody`. الأدمن والمشرف يستطيعان إضافة الأمانات وإرجاعها؛ الكابتن يرى أماناته فقط.

## 8. ممنوعات صريحة

```text
ممنوع: insert/update/delete مباشر على orders أو order_stops أو financial_ledger أو profiles
ممنوع: insert/update/delete مباشر على payout أو custody أو pending tables
ممنوع: استدعاء invite-user
ممنوع: auth.signUp من Expo
ممنوع: SERVICE_ROLE_KEY أو كلمة مرور أو Secret في .env المرفوع أو المصدر
ممنوع: تعديل database.types.ts يدوياً
```

## 9. سجل Migrations الحي

```text
20260818174928_create_core_schema
20260818175632_secure_rbac_and_rls
20260818175758_isolate_rls_helpers
20260818175953_create_order_workflow_rpcs
20260818180143_sync_auth_users_to_profiles
20260818185927_add_captain_custody_and_access_rpcs
20260818191102_add_account_activation_state
20260818213353_add_pending_account_activation_flow
20260819041446_add_supervisor_captain_management
20260819042617_add_captain_payouts_and_supervisor_finance_access
20260819050110_fix_pending_email_reuse_and_last_admin_guard
20260819073603_filter_open_pending_accounts
20260820052533_add_multi_stop_orders
```

## 10. قاعدة تحديث العقد

بعد أي Migration جديدة:

```text
1. تطبيق Migration على Supabase
2. توليد database.types.ts من المشروع الحي
3. تحديث supabaseContract.ts وSUPABASE_BACKEND_CONTRACT.md
4. تشغيل npx tsc --noEmit
5. لا commit ولا push إلا بموافقة صريحة من إيلي
```
