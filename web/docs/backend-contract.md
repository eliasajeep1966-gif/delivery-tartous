# عقد الربط الخلفي — شاشة المشرف

## المبدأ

تستخدم الواجهة الحالية بيانات تجريبية معزولة في `client/src/lib/dashboard-data.ts`. عند بدء مرحلة الخلفية، يستبدل مصدر البيانات فقط؛ لا يلزم تغيير بنية المكونات أو تسميات الحالات.

## ملخص الشاشة

`GET /api/admin/dashboard/summary`

```json
{
  "waitingForCaptain": 4,
  "outForDelivery": 7,
  "deliveredToday": 18,
  "cancelledToday": 2
}
```

## آخر الطلبات

`GET /api/admin/orders?scope=recent&limit=3&status=waiting|delivered|picked_up`

```json
{
  "items": [
    {
      "id": "1042",
      "customerName": "محمد العلي",
      "total": 35000,
      "currency": "SYP",
      "deliveryArea": "الرمل الجنوبي",
      "status": "delivered"
    }
  ]
}
```

## الكباتن المتاحون

`GET /api/admin/captains?availability=available&limit=8`

```json
{
  "items": [
    {
      "id": "captain-1",
      "name": "علي",
      "initial": "ع",
      "availability": "available"
    }
  ]
}
```

## إنشاء طلب

`POST /api/admin/orders`

يقبل بيانات العميل والعنوان والمبلغ ومعرّف الكابتن إن تم تعيينه، ثم يعيد الطلب المنشأ بالصيغة نفسها المستخدمة في قائمة الطلبات.

## الحالات المعتمدة

| قيمة الواجهة | القيمة المقترحة في API | العرض |
| --- | --- | --- |
| `waiting` | `waiting_for_captain` | بانتظار استلام الكابتن |
| `picked_up` | `picked_up` | تم الاستلام |
| `delivered` | `delivered` | تم التوصيل |
| `cancelled` | `cancelled` | طلب ملغى |

## ملاحظات أمنية

كل مسارات `/api/admin/*` تحتاج جلسة مستخدم موثقة وصلاحية إدارية صريحة. يجب تطبيق التحقق من الصلاحية على الخادم نفسه، وعدم الاعتماد على إخفاء عناصر الواجهة كوسيلة تحكم بالوصول.
