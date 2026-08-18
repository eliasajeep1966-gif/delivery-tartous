مواصفة قلب التطبيق — دليفري طرطوس

الهدف

هذه المواصفة تحدد المنطق الذي يجب بناؤه قبل أي واجهات Stitch. النتيجة المطلوبة هي كود TypeScript وReact قابل للاختبار وإعادة الاستخدام من أي شاشة لاحقاً. لا تبنِ Dashboard أو Tabs أو تصميمات نهائية ضمن هذه المرحلة.

الأدوار

Plain Text


export type UserRole = 'admin' | 'supervisor' | 'captain';



•
admin: جميع الصلاحيات، إدارة المستخدمين والأدوار، الطلبات، الأرباح، Audit log.

•
supervisor: إنشاء الطلب، إلغاؤه بسبب، اختيار كابتن متاح، متابعة الطلبات. صلاحيات إضافية مستقبلاً قابلة للضبط.

•
captain: تغيير توفره، والتعامل مع طلباته المعيّنة فقط.

حالات الطلب

Plain Text


export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'received'
  | 'in_delivery'
  | 'completed'
  | 'cancelled'
  | 'false_order';



الانتقالات المسموحة:

من
إلى
من ينفذها
pending
assigned
admin أو supervisor
assigned
received
الكابتن المعيّن فقط
received
in_delivery
الكابتن المعيّن فقط
in_delivery
completed
الكابتن المعيّن فقط
pending أو assigned أو received أو in_delivery
cancelled
admin أو supervisor مع سبب إلزامي
assigned أو received أو in_delivery
false_order
الكابتن المعيّن فقط




completed وcancelled وfalse_order حالات نهائية. لا يوجد انتقال منها في النسخة الأولى.

نموذج الطلب

Plain Text


export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  fee: number;
  status: OrderStatus;
  assignedCaptainId: string | null;
  createdByUserId: string;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}



توفر الكابتن

Plain Text


export type CaptainAvailability = 'available' | 'unavailable';



لا يمكن تعيين طلب جديد إلا لكابتن متاح. التحقق النهائي لاحقاً يجب أن يحدث في Supabase RPC وليس في الواجهة فقط.

الحسابات المالية

Plain Text


export interface OrderFinancialBreakdown {
  orderId: string;
  orderFee: number;
  captainEarnings: number;
  companyProfit: number;
  adjustmentAmount: number;
}



القواعد:

•
completed: captainEarnings = 70% من fee؛ companyProfit = 30% من fee؛ adjustmentAmount = 0.

•
false_order: captainEarnings = 70% من fee؛ companyProfit = 0؛ adjustmentAmount = 30% من fee.

•
cancelled أو الطلبات غير النهائية: القيم كلها = 0.

•
لا تستخدم floating point خام للحسابات؛ استعمل قيمة مقربة إلى منزلتين عشريتين عبر دالة موحدة.

دوال النطاق المطلوب بناؤها

1.
canTransitionOrder(actor, order, nextStatus): TransitionResult

2.
transitionOrder(order, actor, nextStatus, options?): DeliveryOrder

3.
calculateOrderFinancials(order): OrderFinancialBreakdown

4.
summarizeCaptainEarnings(orders, captainId): EarningsSummary

5.
summarizeCompanyProfit(orders): CompanyProfitSummary

6.
can(role, permission): boolean

7.
canAssignCaptain(actor, captainAvailability): boolean

لا تعتمد هذه الدوال على React أو Supabase؛ يجب أن تكون Pure Functions قابلة للاختبار.

طبقة البيانات

استخدم Interfaces حتى لا ترتبط الشاشات بـSupabase مباشرة:

Plain Text


export interface AuthRepository {
  getCurrentSession(): Promise<AppSession | null>;
  signIn(email: string, password: string): Promise<AppSession>;
  signOut(): Promise<void>;
}

export interface OrdersRepository {
  listOrders(filters?: OrderFilters): Promise<DeliveryOrder[]>;
  getOrder(id: string): Promise<DeliveryOrder | null>;
  createOrder(input: CreateOrderInput): Promise<DeliveryOrder>;
  changeOrderStatus(input: ChangeOrderStatusInput): Promise<DeliveryOrder>;
}

export interface UsersRepository {
  getProfile(userId: string): Promise<UserProfile | null>;
  listCaptains(): Promise<CaptainProfile[]>;
  setCaptainAvailability(status: CaptainAvailability): Promise<void>;
}



مرحلة React تستخدم Repository Mock داخل الذاكرة. لاحقاً نستبدله بـSupabase implementation من دون تعديل الشاشات أو دوال النطاق.

Supabase Preparations

•
أضف .env.example فقط، من دون مفاتيح حقيقة:

Plain Text


EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=



•
أضف @supabase/supabase-js فقط إذا وافق صاحب المشروع صراحة في المهمة.

•
أنشئ ملف src/data/supabase/supabaseClient.ts لا يتصل إذا مفاتيح البيئة فارغة، ويعطي خطأ واضحاً عند استدعائه قبل الإعداد.

•
لا تضع SERVICE_ROLE_KEY أو JWT signing secret أو كلمات مرور في Expo أو .env.example أو Git.

•
لا تنشئ مشروع Supabase أو migrations أو Auth فعلياً قبل أن يقدّم صاحب المشروع مفاتيح مشروعه أو يطلب إنشاؤه.

الاختبارات المطلوبة

اكتب اختبارات لدوال المنطق، تغطي على الأقل:

1.
الكابتن لا يستطيع إسناد طلب.

2.
الكابتن غير المعيّن لا يستطيع نقل حالة الطلب.

3.
لا يمكن الانتقال من completed إلى أي حالة.

4.
الإلغاء يحتاج سبباً من admin أو supervisor.

5.
completed يحسب 70/30.

6.
false_order يحسب 70 للكابتن و0 للشركة و30 كتسوية.

حدود هذه المرحلة

مسموح: Types، Pure Functions، Repositories Contracts، Mock Repositories، Hooks منطقية، ملف بيئة مثال، Supabase Client Skeleton، واختبارات.

ممنوع: Dashboards، Tabs، Screens نهائية، تصميمات من تلقاء الوكيل، خرائط، إشعارات، دفع، تسجيل دخول فعلي، أو migrations فعلية قبل مهمة صريحة لاحقة.

