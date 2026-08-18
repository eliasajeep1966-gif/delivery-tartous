# عقد Supabase الرسمي — دليفري طرطوس

> **مصدر الحقيقة:** مشروع Supabase الحي `delivery-tartous` هو المرجع الأول. هذا الملف و`src/data/supabase/database.types.ts` هما المرجع الإلزامي لكود Expo. لا تكتب أنواعاً يدوية لقاعدة البيانات ولا SQL عشوائياً.

## قاعدة العمل غير القابلة للتفاوض

كل شاشة أو Hook تستعمل حصراً:

```ts
import { deliverySupabase } from '@/data/supabase/supabaseContract';
```

ولا تستورد `getSupabaseClient()` خارج طبقة `src/data/supabase/`.

## الملفات الرسمية

| الملف | الحالة | الغرض |
|---|---|---|
| `supabase/migrations/*.sql` | المصدر التاريخي | كل تغيير بنيوي أو أمني لقاعدة البيانات. |
| `src/data/supabase/database.types.ts` | مولّد من Supabase الحي | Types وEnums والجداول وRPCs. لا يعدّل يدوياً. |
| `src/data/supabase/supabaseClient.ts` | Typed client | العميل الموحد بمفتاح Publishable فقط. |
| `src/data/supabase/supabaseContract.ts` | واجهة التطبيق | كل القراءات والأفعال الآمنة التي تستخدمها الشاشات. |
| `supabase/functions/invite-user/index.ts` | Edge Function | إنشاء حساب مدعو بالبريد مع الدور والأمانات. |

## Migrations المطبقة

| الترتيب | Migration | مسؤوليتها |
|---:|---|---|
| 1 | `20260818174928_create_core_schema.sql` | الجداول الأساسية، حالات الطلب، الأرباح، والسجلات. |
| 2 | `20260818175632_secure_rbac_and_rls.sql` | RBAC وRLS. |
| 3 | `20260818175758_isolate_rls_helpers.sql` | عزل دوال الحماية الداخلية. |
| 4 | `20260818175953_create_order_workflow_rpcs.sql` | عمليات الطلبات الذرية والحسابات المالية. |
| 5 | `20260818180143_sync_auth_users_to_profiles.sql` | إنشاء Profile تلقائياً لكل مستخدم Auth. |
| 6 | `20260818185927_add_captain_custody_and_access_rpcs.sql` | أمانات الكابتن وإدارة الدور والصلاحيات الفردية. |
| 7 | `20260818191102_add_account_activation_state.sql` | تفعيل أول حساب بعد تعيين كلمة المرور. |

## الجداول المسموح قراءتها

القراءة تخضع لـRLS دائماً. ظهور صف في التطبيق لا يعني أن كل دور يراه؛ سياسة قاعدة البيانات هي الحكم النهائي.

| الجدول | الاستخدام في التطبيق |
|---|---|
| `profiles` | الملف الشخصي، المستخدمون والكباتن للأدمن. |
| `captain_status` | توفر الكباتن. |
| `orders` | قائمة الطلبات وتفاصيلها. |
| `order_status_history` | Timeline حالة الطلب. |
| `financial_ledger` | تقارير الأرباح. |
| `captain_custody` | أمانات الكابتن الحالية والمرجعة. |
| `permissions` | عرض Catalog الصلاحيات للأدمن. |
| `user_permission_overrides` | عرض صلاحيات مستخدم فردية للأدمن. |
| `audit_logs` | سجل المراجعة الإداري عند بناء شاشته. |

## العمليات المسموح استدعاؤها فقط

لا تنشئ استدعاء RPC جديداً من الشاشة. إن لم تجد العملية هنا، أوقف التنفيذ واطلب إضافة رسمية للعقد وMigration عند الحاجة.

| عملية `deliverySupabase.actions` | RPC/Function الحقيقي | من ينفذها |
|---|---|---|
| `createOrder` | `create_order` | Admin أو Supervisor لديه صلاحية. |
| `assignOrderCaptain` | `assign_order_captain` | Admin أو Supervisor مخول. |
| `cancelOrder` | `cancel_order` | Admin أو Supervisor مخول. |
| `transitionAssignedOrder` | `transition_assigned_order` | الكابتن المعيّن فقط. |
| `setCaptainAvailability` | `set_captain_availability` | الكابتن نفسه فقط. |
| `assignCaptainCustody` | `assign_captain_custody` | Admin فقط. |
| `returnCaptainCustody` | `return_captain_custody` | Admin فقط. |
| `setUserRole` | `set_user_role` | Admin فقط. |
| `setUserPermissionOverride` | `set_user_permission_override` | Admin فقط. |
| `inviteUser` | Edge Function `invite-user` | Admin فقط، JWT إجباري. |

## المصادقة وتفعيل الحساب

```text
الأدمن يضيف بريد المستخدم + الدور
→ invite-user تنشئ دعوة Auth وتضبط الـProfile والأمانات للكابتن
→ المستخدم يفتح رابط الدعوة المثبت في البريد
→ التطبيق يحصل على Session من Deep Link
→ تظهر شاشة: كلمة مرور + تأكيد كلمة المرور
→ activateInvitedAccount() يحدّث كلمة المرور ثم يستدعي complete_account_activation
→ أي دخول لاحق: signInWithPassword(email, password)
```

لا يوجد تسجيل ذاتي داخل التطبيق. ممنوع استعمال `auth.signUp()` في كود Expo. لا يظهر للمستخدم نموذج التفعيل إلا إذا وصل إلى Session صالحة عبر دعوة موثقة.

## الأمانات عند دعوة كابتن

عند اختيار الدور `captain` في شاشة إضافة مستخدم، يظهر حقل تحرير نصي باسم `custodyItemsText`:

```text
هاتف العمل
حقيبة التوصيل
خوذة
جاكيت الشركة
```

كل سطر غير فارغ يصبح سجلاً مستقلاً في `captain_custody`. الكابتن يراه ضمن واجهته، والأدمن يستطيع لاحقاً تسجيل إرجاعه فقط عبر `returnCaptainCustody`، ولا يحذف السجل.

## الممنوعات الصريحة

```ts
// ممنوع في screens / hooks / components:
getSupabaseClient().from('orders').insert(...)
getSupabaseClient().from('orders').update(...)
getSupabaseClient().from('financial_ledger').insert(...)
getSupabaseClient().from('order_status_history').insert(...)
getSupabaseClient().from('profiles').update(...)
getSupabaseClient().from('captain_custody').insert(...)
getSupabaseClient().from('captain_custody').update(...)
supabase.auth.signUp(...)
```

وممنوع منعاً قاطعاً:

```text
SERVICE_ROLE_KEY
sb_secret_...
كلمة مرور قاعدة البيانات
```

في Expo أو Git أو أي ملف عميل. التطبيق يستعمل فقط:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## تحديث العقد عند تغيير Supabase

1. يُكتب Migration جديدة أولاً وتراجع.
2. تُطبق على Supabase.
3. يعاد توليد `database.types.ts` من المشروع الحي.
4. يحدّث `supabaseContract.ts` ويدخل فيه فقط ما يحتاجه التطبيق.
5. يشغل Kilo فحص TypeScript.
6. ثم فقط تُبنى الشاشة التي تستعمل التغيير.

> لا يعكس Kilo المخطط من التخمين. لا يعدل `database.types.ts`. لا يطبّق Migration أو ينشر Function أو يعمل commit/push إلا بأمر صريح من صاحب المشروع.
