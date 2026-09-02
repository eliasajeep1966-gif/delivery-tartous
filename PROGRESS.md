# Delivery Tartous - Progress

## 1. ما هو التطبيق؟

Delivery Tartous هو نظام إدارة وتوصيل للطلبات داخل طرطوس، ويتكون من:

- واجهة ويب للأدمن والمشرف والكابتن.
- تطبيق موبايل مبني على React Native وExpo لنفس الأدوار.
- Backend وقاعدة بيانات Supabase.
- نظام صلاحيات يعتمد على الأدوار والـRLS وRPCs.
- إدارة طلبات متعددة نقاط الاستلام والتسليم.
- تعيين الطلبات للكباتن ومتابعة مراحل التوصيل.
- Realtime فائق السرعة للطلبات والكباتن وسجل النشاطات، مع polling احتياطي.
- Expo Push Notifications للكابتن عند إسناد طلب جديد، مع حفظ token لكل جهاز.
- حساب أجور الكابتن وحصة الشركة.

الأدوار الأساسية:

- `admin`: إدارة كاملة حسب الصلاحيات.
- `supervisor`: إدارة تشغيلية حسب الصلاحيات الممنوحة له.
- `captain`: استقبال الطلبات وتنفيذ مراحل التوصيل.

## 2. البيئة الحالية

### الموبايل

المجلد الرئيسي هو [`mobile`](mobile)، والبيئة الحالية محفوظة كما هي:

- Expo SDK 57.
- Expo Router.
- React Native.
- TypeScript strict.
- NativeWind.
- Metro وBabel الحاليان.
- Cairo fonts ودعم RTL.
- Supabase Auth وSupabase Realtime.
- React Query.

### الويب

الواجهة الأصلية موجودة في [`web`](web)، وهي المرجع الوظيفي والتصميمي لمسارات الموبايل.

### Backend

Migrations قاعدة البيانات موجودة في [`supabase/migrations`](supabase/migrations)، وملفات أنواع Supabase في [`src/data/supabase/database.types.ts`](src/data/supabase/database.types.ts).

## 3. ما تم إنجازه

### مسار الكابتن Native

- تسجيل الدخول والتحقق من الجلسة والملف والدور.
- توجيه الكابتن إلى شاشة الموبايل الصحيحة.
- Header علوي متوافق مع تصميم الويب.
- عرض اسم الشركة وبيانات الحساب.
- حالة التوفر `available` و`unavailable`.
- عرض الطلب الحالي.
- عرض المصدر والوجهة وبيانات الاتصال.
- خطوات الطلب:
  - تم إسناد الطلب.
  - تم استلام الطلب.
  - قيد التوصيل.
  - تم التسليم.
- تحديث حالة الطلب.
- تسجيل الطلب كاذب من خلال Native Modal.
- Realtime للكابتن مع التسجيل الصحيح قبل `subscribe()`.
- polling احتياطي لتحديث البيانات.
- تفاصيل الحساب.
- تغيير الاسم وكلمة المرور.
- تسجيل الخروج مع تأكيد Native.
- صفحات الطلبات والأجور والأمانات والإعدادات الأساسية.

الملفات الرئيسية:

- [`mobile/components/captain/captain-home.tsx`](mobile/components/captain/captain-home.tsx)
- [`mobile/components/captain/captain-pages.tsx`](mobile/components/captain/captain-pages.tsx)
- [`mobile/features/captain/use-native-captain-dashboard.ts`](mobile/features/captain/use-native-captain-dashboard.ts)
- [`mobile/lib/supabase/native-captain-contract.ts`](mobile/lib/supabase/native-captain-contract.ts)

### مسار الأدمن والمشرف Native

- دعم `admin` و`supervisor` في الصفحة الرئيسية.
- نقل شاشة سجل الحركات ActivityLogs إلى Native React Native مع NativeWind وRTL.
- إضافة بحث وفلاتر تصنيف أفقية، أيقونات lucide-react-native، حالات التحميل والأخطاء وإعادة المحاولة، والتنقل بين صفحات السجل.
- لوحة مؤشرات للطلبات والنشاط والكباتن المتاحين.
- فتح قائمة الطلبات من لوحة العمل.
- قائمة طلبات Native مع الفلاتر والبحث والتنقل بين الصفحات.
- عرض تفاصيل الطلب.
- عرض نقاط الاستلام والتسليم.
- عرض سجل حالات الطلب.
- اختيار كابتن متاح.
- تعيين كابتن للطلب.
- إلغاء الطلب مع سبب.
- إنشاء طلب Native متعدد نقاط الاستلام والتسليم.
- إدخال اسم ورقم وعنوان وملاحظات كل نقطة.
- إدخال أجرة الطلب واختيار الكابتن.
- RTL وKeyboardAvoidingView وNative Modal.
- Hook موحد ومحسن في [`mobile/lib/supabase/useRealtimeOrders.ts`](mobile/lib/supabase/useRealtimeOrders.ts) يستمع فورياً إلى `orders` و`captain_status` و`profiles` و`audit_logs` مع إزالة القنوات في cleanup.
- تحديث Optimistic لحالة توفر الكابتن قبل اكتمال طلب الشبكة مع rollback عند الفشل.
- polling احتياطي كل 10–15 ثانية يبقى مفعلاً للشاشات التشغيلية.
- التعامل مع timeout بعد إنشاء الطلب أو تعيين الكابتن.
- منع إعادة إرسال الطلب بشكل أعمى بعد timeout.

الملفات الرئيسية:

- [`mobile/components/admin/admin-home.tsx`](mobile/components/admin/admin-home.tsx)
- [`mobile/components/admin/admin-orders.tsx`](mobile/components/admin/admin-orders.tsx)
- [`mobile/components/admin/admin-new-order-modal.tsx`](mobile/components/admin/admin-new-order-modal.tsx)
- [`mobile/features/admin/use-admin-home.ts`](mobile/features/admin/use-admin-home.ts)
- [`mobile/features/admin/use-admin-orders.ts`](mobile/features/admin/use-admin-orders.ts)
- [`mobile/features/admin/use-admin-order-details.ts`](mobile/features/admin/use-admin-order-details.ts)
- [`mobile/lib/supabase/native-admin-contract.ts`](mobile/lib/supabase/native-admin-contract.ts)

### الإشعارات الفورية

- إضافة [`mobile/lib/notifications.ts`](mobile/lib/notifications.ts) لتسجيل Expo Push Token، إنشاء إشعارات بصوت افتراضي، وحذف tokens عند تسجيل الخروج.
- إضافة جدول `push_tokens` وسياسات RLS وRealtime للمصادر التشغيلية في migration [`supabase/migrations/20260825060000_add_push_tokens_and_realtime.sql`](supabase/migrations/20260825060000_add_push_tokens_and_realtime.sql).
- إضافة Edge Function [`supabase/functions/send-order-push/index.ts`](supabase/functions/send-order-push/index.ts) التي ترسل إشعاراً عالي الأولوية للكابتن بعد نجاح تعيين الطلب.
- ربط تسجيل token بدورة المصادقة وربط إرسال الإشعار بمسار إنشاء/تعيين الطلب في شاشة الإدارة.

### قاعدة البيانات وRealtime

- تمت استعادة migration الخاصة بـRealtime بعد ظهورها كمحذوفة.
- تم تفعيل نشر جدول `orders` في `supabase_realtime` عبر [`supabase/migrations/20260822211000_enable_orders_realtime.sql`](supabase/migrations/20260822211000_enable_orders_realtime.sql).
- تمت إضافة migration لمحاولة منع إنشاء الطلب مرتين عند إعادة المحاولة عبر [`supabase/migrations/20260824090000_add_order_creation_idempotency.sql`](supabase/migrations/20260824090000_add_order_creation_idempotency.sql).
- migration الجديدة تضيف `idempotency_key` و`order_kind` وتضيف overload بثلاثة معاملات دون إعادة تسمية الدالة القديمة.
- تم تصحيح المحارف المخفية من migration.
- أنواع Supabase الحالية تتضمن `p_idempotency_key` والحقول الجديدة.

