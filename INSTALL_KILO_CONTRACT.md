# تركيب حزمة Kilo Contract المصححة

هذه الحزمة **Patch** فوق آخر نسخة من Repository:

```text
C:\Users\DELL\Desktop\delivery-tartous
```

## قبل النسخ

1. تأكد أن الـRepository عند commit الأخير.
2. لا تعمل `git commit` أو `git push` في هذه الخطوة.
3. فك الضغط ثم انسخ **محتويات** مجلد الحزمة فوق جذر المشروع، مع الحفاظ على المسارات.

## الملفات التي تستبدل أو تضاف

```text
AGENTS.md
SUPABASE_BACKEND_CONTRACT.md
tsconfig.json

src/data/supabase/database.types.ts
src/data/supabase/supabaseClient.ts
src/data/supabase/client.ts
src/data/supabase/supabaseContract.ts
src/data/supabase/mappers.ts

src/repositories/supabase/ordersRepository.ts
src/repositories/supabase/usersRepository.ts

supabase/migrations/*.sql
supabase/functions/invite-user/index.ts
```

## قاعدة عميل Supabase الواحد

الملف الوحيد الذي ينشئ العميل هو:

```text
src/data/supabase/supabaseClient.ts
```

وهو يستخدم `AsyncStorage` مع:

```ts
persistSession: true
autoRefreshToken: true
detectSessionInUrl: false
```

الملف التالي هو Export فقط للتوافق مع الاستيرادات القديمة؛ لا ينشئ Client جديداً:

```text
src/data/supabase/client.ts
```

```ts
export { getSupabaseClient } from './supabaseClient';
```

> `@react-native-async-storage/async-storage` موجود أساساً في المشروع، لذلك لا تثبت أي dependency جديدة.

## Patch Types الإلزامي

بعد استبدال `database.types.ts` الرسمي، تكون الصيغة الصحيحة:

```ts
Tables<'orders'>
Tables<'profiles'>
Tables<'captain_status'>
Tables<'financial_ledger'>
```

وليست:

```ts
Tables['orders']['Row']
```

هذا الـPatch موجود أصلاً في الملفات المرفقة:

```text
src/data/supabase/mappers.ts
src/repositories/supabase/ordersRepository.ts
src/repositories/supabase/usersRepository.ts
```

## Migrations

أسماء ملفات الـMigrations داخل الحزمة تطابق versions الحية في Supabase حرفياً. لا تغيّرها ولا تعيد تطبيقها يدوياً على المشروع الحي.

## التحقق النهائي

شغل من جذر المشروع:

```powershell
npx tsc --noEmit
```

النتيجة المطلوبة: خروج بلا أخطاء.
