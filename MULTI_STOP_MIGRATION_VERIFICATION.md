# Multi-stop Order Migration — Verification Plan

**Migration المحلية المقترحة:** `supabase/migrations/20260820000000_add_multi_stop_orders.sql`  
**حالة التطبيق على Supabase الحي:** لم تُطبّق.  
**قاعدة المال:** `orders.fee` هي أجرة واحدة للطلب؛ لا يوجد مبلغ على `order_stops` ولا تتغير قواعد `financial_ledger` أو تقسيم 70/30.

> لا يمكن تنفيذ اختبارات السلوك وRLS أدناه قبل الموافقة الصريحة على تطبيق الـMigration في بيئة اختبار أو على المشروع الحي. ما أُنجز حالياً هو مراجعة ثابتة للـSQL فقط.

## اختبارات القبول بعد التطبيق

| # | حالة الاختبار | الإجراء | النتيجة المتوقعة |
|---:|---|---|---|
| 1 | طلب متعدد النقاط بأجرة واحدة | يستدعي مستخدم يملك `create_orders` الدالة `create_order_with_stops` مع نقطتي `pickup` ووجهتي `delivery` و`p_fee = 25000`. | يُنشأ صف واحد في `orders`، وأربعة صفوف في `order_stops`. `orders.fee = 25000.00`، ولا يوجد أي صف في `financial_ledger` قبل الإنهاء. |
| 2 | أجرة صفر أو سالبة | استدعاء الدالة مع `p_fee = 0` أو قيمة سالبة، وكذلك قيمة موجبة تصبح صفراً بعد التقريب مثل `0.001`. | رفض بـ`22023`؛ لا ينشأ طلب أو نقاط. |
| 3 | غياب pickup أو delivery | إرسال مصفوفة تحوي نوعاً واحداً فقط من النقاط. | رفض بـ`22023`؛ يلزم Pickup واحد وDelivery واحد على الأقل. |
| 4 | حقول نصية فارغة | إرسال `contact_name` أو `contact_phone` أو `address` فارغاً أو يحتوي مسافات فقط. | رفض بـ`22023`؛ لا تُنشأ بيانات جزئية. |
| 5 | تسلسل غير سليم | إرسال `sequence` غير موجب أو غير صحيح أو مكرر ضمن `stop_type` نفسه. | رفض بـ`22023`؛ يبقى القيد `unique(order_id, stop_type, sequence)` كحماية ثانية في المخطط. |
| 6 | مفاتيح JSON غير معتمدة | إرسال Stop يحوي حقل إضافي مثل `fee` أو `driver_note`. | رفض بـ`22023`؛ المفاتيح المقبولة حصراً: `stop_type`, `sequence`, `contact_name`, `contact_phone`, `address`, `note`. |
| 7 | كابتن بلا صلاحية إنشاء | استدعاء الدالة من Session كابتن لا يملك `create_orders`. | رفض بـ`42501`؛ لا طلب ولا Stop. |
| 8 | منع الإدخال المباشر | محاولة `insert` مباشرة إلى `public.order_stops` من Session authenticated. | رفض صلاحيات/RLS؛ لا توجد Grant للـInsert ولا Policy كتابة. |
| 9 | رؤية نقاط الطلب | يُعيَّن طلب لكابتن (أ)، ثم يقرأ الكابتن (أ) نقاطه؛ بعدها يحاول كابتن (ب) قراءة النقاط ذاتها. | الكابتن (أ) يرى الصفوف بسبب `private.can_view_order(order_id)`؛ الكابتن (ب) لا يرى أي صف. المستخدم المخوّل بـ`view_all_orders` يراها. |
| 10 | تسوية الطلب المكتمل | يمر الطلب متعدد النقاط عبر الحالات حتى `completed`. | يُنشأ صف واحد فقط في `financial_ledger` بسبب `financial_ledger.order_id unique`، ومبلغه `gross_fee = orders.fee`. |
| 11 | تسوية الطلب الكاذب | يُحوَّل طلب متعدد النقاط إلى `false_order` من كابتنه المعيّن. | يُنشأ صف واحد فقط في `financial_ledger`، منه 70% للكابتن، و0 للشركة، و30% تسوية؛ المصدر الوحيد هو `orders.fee`. |

## بيانات اختبار صالحة للدالة

```json
{
  "p_fee": 25000,
  "p_stops": [
    {
      "stop_type": "pickup",
      "sequence": 1,
      "contact_name": "متجر الأول",
      "contact_phone": "0933000001",
      "address": "طرطوس - الكورنيش",
      "note": "استلام صندوقين"
    },
    {
      "stop_type": "pickup",
      "sequence": 2,
      "contact_name": "متجر الثاني",
      "contact_phone": "0933000002",
      "address": "طرطوس - الرمل",
      "note": null
    },
    {
      "stop_type": "delivery",
      "sequence": 1,
      "contact_name": "العميل الأول",
      "contact_phone": "0933000003",
      "address": "طرطوس - دوار الساعة",
      "note": "اتصل قبل الوصول"
    },
    {
      "stop_type": "delivery",
      "sequence": 2,
      "contact_name": "العميل الثاني",
      "contact_phone": "0933000004",
      "address": "طرطوس - الزراعة",
      "note": null
    }
  ]
}
```

## استعلامات تحقق بعد التطبيق

```sql
-- بعد استدعاء RPC الناجح، استبدل :order_id بالمعرف الفعلي.
select id, order_number, fee, status
from public.orders
where id = :order_id;

select stop_type, sequence, contact_name, contact_phone, address, note
from public.order_stops
where order_id = :order_id
order by stop_type, sequence;

select order_id, source_status, gross_fee, captain_amount, company_amount, settlement_amount
from public.financial_ledger
where order_id = :order_id;
```

## ثوابت التصميم التي تحميها Migration

| الثابت | كيف تحميه Migration |
|---|---|
| أجرة واحدة لكل طلب | `order_stops` لا يملك حقل أجر؛ فقط `orders.fee` يسجل الأجرة. |
| تسوية واحدة لكل طلب | لا تغيير على `financial_ledger` الذي يملك `unique(order_id)`. |
| عدم كشف نقاط طلب كابتن آخر | RLS Select policy تعتمد على `private.can_view_order(order_id)`. |
| عدم وجود كتابة مباشرة من Expo | Grants تعطي `SELECT` فقط؛ جميع الكتابات تتم داخل `private.create_order_with_stops`. |
| إنشاء ذري | كل إدخالات `orders` و`order_stops` و`order_status_history` و`audit_logs` ضمن استدعاء Function واحد؛ أي Exception يلغي المعاملة كاملة. |
| توافق مؤقت مع البيانات القديمة | الحقول القديمة في `orders` تُملأ من أول Pickup وأول Delivery حسب `sequence`، و`create_order` القديم يبقى كما هو حتى يتم تقاعده بقرار صريح. |
