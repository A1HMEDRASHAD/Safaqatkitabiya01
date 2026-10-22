import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Printer,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  Clock,
  Truck,
  MapPin,
  Phone,
  User
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useStore } from "../../components/Layout";

export default function ElectronicInvoicePage() {
  const router = useRouter();
  const { id } = router.query;
  const { settings } = useStore();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchInvoice() {
      setLoading(true);
      try {
        const orderRef = doc(db, "orders", id);
        const snap = await getDoc(orderRef);
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
        } else {
          setOrder(null);
        }
      } catch (e) {
        console.error("خطأ في جلب الفاتورة:", e);
      }
      setLoading(false);
    }

    fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="py-12 max-w-2xl mx-auto">
        <div className="bg-white rounded-one-ui-lg p-8 h-96 animate-pulse border border-gray-100" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-white rounded-one-ui-lg p-12 text-center border border-gray-100 shadow-card my-8 max-w-xl mx-auto">
        <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h2 className="font-extrabold text-base text-brand-black">
          لم يتم العثور على الفاتورة المطلوبة
        </h2>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 rounded-full bg-brand-black text-white text-xs font-extrabold"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للمتجر</span>
        </Link>
      </div>
    );
  }

  // إرسال تفاصيل الفاتورة أو تعجيل الطلب عبر واتساب الدار
  const sendInvoiceToWhatsApp = () => {
    const cleanPhone = (settings.whatsappNumber || "").replace(/[^0-9]/g, "");
    const itemsText = (order.items || [])
      .map((i) => `- ${i.title} (الكمية: ${i.quantity})`)
      .join("\n");

    const message = `مرحباً دار صفقات كتابية،
أود تأكيد / متابعة طلبي المسجل لديكم:
رقم الفاتورة والطلب: #${order.orderNumber}
الاسم: ${order.customerName}
الهاتف: ${order.customerPhone}
العنوان: ${order.customerCity} - ${order.customerAddress}

المنتجات المطلوبة:
${itemsText}

الإجمالي النهائي: ${order.totalAmount} ج.م`;

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* شريط الأزرار العلوي (يختفي تلقائياً عند الطباعة أو حفظ الـ PDF) */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للمتجر</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-full bg-brand-black text-white text-xs font-extrabold flex items-center gap-2 hover:bg-gray-800 transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة / حفظ كـ PDF</span>
          </button>

          <button
            type="button"
            onClick={sendInvoiceToWhatsApp}
            className="px-4 py-2.5 rounded-full bg-emerald-600 text-white text-xs font-extrabold flex items-center gap-2 hover:bg-emerald-700 transition shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>تأكيد / تعجيل عبر واتساب</span>
          </button>
        </div>
      </div>

      {/* جسم الفاتورة الإلكترونية الرسمية */}
      <div className="bg-white rounded-one-ui-lg p-6 sm:p-10 border border-gray-200/80 shadow-card space-y-8">
        {/* ترويسة الفاتورة: الشعار واسم الدار ورقم العملية المميز */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-14 px-3.5 rounded-2xl bg-brand-black flex items-center justify-center">
              {settings.logoUrl && (
                <img
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  className="h-11 w-auto object-contain"
                />
              )}
            </div>
            <div>
              <h1 className="text-lg font-black text-brand-black">
                {settings.storeName || "دار صفقات كتابية"}
              </h1>
              <p className="text-xs text-gray-500 font-bold">
                فاتورة مشتريات إلكترونية رسمية
              </p>
            </div>
          </div>

          <div className="text-right sm:text-left space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-brand-lightRed text-brand-red text-xs font-black">
              <span>رقم العملية: #{order.orderNumber}</span>
            </div>
            <p className="text-xs text-gray-500 font-bold block">
              تاريخ الإصدار:{" "}
              {order.createdAt
                ? new Date(order.createdAt).toLocaleString("ar-EG")
                : "-"}
            </p>
          </div>
        </div>

        {/* حالة الطلب وبيانات العميل */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
          <div className="space-y-1.5">
            <p className="text-gray-400 font-extrabold">بيانات العميل والمستلم</p>
            <p className="font-extrabold text-sm text-brand-black flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand-red" />
              <span>{order.customerName}</span>
            </p>
            <p className="text-gray-600 font-bold flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>{order.customerPhone}</span>
            </p>
            <p className="text-gray-600 font-bold flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>
                {order.customerCity} - {order.customerAddress}
              </span>
            </p>
          </div>

          <div className="space-y-1.5 sm:text-left">
            <p className="text-gray-400 font-extrabold">حالة الطلب والدفع</p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-extrabold">
              {order.status === "completed" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : order.status === "shipping" ? (
                <Truck className="w-3.5 h-3.5 text-blue-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{order.statusLabel || "تحت المراجعة"}</span>
            </div>
            <p className="text-gray-600 font-bold block mt-1">
              طريقة الدفع:{" "}
              {order.paymentMethod === "online"
                ? "دفع إلكتروني عبر المنصة"
                : "تأكيد عبر واتساب / عند الاستلام"}
            </p>
            {order.notes && (
              <p className="text-gray-500">ملاحظات: {order.notes}</p>
            )}
          </div>
        </div>

        {/* جدول الكتب والمنتجات المطلوبة */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 text-xs text-gray-500 font-extrabold">
                <th className="py-3 px-2">الكتاب / المنتج</th>
                <th className="py-3 px-2 text-center">سعر النسخة</th>
                <th className="py-3 px-2 text-center">الكمية</th>
                <th className="py-3 px-2 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
              {(order.items || []).map((item, idx) => (
                <tr key={idx}>
                  <td className="py-3.5 px-2 font-extrabold text-brand-black">
                    {item.title}
                    {item.authorName && (
                      <span className="block text-[11px] text-gray-400 font-medium">
                        {item.authorName}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-2 text-center font-bold text-gray-700">
                    {item.price} ج.م
                  </td>
                  <td className="py-3.5 px-2 text-center font-extrabold">
                    {item.quantity}
                  </td>
                  <td className="py-3.5 px-2 text-left font-black text-brand-black">
                    {Number(item.price) * Number(item.quantity)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* الملخص المالي للفاتورة */}
        <div className="border-t border-gray-200 pt-5 flex flex-col items-end space-y-2 text-xs sm:text-sm">
          <div className="w-full sm:w-72 flex justify-between text-gray-600 font-bold">
            <span>المجموع الفرعي:</span>
            <span>{order.subtotal} ج.م</span>
          </div>

          {order.discountAmount > 0 && (
            <div className="w-full sm:w-72 flex justify-between text-emerald-700 font-extrabold">
              <span>الخصم ({order.couponCode || "عرض"}):</span>
              <span>- {order.discountAmount} ج.م</span>
            </div>
          )}

          <div className="w-full sm:w-72 flex justify-between text-gray-600 font-bold">
            <span>رسوم الشحن والتوصيل:</span>
            <span>
              {Number(order.shippingCost) === 0
                ? "مجاني"
                : `${order.shippingCost} ج.م`}
            </span>
          </div>

          <div className="w-full sm:w-72 pt-3 border-t border-gray-200 flex justify-between items-baseline text-base font-black text-brand-black">
            <span>الإجمالي النهائي:</span>
            <span className="text-xl text-brand-red">
              {order.totalAmount} ج.م
            </span>
          </div>
        </div>

        {/* تذييل الفاتورة */}
        <div className="pt-6 border-t border-gray-100 text-center text-xs text-gray-400 font-bold">
          <p>شكراً لاختياركم {settings.storeName || "دار صفقات كتابية للنشر والتوزيع"}</p>
          <p className="mt-0.5">
            هذه الفاتورة مسجلة إلكترونياً برقم مرجعي #{order.orderNumber}
          </p>
        </div>
      </div>
    </div>
  );
}
