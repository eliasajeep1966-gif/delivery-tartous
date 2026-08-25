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

### الاستعادة والحماية

- تمت استعادة ملفات الأدمن التي ظهرت محذوفة.
- لم يتم تنفيذ `git reset --hard` أو حذف شامل.
- لم يتم حذف اعتمادات Expo أو Metro أو Babel أو TypeScript.
- لم يتم تعديل ملفات إعداد الموبايل الأساسية دون حاجة.

## 4. التحقق المنفذ

تم تشغيل الأوامر التالية من مجلد [`mobile`](mobile):

```text
pnpm check
pnpm lint
node --env-file=../.env ./node_modules/vitest/vitest.mjs run
```

النتيجة:

- TypeScript: ناجح بعد إضافة مسار More وUsers وعقد إدارة المستخدمين.
- lint: ناجح، مع تحذير Node الموجود مسبقاً بخصوص `type: module`.
- الاختبارات: 6 ملفات ناجحة.
- الاختبارات: 16 اختباراً ناجحاً.
- اختبار واحد متخطى عمداً.
- لا توجد أخطاء فشل في الفحوص.
- `git diff --check`: ناجح.
- تم فحص migrations والتأكد من عدم وجود محارف Unicode مخفية.

يوجد تحذير Node متعلق بعدم وجود `type: module` في [`mobile/package.json`](mobile/package.json)، لكنه غير مؤثر ولم يتم تغييره حفاظاً على البيئة الحالية.

Supabase CLI غير مثبت في الجهاز الحالي، لذلك لم يتم تنفيذ migration فعلياً على قاعدة Supabase من الطرفية.

## 5. أين وصلنا الآن؟

الوضع الحالي:

- مسار الكابتن Native منفذ ومراجع.
- Home وOrders وإنشاء الطلب والتعيين لمسار الأدمن والمشرف منفذة.
- الكود يمر بفحوص TypeScript وlint والاختبارات.
- migration الخاصة بمنع التكرار مكتوبة ومراجعة نصياً.
- لم يتم بعد اختبار إنشاء طلب فعلي من جهاز Android أو iOS متصل بمشروع Supabase الحقيقي.
- لم يتم بعد تطبيق migration الجديدة على قاعدة Supabase الحقيقية.
- واجهة الأجور الإدارية Native منفذة للأدمن والمشرف بنفس منطق وتصميم واجهة الويب.
- تم الحفاظ على شاشة أجور الكابتن الحالية، وتوجيه تبويب الأجور حسب الدور دون حذف الكود السابق.
- لم يتم بعد اختبار تسجيل دفعة فعلياً من جهاز Android أو iOS متصل بمشروع Supabase الحقيقي.
- تم نقل تبويب المزيد Native إلى [`mobile/components/admin/admin-more.tsx`](mobile/components/admin/admin-more.tsx) مع مجموعات الإدارة والإعدادات والحساب، وبنفس هوية الويب RTL وCairo و#0060B8.
- تمت إضافة مسار إدارة المستخدمين Native في [`mobile/app/users.tsx`](mobile/app/users.tsx) مع عرض الحسابات المفعلة والمعلقة، البحث، التصفية حسب الدور، حالات التفعيل والتعطيل، تغيير الدور، وإلغاء الحساب المعلق.
- تمت إضافة نافذة إنشاء الحساب المعلق Native مع الاسم والبريد والدور وأمانات الكابتن، مع تقييد المشرف بإنشاء حسابات الكباتن فقط.
- تمت إضافة عقد Supabase Native وإدارة React Query في [`mobile/lib/supabase/native-admin-users-contract.ts`](mobile/lib/supabase/native-admin-users-contract.ts) و[`mobile/features/admin/use-admin-users.ts`](mobile/features/admin/use-admin-users.ts)، مع RPCs وRealtime وpolling احتياطي.
- يمنع مسار المستخدمين الكابتن من الوصول إلى شاشة الإدارة.
- عناصر More التي لا تملك شاشة Native منقولة بعد تعرض تنبيهاً واضحاً عند الضغط؛ أما إدارة المستخدمين فهي المسار المنقول بالكامل في هذه المرحلة.

## 6. ما يجب عمله لاحقاً

- تطبيق migration الخاصة بـ`push_tokens` وتفعيل Edge Function على مشروع Supabase الحقيقي.
- ضبط `EAS projectId` وبناء Development/Production على Android أو iOS لاختبار الصوت والإشعار الفعلي؛ Expo Go لا يكفي لاختبار كل سلوكيات push الحديثة.
- التحقق من صلاحيات RLS وحسابات admin/supervisor/captain في الفلو الكامل.

### أولوية أولى: قاعدة البيانات

1. تثبيت أو استخدام Supabase CLI المناسب للمشروع.
2. تشغيل فحص migration على قاعدة اختبار أو بيئة Supabase آمنة.
3. تطبيق [`20260824090000_add_order_creation_idempotency.sql`](supabase/migrations/20260824090000_add_order_creation_idempotency.sql) بعد التأكد من عدم وجود تعارض مع حالة قاعدة البيانات الحالية.
4. التحقق من وجود overloads التالية:
   - `public.create_order_with_stops(jsonb, numeric)`.
   - `public.create_order_with_stops(jsonb, numeric, text)`.
5. اختبار إعادة استخدام نفس `idempotency_key` والتأكد من رجوع نفس الطلب دون إنشاء نسخة جديدة.
6. التحقق من أن صلاحيات `admin` و`supervisor` تعمل عبر `create_orders` و`assign_captains`.

### أولوية ثانية: اختبار التشغيل الحقيقي

1. تشغيل Expo/Metro.
2. تجربة Android.
3. تجربة iOS.
4. تسجيل الدخول بحساب أدمن.
5. تسجيل الدخول بحساب مشرف.
6. إنشاء طلب بنقطة استلام ونقطة تسليم.
7. إنشاء طلب بعدة نقاط استلام وتسليم.
8. اختيار كابتن متاح وتعيين الطلب.
9. التأكد من ظهور الطلب في قائمة الأدمن.
10. التأكد من وصول الطلب للكابتن.
11. قبول الطلب وتحريك حالاته حتى الإكمال.
12. اختبار timeout أو إعادة المحاولة وعدم تكرار الطلب.
13. اختبار الإلغاء وتسجيل الطلب الكاذب.

### أولوية ثالثة: إكمال مسار الأدمن والمشرف

الصفحات التي تحتاج نقلها أو مراجعتها لاحقاً:

- الكباتن.
- حصة الشركة والأرباح.
- الأمانات.
- سجل النشاطات.

تم نقل شاشات الإدارة المطلوبة إلى Native React Native وNativeWind:

- التقارير عبر [`mobile/app/(admin)/reports.tsx`](mobile/app/(admin)/reports.tsx)، مع ربط RPCs المالية الحالية عبر [`mobile/features/admin/use-admin-finance.ts`](mobile/features/admin/use-admin-finance.ts)، واستخدام حالات التحميل والخطأ وإعادة المحاولة والتحديث بالسحب.
- إعدادات المكتب عبر [`mobile/app/(admin)/settings.tsx`](mobile/app/(admin)/settings.tsx)، مع RTL وCairo وحقول بيانات المكتب ونسب 70/30 والاستثناءات والتحقق والتنبيهات Native. لا يوجد عقد Supabase أو RPC لحفظ إعدادات المكتب في المجلد الحالي، لذلك بقي الحفظ ضمن حالة الجلسة مثل سلوك شاشة الويب الحالية.
- المساعدة والدعم عبر [`mobile/app/(admin)/support.tsx`](mobile/app/(admin)/support.tsx)، مع قنوات الاتصال عبر Linking، نموذج بلاغ، تحقق من التفاصيل، أسئلة شائعة، وحالات فشل فتح القناة.
- تم ربط الشاشات الثلاث من [`mobile/components/admin/admin-more.tsx`](mobile/components/admin/admin-more.tsx).

نسبة تغطية نقل هذه المجموعة: 100% (3 من 3 شاشات).

## 7. التعليمات الصارمة لأي تعديل لاحق

1. لا تحذف مجلد [`mobile`](mobile) ولا تعيد إنشاءه من الصفر.
2. لا تحذف Expo أو Metro أو Babel أو NativeWind أو lockfiles.
3. لا تغير نسخة SDK أو الاعتمادات إلا عند وجود سبب موثق وفحص توافق كامل.
4. لا تنفذ `git reset --hard` أو `git checkout .` أو حذفاً شاملاً.
5. لا تستعد ملفات المستخدم أو تلغي تغييرات موجودة إلا بعد قراءة diff وفهمها.
6. قبل تعديل أي ملف، اقرأ الكود الحالي وسياقه ومراجع استخدامه.
7. استخدم أنماط المشروع الحالية وSupabase RPCs وRLS بدلاً من اختراع Backend جديد.
8. حافظ على RTL والألوان والخطوط والتصميم المرجعي في [`web/client`](web/client).
9. لا تستخدم مكونات ويب داخل React Native.
10. لا تضف اعتماداً جديداً إذا كان يمكن تنفيذ المطلوب بالاعتمادات الحالية.
11. كل عملية إنشاء طلب يجب أن تستخدم `idempotency_key` جديداً للطلب الجديد.
12. عند حدوث timeout، لا تعِد الإرسال تلقائياً قبل فحص الطلب الموجود.
13. يجب أن يبقى التعيين منفصلاً وواضحاً بعد نجاح إنشاء الطلب.
14. لا تعتبر إنشاء الطلب ناجحاً إلا بعد فحص نتيجة RPC ورسالة الخطأ.
15. لا تعتبر migration ناجحة إلا بعد تطبيقها أو فحصها على قاعدة اختبار متوافقة.
16. لا تعدل أنواع [`src/data/supabase/database.types.ts`](src/data/supabase/database.types.ts) يدوياً إلا إذا كان التغيير مطابقاً فعلياً للـschema والـRPCs.
17. بعد كل تعديل شغّل:

```text
pnpm exec prettier --write <files>
pnpm check
pnpm lint
node --env-file=../.env ./node_modules/vitest/vitest.mjs run
```

18. قبل التسليم راجع:

```text
git status --short
git diff --check
git diff --stat
```

19. لا تحذف الملفات غير المتتبعة عشوائياً، وخصوصاً `.env` أو الملفات التي قد تكون جزءاً من بيئة التشغيل.
20. أي تغيير في Supabase يجب أن يكون migration مستقلة، واضحة، قابلة للمراجعة، ولا تعدل migration قديمة مطبقة.
21. أي Realtime subscription يجب أن يضيف `.on(...)` قبل `.subscribe()` ويزيل القناة في cleanup.
22. يجب استخدام polling احتياطي عند الاعتماد على Realtime في الشاشات التشغيلية.
23. يجب اختبار الصلاحيات فعلياً بحساب admin وحساب supervisor وحساب captain.
24. لا تعلن اكتمال المسار قبل تجربة الفلو الحقيقي من إنشاء الطلب حتى وصوله للكابتن.
25. حافظ على هذا الملف [`PROGRESS.md`](PROGRESS.md) محدثاً بعد كل مرحلة كبيرة.

## 8. الملفات الحساسة التي يجب عدم العبث بها عشوائياً

- [`mobile/package.json`](mobile/package.json)
- [`mobile/app.config.ts`](mobile/app.config.ts)
- [`mobile/metro.config.js`](mobile/metro.config.js)
- [`mobile/babel.config.js`](mobile/babel.config.js)
- [`mobile/tsconfig.json`](mobile/tsconfig.json)
- [`mobile/app/_layout.tsx`](mobile/app/_layout.tsx)
- [`mobile/contexts/delivery-auth-context.tsx`](mobile/contexts/delivery-auth-context.tsx)
- [`mobile/lib/supabase/native-supabase.ts`](mobile/lib/supabase/native-supabase.ts)
- [`supabase/migrations`](supabase/migrations)
- [`src/data/supabase/database.types.ts`](src/data/supabase/database.types.ts)

## 9. قاعدة التسليم

أي مطور أو وكيل يتابع العمل يجب أن يبدأ بقراءة هذا الملف، ثم يفحص `git status` وملفات البيئة، وبعدها يقرأ الكود المرجعي في الويب والكود الحالي في الموبايل. يجب تنفيذ التعديلات تدريجياً، تشغيل الفحوص، وتوثيق ما تم وما بقي هنا قبل إنهاء المرحلة.

## 10. آخر مرحلة منفذة: واجهة أجور الأدمن والمشرف Native

- تمت إضافة عقد Native لقراءة ملخص الفترات وتفاصيل كشف الكابتن وسجل أرباح الشركة وتنفيذ الدفعات الجزئية عبر RPCs الحالية.
- تم التأكد من أن استدعاء ملخص أجور الإدارة لا يمرر `p_captain_id` في الوضع الافتراضي؛ يرسل فقط الفترة والحد، ويضيف معرف الكابتن فقط عند استخدامه مستقبلاً كفلتر.
- تم التأكد من أن pagination تُجمع عبر `query.data?.pages.flat()` ولا تستبدل الصفحات السابقة.
- «كل الكباتن» تعني كل الكباتن الذين لديهم أجور ضمن الفترة المختارة؛ فترة «يومي» قد تعرض كابتناً واحداً إذا كان الوحيد الذي لديه أجر في أحدث يوم.
- تم اكتشاف أن RPC ملخص كل الكباتن كان مفقوداً من migrations، لذلك أضيفت migration مستقلة [`20260824110000_add_captain_wage_period_summary.sql`](supabase/migrations/20260824110000_add_captain_wage_period_summary.sql) لتجميع أجور جميع الكباتن حسب الفترة.
- يجب تطبيق migration الجديدة على قاعدة Supabase الحقيقية قبل ظهور بطاقات جميع الكباتن في التطبيق؛ لا يمكن للطرفية الحالية تنفيذ ذلك لأن Supabase CLI غير مثبت.
- تمت إضافة Realtime لسجل الأجور والدفعات مع polling احتياطي كل 15 ثانية.
- تمت إضافة شاشة Native متوافقة مع RTL والتصميم المرجعي: رأس أزرق، بطاقات بيضاء، مؤشرات مالية، فلاتر الفترات، سجلات الكباتن، وبطاقة «واجهة أجور الشركة».
- تم إصلاح pagination باستخدام `useInfiniteQuery` حتى تُدمج الفترات الأقدم ولا تستبدل البيانات الحالية.
- تمت إضافة شاشة كشف كابتن مستقلة مع فلاتر «الكل/المتبقي/تم تسليمه»، سجل الطلبات، إجماليات 70%/30%، وتسجيل دفعة.
- تمت إضافة شاشة أجور الشركة مستقلة باستخدام `get_company_profit_period_history` مع إجماليات الأجور وحصة الشركة وسجل الفترات اليومية/الأسبوعية/الشهرية.
- بقيت شاشة أجور الكابتن الأصلية دون إزالة، ويحدد تبويب الأجور الشاشة المناسبة حسب الدور.
- تم إصلاح ظهور تبويب الأجور للأدمن والمشرف، مع إبقاء عنوانه «الأجور» وعنوان الكابتن «أجوري».
- تم إصلاح زر الرجوع في شاشة الأجور باستخدام `router.canGoBack()` والعودة إلى `(tabs)` عند عدم وجود شاشة سابقة، لمنع تحذير `GO_BACK` عند فتح التبويب مباشرة.
- تم إنشاء المسارات الفعلية [`captain-wage-detail`](mobile/app/captain-wage-detail.tsx) و[`company-wages`](mobile/app/company-wages.tsx)، ولم تعد هناك روابط إلى شاشات غير موجودة.
- التحقق البرمجي: `pnpm check` ناجح، `pnpm lint` ناجح مع تحذير Node المعروف فقط، و16 اختباراً ناجحاً مع اختبار واحد متخطى عمداً.
- الحالة التشغيلية: عرض أجور جميع الكباتن يحتاج تطبيق migration الجديدة ثم إعادة فتح/تحديث التطبيق، ثم اختيار الفترة التي تحتوي فعلياً على أجور الكباتن المطلوبة.

## 11. آخر مرحلة منفذة: شاشة إدارة الكباتن Native

- تمت إضافة عقد Native مستقل لإدارة الكباتن في [`mobile/lib/supabase/native-captain-admin-contract.ts`](mobile/lib/supabase/native-captain-admin-contract.ts)، ويقرأ الكباتن وحالات التوفر والطلبات المرتبطة والأمانات من جداول Supabase الحالية.
- تمت إضافة عمليات الإدارة الحالية عبر RPCs: `set_captain_active` و`assign_captain_custody` و`return_captain_custody`، دون إنشاء Backend جديد أو كتابة مباشرة على الجداول المحمية.
- تمت إضافة Realtime لجداول الملفات وحالات الكباتن والطلبات والأمانات، مع polling احتياطي كل 15 ثانية.
- تمت إضافة hook [`useAdminCaptains()`](mobile/features/admin/use-admin-captains.ts:7) لإدارة التحميل والتحديث والأخطاء والعمليات، مع alias [`useAdminCaptainsData()`](mobile/features/admin/use-admin-captains.ts:82) المتوافق مع اسم hook المرجعي في الويب.
- تمت إضافة شاشة RTL Native متوافقة مع مرجع الويب في [`mobile/components/admin/admin-captains.tsx`](mobile/components/admin/admin-captains.tsx)، وتشمل البحث، فلاتر الكل/متاح/غير متاح/مفعل/معطل، بطاقات الكباتن، تفاصيل الطلبات، إدارة التفعيل، وإدارة الأمانات.
- تمت إضافة المسار [`captains`](mobile/app/captains.tsx) وربطه من لوحة الإدارة عبر زر «عرض الكل» وقائمة الكباتن المتاحين.
- تم الحفاظ على صلاحيات `admin` و`supervisor`، وتظهر رسالة منع الوصول لباقي الأدوار.

## 12. آخر مرحلة منفذة: شاشة إدارة الأمانات Native

- تمت إضافة الشاشة المطلوبة في [`mobile/app/(admin)/custody.tsx`](mobile/app/(admin)/custody.tsx) باستخدام [`useAdminCaptainsData()`](mobile/features/admin/use-admin-captains.ts:82) وعقد الأمانات الحالي.
- تم نقل تصميم شاشة الويب إلى React Native/NativeWind مع RTL، Cairo، اللون الأساسي `#0060B8`، رأس أزرق، بطاقات بيضاء، بطاقة ملخص الأمانات، وحالة الأمانة والـinitial الملون للكابتن.
- تمت إضافة فلاتر «الكل» و«مع الكابتن» و«تم الإرجاع» داخل [`ScrollView`](mobile/app/(admin)/custody.tsx:154) أفقي.
- تمت إضافة زر «تسجيل إرجاع الأمانة» مع منع النقرات المتزامنة، [`ActivityIndicator`](mobile/app/(admin)/custody.tsx:248) أثناء العملية، وتنبيه [`Alert`](mobile/app/(admin)/custody.tsx:73) عند النجاح أو الفشل.
- تمت معالجة التحميل الأولي والتحديث والسحب للتحديث وحالة الخطأ مع زر إعادة المحاولة.
- تم ربط إدارة الأمانات من قائمة المزيد بالمسار الجديد عبر [`admin-more.tsx`](mobile/components/admin/admin-more.tsx:11).
- التحقق التشغيلي على Android/iOS وحسابات `admin` و`supervisor` وبيئة Supabase الحقيقية ما زال مطلوباً.

## 13. التحقق من شاشة إدارة الأمانات

- `pnpm check`: ناجح.
- `pnpm lint`: ناجح مع تحذير Node المعروف بخصوص `type: module` في [`mobile/package.json`](mobile/package.json).
- `node --env-file=../.env ./node_modules/vitest/vitest.mjs run`: نجحت 6 ملفات اختبارات و16 اختباراً، مع اختبار واحد متخطى عمداً.
- `git diff --check`: ناجح.
- أظهر `git status --short` تغييرات سابقة موجودة في بيئة العمل بالإضافة إلى ملفات مرحلة إدارة الأمانات؛ لم يتم حذف أو إعادة ضبط أي تغييرات غير مرتبطة.
