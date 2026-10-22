import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Ticket,
  Truck,
  CreditCard,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  Sparkles,
  FileText
} from "lucide-react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  increment,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db, generateOrderId } from "../lib/firebase";
import { useStore } from "../components/Layout";

export default function CartPage() {
  const router = useRouter();
  const {
    user,
    cart,
    removeFromCart,
    updateCartQty,
    clearCart,
    cartTotal,
    settings,
    showToast
  } = useStore();

  // حالات كود الخصم (الكوبون)
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // بيانات الشحن للعميل
  const [customerName, setCustomerName] = useState(user?.displayName || "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  // طريقة الدفع المختارة: whatsapp | online
  const [paymentMethod, setPaymentMethod] = useState("whatsapp");
  const [submitting, setSubmitting] = useState(false);

  // حساب الشحن المجاني
  const freeThreshold = Number(settings.freeShippingThreshold || 500);
  const baseShipping = Number(settings.shippingCost || 50);
  const remainingForFreeShipping = Math.max(0, freeThreshold - cartTotal);
  const freeShippingProgress = Math.min(
    100,
    Math.round((cartTotal / (freeThreshold || 1)) * 100)
  );

  // حساب قيمة الخصم بناءً على نوع العرض المضاف من الإدارة
  let discountAmount = 0;
  let isFreeShippingCoupon = false;

  if (appliedCoupon && cart.length > 0) {
    if (appliedCoupon.type === "percent") {
      discountAmount = Math.round(
        (cartTotal * Number(appliedCoupon.value || 0)) / 100
      );
    } else if (appliedCoupon.type === "fixed") {
      discountAmount = Math.min(cartTotal, Number(appliedCoupon.value || 0));
    } else if (appliedCoupon.type === "free_book") {
      // عرض نسخة مجانية: يخصم سعر أقل كتاب في السلة عند شراء كتابين أو أكثر
      const totalItemsCount = cart.reduce((sum, i) => sum + i.quantity, 0);
      if (totalItemsCount >= 2) {
        const prices = cart.map((i) => Number(i.finalPrice || i.price || 0));
        discountAmount = Math.min(...prices);
      }
    } else if (appliedCoupon.type === "free_shipping") {
      isFreeShippingCoupon = true;
    }
  }

  const shippingCost =
    cartTotal >= freeThreshold || isFreeShippingCoupon || cart.length === 0
      ? 0
      : baseShipping;

  const finalTotal = Math.max(0, cartTotal - discountAmount + shippingCost);

  // التحقق من كود الخصم من قاعدة بيانات Firebase
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    setCouponLoading(true);
    try {
      const q = query(
        collection(db, "coupons"),
        where("code", "==", code),
        where("active", "==", true)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast("كود الخصم غير صحيح أو انتهت صلاحيته", "error");
        setAppliedCoupon(null);
      } else {
        const couponData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (
          couponData.type === "free_book" &&
          cart.reduce((s, i) => s + i.quantity, 0) < 2
        ) {
          showToast("هذا العرض يتطلب وجود كتابين على الأقل في السلة", "error");
        } else {
          setAppliedCoupon(couponData);
          showToast(`تم تفعيل العرض (${couponData.code}) بنجاح`);
        }
      }
    } catch (error) {
      console.error("خطأ في فحص الكوبون:", error);
      showToast("تعذر التحقق من الكود حالياً", "error");
    }
    setCouponLoading(false);
  };

  // دالة الاتصال ببوابة Paymob إذا اختار العميل الدفع الإلكتروني
  const initiatePaymobPayment = async (orderDocId, orderData) => {
    if (!settings.paymentApiKey || !settings.paymentIntegrationId) {
      return null;
    }
    try {
      // 1. طلب رمز المصادقة (Auth Token) من Paymob
      const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: settings.paymentApiKey })
      });
      const authData = await authRes.json();
      if (!authData.token) return null;

      // 2. تسجيل الطلب في Paymob
      const orderRes = await fetch(
        "https://accept.paymob.com/api/ecommerce/orders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_token: authData.token,
            delivery_needed: "false",
            amount_cents: Math.round(orderData.totalAmount * 100).toString(),
            currency: "EGP",
            merchant_order_id: orderData.orderNumber,
            items: []
          })
        }
      );
      const registeredOrder = await orderRes.json();
      if (!registeredOrder.id) return null;

      // 3. توليد مفتاح الدفع للعميل (Payment Key)
      const nameParts = orderData.customerName.trim().split(" ");
      const firstName = nameParts[0] || "Customer";
      const lastName = nameParts.slice(1).join(" ") || "Safaqat";

      const keyRes = await fetch(
        "https://accept.paymob.com/api/acceptance/payment_keys",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_token: authData.token,
            amount_cents: Math.round(orderData.totalAmount * 100).toString(),
            expiration: 3600,
            order_id: registeredOrder.id,
            billing_data: {
              apartment: "NA",
              email: orderData.userEmail || "customer@safaqat.com",
              floor: "NA",
              first_name: firstName,
              street: orderData.customerAddress,
              building: "NA",
              phone_number: orderData.customerPhone,
              shipping_method: "NA",
              postal_code: "NA",
              city: orderData.customerCity || "Cairo",
              country: "EG",
              last_name: lastName,
              state: "NA"
            },
            currency: "EGP",
            integration_id: Number(settings.paymentIntegrationId)
          })
        }
      );
      const keyData = await keyRes.json();
      if (keyData.token && settings.paymentIframeId) {
        return `https://accept.paymob.com/api/acceptance/iframes/${settings.paymentIframeId}?payment_token=${keyData.token}`;
      }
      return null;
    } catch (e) {
      console.error("خطأ في بوابة الدفع:", e);
      return null;
    }
  };

  // إتمام الطلب وحفظ الفاتورة وتحديث المخزون والإحصائيات
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      showToast("يرجى إدخال الاسم ورقم الهاتف والعنوان بالتفصيل", "error");
      return;
    }

    setSubmitting(true);
    try {
      const orderNumber = generateOrderId(); // يبدأ بـ SK متبوعاً بـ 10 أرقام

      const orderPayload = {
        orderNumber,
        userId: user ? user.uid : "guest",
        userEmail: user?.email ? user.email.toLowerCase().trim() : "guest",
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerCity: customerCity.trim(),
        customerAddress: customerAddress.trim(),
        notes: orderNotes.trim(),
        items: cart.map((item) => ({
          id: item.id,
          title: item.title,
          authorName: item.authorName || "",
          price: Number(item.finalPrice || item.price || 0),
          quantity: Number(item.quantity),
          coverUrl: item.coverUrl || ""
        })),
        subtotal: cartTotal,
        discountAmount,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        shippingCost,
        totalAmount: finalTotal,
        paymentMethod,
        status: "pending",
        statusLabel: "تحت المراجعة",
        createdAt: new Date().toISOString()
      };

      // 1. حفظ الطلب في سجل الطلبات بقاعدة البيانات
      const docRef = await addDoc(collection(db, "orders"), orderPayload);

      // 2. إنقاص المخزون وزيادة عداد النسخ المباعة لكل كتاب في الطلب
      for (const item of cart) {
        try {
          const prodRef = doc(db, "products", item.id);
          await updateDoc(prodRef, {
            stock: increment(-Number(item.quantity)),
            soldCount: increment(Number(item.quantity))
          });
        } catch (stockErr) {
          console.warn("تنبيه أثناء تحديث مخزون المنتج:", stockErr);
        }
      }

      // 3. تفريغ السلة بعد نجاح التسجيل
      clearCart();
      showToast(`تم تسجيل طلبك بنجاح رقم #${orderNumber}`);

      // 4. التوجيه حسب طريقة الدفع
      if (paymentMethod === "online" && settings.enableOnlinePayment) {
        const payUrl = await initiatePaymobPayment(docRef.id, orderPayload);
        if (payUrl) {
          window.location.href = payUrl;
          return;
        }
      }

      // التوجيه المباشر لصفحة الفاتورة الإلكترونية
      router.push(`/invoice/${docRef.id}`);
    } catch (error) {
      console.error("خطأ أثناء إتمام الطلب:", error);
      showToast("حدث خطأ أثناء تسجيل الطلب، يرجى المحاولة مجدداً", "error");
    }
    setSubmitting(false);
  };

  if (cart.length === 0) {
    return (
      <div className="bg-white rounded-one-ui-lg p-12 text-center border border-gray-100 shadow-card my-6">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="font-extrabold text-lg text-brand-black">
          سلة المشتريات فارغة حالياً
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          تصفح أحدث إصدارات دار صفقات كتابية وأضف كتبك المفضلة للسلة
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-full bg-brand-black text-white text-xs font-extrabold hover:bg-brand-red transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لتصفح المتجر</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* شريط الشحن المجاني التحفيزي */}
      <div className="bg-white rounded-one-ui p-4 border border-gray-100 shadow-card">
        <div className="flex items-center justify-between text-xs font-extrabold mb-2">
          <div className="flex items-center gap-2 text-brand-black">
            <Truck className="w-4 h-4 text-brand-red" />
            {remainingForFreeShipping === 0 || isFreeShippingCoupon ? (
              <span className="text-emerald-700">
                تهانينا! طلبك مؤهل للحصول على شحن مجاني
              </span>
            ) : (
              <span>
                أضف منتجات بقيمة{" "}
                <span className="text-brand-red">
                  {remainingForFreeShipping} ج.م
                </span>{" "}
                للحصول على شحن مجاني!
              </span>
            )}
          </div>
          <span className="text-gray-400">{freeShippingProgress}%</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-red rounded-full transition-all duration-500"
            style={{ width: `${freeShippingProgress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* قائمة الكتب والمنتجات في السلة */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-one-ui-lg p-5 border border-gray-100 shadow-card space-y-4">
            <h2 className="font-extrabold text-base flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-brand-red" />
              <span>محتويات السلة ({cart.length})</span>
            </h2>

            <div className="divide-y divide-gray-100">
              {cart.map((item) => {
                const unitPrice = Number(item.finalPrice || item.price || 0);
                return (
                  <div
                    key={item.id}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 flex-1">
                      <Link href={`/product/${item.id}`}>
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          className="w-16 h-22 object-cover rounded-2xl bg-gray-100 border border-gray-100 shrink-0"
                        />
                      </Link>
                      <div className="space-y-1">
                        <Link href={`/product/${item.id}`}>
                          <h3 className="font-extrabold text-sm text-brand-black line-clamp-1 hover:text-brand-red">
                            {item.title}
                          </h3>
                        </Link>
                        {item.authorName && (
                          <p className="text-xs text-gray-500">
                            {item.authorName}
                          </p>
                        )}
                        <p className="text-sm font-black text-brand-red">
                          {unitPrice * item.quantity} ج.م{" "}
                          <span className="text-[11px] font-medium text-gray-400">
                            ({unitPrice} ج.م للنسخة)
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* التحكم بالكمية والحذف */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-full border border-gray-200">
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQty(item.id, item.quantity - 1)
                          }
                          className="p-1 rounded-full hover:bg-gray-200 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-extrabold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateCartQty(item.id, item.quantity + 1)
                          }
                          className="p-1 rounded-full hover:bg-gray-200 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* خانة كود الخصم والعروض الترويجية */}
          <div className="bg-white rounded-one-ui p-5 border border-gray-100 shadow-card">
            <h3 className="text-xs font-extrabold text-gray-700 mb-3 flex items-center gap-1.5">
              <Ticket className="w-4 h-4 text-brand-red" />
              <span>هل لديك كود خصم أو عرض ترويجي؟</span>
            </h3>
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input
                type="text"
                placeholder="أدخل الكود هنا (مثال: SAFAQAT20)"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold uppercase focus:outline-none focus:border-brand-red"
              />
              <button
                type="submit"
                disabled={couponLoading}
                className="px-5 py-3 rounded-2xl bg-brand-black text-white text-xs font-extrabold hover:bg-brand-red transition shrink-0"
              >
                {couponLoading ? "جاري الفحص..." : "تطبيق الكود"}
              </button>
            </form>

            {appliedCoupon && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-800">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>
                    تم تفعيل الكود ({appliedCoupon.code}) — خصم {discountAmount}{" "}
                    ج.م
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                  }}
                  className="text-red-600 text-[11px] font-extrabold"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>

        {/* نموذج بيانات التوصيل وطرق الدفع وملخص الفاتورة */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleCheckout}
            className="bg-white rounded-one-ui-lg p-5 sm:p-6 border border-gray-100 shadow-card space-y-5"
          >
            <h2 className="font-extrabold text-base border-b border-gray-100 pb-3">
              بيانات الاستلام وإتمام الطلب
            </h2>

            <div className="space-y-3">
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="الاسم الثلاثي للمستلم *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
                />
              </div>

              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                <input
                  type="tel"
                  required
                  placeholder="رقم الهاتف / الواتساب للتواصل *"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
                />
              </div>

              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="المحافظة / المدينة *"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
                />
              </div>

              <textarea
                rows={2}
                required
                placeholder="العنوان التفصيلي (المنطقة، الشارع، رقم العقار أو علامة مميزة) *"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
              />

              <input
                type="text"
                placeholder="ملاحظات إضافية مع الطلب (اختياري)"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
              />
            </div>

            {/* اختيار وسيلة الدفع */}
            <div className="space-y-2.5 pt-2">
              <p className="text-xs font-extrabold text-gray-700">
                اختر وسيلة الدفع المفضلة:
              </p>

              <label
                onClick={() => setPaymentMethod("whatsapp")}
                className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                  paymentMethod === "whatsapp"
                    ? "border-brand-black bg-gray-50"
                    : "border-gray-200 hover:bg-gray-50/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-xs font-extrabold text-brand-black">
                      إصدار الفاتورة وتأكيد الدفع عبر واتساب / عند الاستلام
                    </p>
                    <p className="text-[11px] text-gray-500">
                      مناسب للتحويل عبر إنستاباي، فودافون كاش، أو الدفع عند التوصيل
                    </p>
                  </div>
                </div>
                <CheckCircle2
                  className={`w-5 h-5 ${
                    paymentMethod === "whatsapp"
                      ? "text-brand-black"
                      : "text-gray-300"
                  }`}
                />
              </label>

              {settings.enableOnlinePayment && (
                <label
                  onClick={() => setPaymentMethod("online")}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
                    paymentMethod === "online"
                      ? "border-brand-red bg-brand-lightRed/40"
                      : "border-gray-200 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-brand-red" />
                    <div>
                      <p className="text-xs font-extrabold text-brand-black">
                        الدفع الإلكتروني المباشر (بطاقات بنكية / محافظ / تقسيط)
                      </p>
                      <p className="text-[11px] text-gray-500">
                        فيزا، ماستركارد، مدى، فودافون كاش، وتقسيط عبر بوابة الدفع
                      </p>
                    </div>
                  </div>
                  <CheckCircle2
                    className={`w-5 h-5 ${
                      paymentMethod === "online"
                        ? "text-brand-red"
                        : "text-gray-300"
                    }`}
                  />
                </label>
              )}
            </div>

            {/* ملخص الحساب النهائي */}
            <div className="p-4 rounded-2xl bg-brand-surface space-y-2 text-xs">
              <div className="flex justify-between text-gray-600 font-bold">
                <span>المجموع الفرعي للكتب:</span>
                <span>{cartTotal} ج.م</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-extrabold">
                  <span>قيمة الخصم ({appliedCoupon?.code}):</span>
                  <span>- {discountAmount} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600 font-bold">
                <span>رسوم التوصيل والشحن:</span>
                <span>
                  {shippingCost === 0 ? (
                    <span className="text-emerald-700 font-extrabold">
                      مجاني
                    </span>
                  ) : (
                    `${shippingCost} ج.م`
                  )}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline text-sm font-black text-brand-black">
                <span>الإجمالي النهائي المطلوب:</span>
                <span className="text-lg text-brand-red">
                  {finalTotal} ج.م
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 px-6 rounded-2xl bg-brand-black hover:bg-brand-red text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <FileText className="w-5 h-5" />
              <span>
                {submitting
                  ? "جاري تسجيل الطلب وإصدار الفاتورة..."
                  : "تأكيد الطلب وإصدار الفاتورة الإلكترونية"}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
