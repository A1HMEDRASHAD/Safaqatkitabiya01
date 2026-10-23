import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  Settings,
  Ticket,
  Users,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  Plus,
  Trash2,
  Search,
  MessageCircle,
  FileText,
  Sparkles,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useStore } from "../../components/Layout";

export default function AdminDashboard() {
  const router = useRouter();
  const {
    user,
    roleInfo,
    authLoading,
    settings,
    refreshSettings,
    showToast
  } = useStore();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // البيانات الأساسية
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // فلاتر البحث في الطلبات والمنتجات
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");

  // نموذج إضافة كود خصم أو عرض جديد
  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState("percent"); // percent | fixed | free_shipping | free_book
  const [couponValue, setCouponValue] = useState("");

  // نموذج إضافة موظف جديد
  const [staffEmail, setStaffEmail] = useState("");
  const [staffTitle, setStaffTitle] = useState("مسؤول طلبات ومحتوى");

  // إعدادات المتجر العامة وبوابات الدفع
  const [storeConfig, setStoreConfig] = useState(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  // حماية الصفحة: السماح فقط للإدارة العليا والموظفين المعتمدين
  useEffect(() => {
    if (!authLoading) {
      if (!user || (!roleInfo.isAdmin && !roleInfo.isStaff)) {
        router.push("/");
      }
    }
  }, [user, roleInfo, authLoading, router]);

  useEffect(() => {
    setStoreConfig(settings);
  }, [settings]);

  // جلب كافة بيانات لوحة التحكم من Firebase
  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const [ordersSnap, productsSnap, authorsSnap, couponsSnap, staffSnap] =
        await Promise.all([
          getDocs(collection(db, "orders")),
          getDocs(collection(db, "products")),
          getDocs(collection(db, "authors")),
          getDocs(collection(db, "coupons")),
          getDocs(collection(db, "staff"))
        ]);

      const ordersData = ordersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      ordersData.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      const productsData = productsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      productsData.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setOrders(ordersData);
      setProducts(productsData);
      setAuthors(authorsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCoupons(couponsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setStaffList(staffSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("خطأ في جلب بيانات لوحة الإدارة:", error);
      showToast("تعذر تحميل بعض البيانات، تأكد من الاتصال", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && (roleInfo.isAdmin || roleInfo.isStaff)) {
      fetchAllAdminData();
    }
  }, [user, roleInfo]);

  // حسابات الإحصائيات الذكية
  const stats = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== "cancelled");
    const totalRevenue = activeOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount || 0),
      0
    );
    const pendingOrdersCount = orders.filter(
      (o) => !o.status || o.status === "pending"
    ).length;

    const topSelling = [...products]
      .sort((a, b) => Number(b.soldCount || 0) - Number(a.soldCount || 0))
      .slice(0, 5);

    const lowStock = products.filter(
      (p) => p.archived !== true && Number(p.stock ?? 10) <= 3
    );

    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingOrdersCount,
      totalProducts: products.length,
      totalAuthors: authors.length,
      topSelling,
      lowStock
    };
  }, [orders, products, authors]);

  // فلترة الطلبات بالبحث والحالة
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesStatus =
        orderStatusFilter === "all" ||
        (o.status || "pending") === orderStatusFilter;

      const q = orderSearch.trim().toLowerCase();
      if (!q) return matchesStatus;

      const numMatch = (o.orderNumber || "").toLowerCase().includes(q);
      const nameMatch = (o.customerName || "").toLowerCase().includes(q);
      const phoneMatch = (o.customerPhone || "").toLowerCase().includes(q);

      return matchesStatus && (numMatch || nameMatch || phoneMatch);
    });
  }, [orders, orderSearch, orderStatusFilter]);

  // فلترة المنتجات في إدارة المخزون
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.title || "").toLowerCase().includes(q) ||
        (p.authorName || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // 1. دوال إدارة الطلبات
  const handleStatusChange = async (orderId, newStatus) => {
    const statusMap = {
      pending: "تحت المراجعة",
      shipping: "جاري التوصيل",
      completed: "تم التسليم",
      cancelled: "ملغي"
    };
    const newLabel = statusMap[newStatus] || "تحت المراجعة";

    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        statusLabel: newLabel
      });
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus, statusLabel: newLabel } : o
        )
      );
      showToast(`تم تحديث حالة الطلب إلى: ${newLabel}`);
    } catch (e) {
      showToast("حدث خطأ أثناء تحديث حالة الطلب", "error");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!roleInfo.isAdmin) {
      showToast("حذف الطلبات متاح للإدارة العليا فقط", "error");
      return;
    }
    if (!window.confirm("هل أنت متأكد من حذف هذا الطلب نهائياً؟")) return;
    try {
      await deleteDoc(doc(db, "orders", orderId));
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      showToast("تم حذف الطلب");
    } catch (e) {
      showToast("تعذر حذف الطلب", "error");
    }
  };

  const notifyCustomerWhatsApp = (order) => {
    const cleanPhone = (order.customerPhone || "").replace(/[^0-9]/g, "");
    const msg = `مرحباً أستاذ/ة ${order.customerName}، بخصوص طلبك رقم (#${order.orderNumber}) من دار صفقات كتابية، نود إبلاغك بأن حالة طلبك الحالية هي: (${order.statusLabel || "تحت المراجعة"}). شكراً لثقتك بنا!`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // 2. دوال التعديل السريع على المخزون والمنتجات
  const handleQuickProductUpdate = async (productId, field, value) => {
    try {
      await updateDoc(doc(db, "products", productId), {
        [field]: value
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, [field]: value } : p))
      );
      showToast("تم تحديث بيانات المنتج");
    } catch (e) {
      showToast("فشل تحديث المنتج", "error");
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الإصدار نهائياً؟")) return;
    try {
      await deleteDoc(doc(db, "products", productId));
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      showToast("تم حذف المنتج نهائياً");
    } catch (e) {
      showToast("تعذر حذف المنتج", "error");
    }
  };

  // 3. دوال الكوبونات والعروض
  const handleAddCoupon = async (e) => {
    e.preventDefault();
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) {
      showToast("يرجى كتابة كود الخصم", "error");
      return;
    }
    try {
      const newCoupon = {
        code: cleanCode,
        type: couponType,
        value:
          couponType === "free_shipping" || couponType === "free_book"
            ? 0
            : Number(couponValue || 0),
        active: true,
        createdAt: new Date().toISOString()
      };
      const ref = await addDoc(collection(db, "coupons"), newCoupon);
      setCoupons((prev) => [{ id: ref.id, ...newCoupon }, ...prev]);
      setCouponCode("");
      setCouponValue("");
      showToast(`تم إنشاء العرض (${cleanCode}) بنجاح`);
    } catch (e) {
      showToast("حدث خطأ أثناء إضافة الكوبون", "error");
    }
  };

  const toggleCouponActive = async (coupon) => {
    try {
      await updateDoc(doc(db, "coupons", coupon.id), {
        active: !coupon.active
      });
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c))
      );
      showToast("تم تحديث حالة الكوبون");
    } catch (e) {
      showToast("تعذر تحديث الكوبون", "error");
    }
  };

  const handleDeleteCoupon = async (id) => {
    try {
      await deleteDoc(doc(db, "coupons", id));
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      showToast("تم حذف الكوبون");
    } catch (e) {
      showToast("تعذر حذف الكوبون", "error");
    }
  };

  // 4. دوال إدارة الموظفين (للإدارة العليا فقط)
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!roleInfo.isAdmin) return;
    const cleanEmail = staffEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      const payload = {
        email: cleanEmail,
        title: staffTitle.trim() || "موظف",
        active: true,
        permissions: ["orders", "inventory", "add"],
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "staff", cleanEmail), payload);
      setStaffList((prev) => [
        ...prev.filter((s) => s.id !== cleanEmail),
        { id: cleanEmail, ...payload }
      ]);
      setStaffEmail("");
      showToast(`تمت إضافة الموظف (${cleanEmail}) بنجاح`);
    } catch (e) {
      showToast("تعذر إضافة الموظف", "error");
    }
  };

  const handleDeleteStaff = async (emailId) => {
    if (!roleInfo.isAdmin) return;
    try {
      await deleteDoc(doc(db, "staff", emailId));
      setStaffList((prev) => prev.filter((s) => s.id !== emailId));
      showToast("تم إلغاء صلاحية الموظف");
    } catch (e) {
      showToast("تعذر حذف الموظف", "error");
    }
  };

  // 5. حفظ إعدادات المتجر العامة ومفاتيح الدفع
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!roleInfo.isAdmin) {
      showToast("تعديل الإعدادات الحساسة متاح للإدارة العليا فقط", "error");
      return;
    }
    setSavingSettings(true);
    try {
      await setDoc(doc(db, "settings", "general"), storeConfig, { merge: true });
      await refreshSettings();
      showToast("تم حفظ إعدادات المتجر وتحديثها فوراً");
    } catch (e) {
      showToast("حدث خطأ أثناء حفظ الإعدادات", "error");
    }
    setSavingSettings(false);
  };

  if (authLoading || loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-brand-red animate-spin mx-auto" />
        <p className="text-sm font-extrabold text-gray-700">
          جاري تحميل مركز القيادة ولوحة التحكم...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-14">
      {/* الترويسة العلوية للوحة الإدارة */}
      <div className="bg-brand-black text-white rounded-one-ui-lg p-5 sm:p-6 shadow-glass flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-brand-red text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black">
              لوحة التحكم والإدارة — صفقات كتابية
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              مرحباً {user?.email} ({roleInfo.isAdmin ? "إدارة عليا شاملة" : "حساب موظف"})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Link
            href="/admin/add"
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full bg-brand-red hover:bg-brand-darkRed text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow"
          >
            <Plus className="w-4 h-4" />
            <span>رفع كتاب / إكسسوار / كاتب</span>
          </Link>

          <button
            type="button"
            onClick={fetchAllAdminData}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* شريط التبويبات بأسلوب One UI 9 */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {[
          { id: "dashboard", label: "الإحصائيات", icon: LayoutDashboard },
          {
            id: "orders",
            label: `الطلبات (${orders.length})`,
            icon: Package
          },
          {
            id: "inventory",
            label: `المخزون والكتب (${products.length})`,
            icon: BookOpen
          },
          {
            id: "coupons",
            label: `الكوبونات والعروض (${coupons.length})`,
            icon: Ticket
          },
          ...(roleInfo.isAdmin
            ? [
                { id: "staff", label: "الموظفون", icon: Users },
                { id: "settings", label: "الإعدادات والـ API", icon: Settings }
              ]
            : [])
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-full text-xs font-extrabold flex items-center gap-2 whitespace-nowrap transition-all shrink-0 ${
                active
                  ? "bg-brand-black text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200/80 hover:border-gray-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. تبويب الإحصائيات والنظرة العامة */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="bg-white p-5 rounded-one-ui border border-gray-100 shadow-card">
              <TrendingUp className="w-5 h-5 text-brand-red mb-2" />
              <p className="text-xs text-gray-500 font-bold">إجمالي المبيعات</p>
              <p className="text-xl sm:text-2xl font-black text-brand-black mt-1">
                {stats.totalRevenue} ج.م
              </p>
            </div>

            <div className="bg-white p-5 rounded-one-ui border border-gray-100 shadow-card">
              <Package className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-xs text-gray-500 font-bold">
                الطلبات (قيد المراجعة: {stats.pendingOrdersCount})
              </p>
              <p className="text-xl sm:text-2xl font-black text-brand-black mt-1">
                {stats.totalOrders} طلب
              </p>
            </div>

            <div className="bg-white p-5 rounded-one-ui border border-gray-100 shadow-card">
              <BookOpen className="w-5 h-5 text-emerald-600 mb-2" />
              <p className="text-xs text-gray-500 font-bold">إجمالي الإصدارات</p>
              <p className="text-xl sm:text-2xl font-black text-brand-black mt-1">
                {stats.totalProducts} منتج
              </p>
            </div>

            <div className="bg-white p-5 rounded-one-ui border border-gray-100 shadow-card">
              <Users className="w-5 h-5 text-blue-600 mb-2" />
              <p className="text-xs text-gray-500 font-bold">الكتّاب المسجلون</p>
              <p className="text-xl sm:text-2xl font-black text-brand-black mt-1">
                {stats.totalAuthors} كاتب
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* الأكثر مبيعاً */}
            <div className="bg-white p-5 rounded-one-ui-lg border border-gray-100 shadow-card space-y-3">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-red" />
                <span>الإصدارات الأكثر مبيعاً</span>
              </h3>
              {stats.topSelling.length === 0 ? (
                <p className="text-xs text-gray-400 py-4">لا توجد بيانات بعد</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stats.topSelling.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          className="w-9 h-12 object-cover rounded-lg bg-gray-100"
                        />
                        <div>
                          <p className="font-extrabold text-brand-black">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {item.authorName}
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-extrabold">
                        بيع: {item.soldCount || 0} نسخة
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* تنبيهات قرب نفاد المخزون */}
            <div className="bg-white p-5 rounded-one-ui-lg border border-gray-100 shadow-card space-y-3">
              <h3 className="text-sm font-extrabold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>تنبيهات المخزون المنخفض (3 نسخ أو أقل)</span>
              </h3>
              {stats.lowStock.length === 0 ? (
                <p className="text-xs text-emerald-600 font-bold py-4">
                  جميع الكتب متوفرة بكميات ممتازة في المخزون.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stats.lowStock.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <span className="font-extrabold text-brand-black">
                        {item.title}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-red-50 text-brand-red font-extrabold">
                        المتبقي: {item.stock ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. تبويب إدارة الطلبات والفواتير */}
      {activeTab === "orders" && (
        <div className="bg-white rounded-one-ui-lg p-5 border border-gray-100 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                placeholder="ابحث برقم العملية (SK...) أو اسم العميل أو رقم هاتفه..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
              />
            </div>

            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-extrabold"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">تحت المراجعة</option>
              <option value="shipping">جاري التوصيل</option>
              <option value="completed">تم التسليم</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 font-bold">
              لا توجد طلبات مطابقة للبحث.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl border border-gray-200/80 hover:border-gray-300 transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-brand-lightRed text-brand-red text-xs font-black">
                        #{order.orderNumber}
                      </span>
                      <span className="text-xs text-gray-400 font-bold">
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString("ar-EG")
                          : "-"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={order.status || "pending"}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value)
                        }
                        className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-extrabold focus:outline-none focus:border-brand-red"
                      >
                        <option value="pending">تحت المراجعة</option>
                        <option value="shipping">جاري التوصيل</option>
                        <option value="completed">تم التسليم</option>
                        <option value="cancelled">ملغي</option>
                      </select>

                      <Link
                        href={`/invoice/${order.id}`}
                        className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition"
                        title="عرض الفاتورة الإلكترونية"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => notifyCustomerWhatsApp(order)}
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                        title="مراسلة العميل عبر واتساب"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>

                      {roleInfo.isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition"
                          title="حذف الطلب"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 font-bold">العميل والهاتف</p>
                      <p className="font-extrabold text-brand-black">
                        {order.customerName} — {order.customerPhone}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-bold">العنوان</p>
                      <p className="font-bold text-gray-700">
                        {order.customerCity} - {order.customerAddress}
                      </p>
                    </div>
                    <div className="sm:text-left">
                      <p className="text-gray-400 font-bold">إجمالي الفاتورة</p>
                      <p className="text-base font-black text-brand-red">
                        {order.totalAmount} ج.م
                      </p>
                    </div>
                  </div>

                  {/* سطر الكتب المطلوبة */}
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                    {(order.items || []).map((item, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/70 text-[11px] font-bold text-gray-700"
                      >
                        {item.title} (×{item.quantity})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. تبويب إدارة المخزون والكتب السريع */}
      {activeTab === "inventory" && (
        <div className="bg-white rounded-one-ui-lg p-5 border border-gray-100 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                placeholder="ابحث عن كتاب أو كاتب لتعديل السعر أو المخزون فوراً..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
              />
            </div>

            <Link
              href="/admin/add"
              className="px-5 py-2.5 rounded-2xl bg-brand-black text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة إصدار جديد</span>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-extrabold">
                  <th className="py-3 px-2">الإصدار</th>
                  <th className="py-3 px-2">السعر النهائي (ج.م)</th>
                  <th className="py-3 px-2">المخزون المتاح</th>
                  <th className="py-3 px-2">الشارة</th>
                  <th className="py-3 px-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-bold">
                {filteredProducts.map((prod) => (
                  <tr key={prod.id} className="hover:bg-gray-50/70">
                    <td className="py-3 px-2 flex items-center gap-2.5">
                      <img
                        src={prod.coverUrl}
                        alt={prod.title}
                        className="w-10 h-14 object-cover rounded-lg bg-gray-100 shrink-0"
                      />
                      <div>
                        <p className="font-extrabold text-brand-black line-clamp-1">
                          {prod.title}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {prod.authorName || prod.category}
                        </p>
                      </div>
                    </td>

                    <td className="py-3 px-2">
                      <input
                        type="number"
                        defaultValue={prod.finalPrice || prod.price || 0}
                        onBlur={(e) =>
                          handleQuickProductUpdate(
                            prod.id,
                            "finalPrice",
                            Number(e.target.value)
                          )
                        }
                        className="w-20 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-center font-extrabold"
                      />
                    </td>

                    <td className="py-3 px-2">
                      <input
                        type="number"
                        defaultValue={prod.stock ?? 10}
                        onBlur={(e) =>
                          handleQuickProductUpdate(
                            prod.id,
                            "stock",
                            Number(e.target.value)
                          )
                        }
                        className="w-20 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-center font-extrabold"
                      />
                    </td>

                    <td className="py-3 px-2">
                      <input
                        type="text"
                        placeholder="بدون شارة"
                        defaultValue={prod.badgeText || ""}
                        onBlur={(e) =>
                          handleQuickProductUpdate(
                            prod.id,
                            "badgeText",
                            e.target.value.trim()
                          )
                        }
                        className="w-28 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs"
                      />
                    </td>

                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickProductUpdate(
                              prod.id,
                              "archived",
                              !prod.archived
                            )
                          }
                          className={`p-2 rounded-xl transition ${
                            prod.archived
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                          title={prod.archived ? "إظهار في المتجر" : "أرشفة وإخفاء"}
                        >
                          {prod.archived ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition"
                          title="حذف نهائي"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. تبويب الكوبونات والعروض الترويجية */}
      {activeTab === "coupons" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddCoupon}
            className="md:col-span-5 bg-white rounded-one-ui-lg p-5 border border-gray-100 shadow-card space-y-4 h-fit"
          >
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Ticket className="w-4 h-4 text-brand-red" />
              <span>إنشاء كود خصم أو عرض جديد</span>
            </h3>

            <div>
              <label className="text-xs font-bold text-gray-500">
                رمز الكوبون (مثال: SAFAQAT20)
              </label>
              <input
                type="text"
                required
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-black uppercase"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500">نوع العرض</label>
              <select
                value={couponType}
                onChange={(e) => setCouponType(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-extrabold"
              >
                <option value="percent">خصم نسبة مئوية (%)</option>
                <option value="fixed">خصم مبلغ ثابت (ج.م)</option>
                <option value="free_shipping">شحن مجاني بالكامل</option>
                <option value="free_book">
                  عرض كتاب مجاني (عند شراء كتابين أو أكثر)
                </option>
              </select>
            </div>

            {(couponType === "percent" || couponType === "fixed") && (
              <div>
                <label className="text-xs font-bold text-gray-500">
                  {couponType === "percent"
                    ? "نسبة الخصم (%)"
                    : "قيمة الخصم بالجنيه"}
                </label>
                <input
                  type="number"
                  required
                  value={couponValue}
                  onChange={(e) => setCouponValue(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-extrabold"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-brand-black hover:bg-brand-red text-white text-xs font-extrabold transition"
            >
              تفعيل وحفظ العرض
            </button>
          </form>

          <div className="md:col-span-7 bg-white rounded-one-ui-lg p-5 border border-gray-100 shadow-card space-y-3">
            <h3 className="font-extrabold text-sm">العروض والكوبونات النشطة</h3>
            {coupons.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                لا توجد كوبونات مضافة حالياً
              </p>
            ) : (
              <div className="space-y-2.5">
                {coupons.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/70 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-black text-sm text-brand-red">
                        {c.code}
                      </span>
                      <p className="text-xs text-gray-500 font-bold mt-0.5">
                        {c.type === "percent" && `خصم ${c.value}%`}
                        {c.type === "fixed" && `خصم ${c.value} ج.م`}
                        {c.type === "free_shipping" && "عرض شحن مجاني"}
                        {c.type === "free_book" && "عرض كتاب مجاني مع الطلب"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCouponActive(c)}
                        className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${
                          c.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {c.active ? "مفعّل" : "معطّل"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCoupon(c.id)}
                        className="p-2 rounded-xl text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. تبويب إدارة الموظفين (للإدارة العليا فقط) */}
      {activeTab === "staff" && roleInfo.isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <form
            onSubmit={handleAddStaff}
            className="md:col-span-5 bg-white rounded-one-ui-lg p-5 border border-gray-100 shadow-card space-y-4 h-fit"
          >
            <h3 className="font-extrabold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-red" />
              <span>إضافة موظف جديد للوحة التحكم</span>
            </h3>
            <div>
              <label className="text-xs font-bold text-gray-500">
                البريد الإلكتروني للموظف (Gmail)
              </label>
              <input
                type="email"
                required
                placeholder="staff@gmail.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">
                المسمى الوظيفي
              </label>
              <input
                type="text"
                value={staffTitle}
                onChange={(e) => setStaffTitle(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-brand-black hover:bg-brand-red text-white text-xs font-extrabold transition"
            >
              منح الصلاحية وإضافة الموظف
            </button>
          </form>

          <div className="md:col-span-7 bg-white rounded-one-ui-lg p-5 border border-gray-100 shadow-card space-y-3">
            <h3 className="font-extrabold text-sm">قائمة فريق العمل والموظفين</h3>
            {staffList.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                لم تتم إضافة موظفين فرعيين بعد (الإدارة العليا فقط نشطة)
              </p>
            ) : (
              <div className="space-y-2.5">
                {staffList.map((st) => (
                  <div
                    key={st.id}
                    className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-extrabold text-xs text-brand-black">
                        {st.email}
                      </p>
                      <p className="text-[11px] text-gray-500">{st.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(st.id)}
                      className="p-2 rounded-xl text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. تبويب الإعدادات الشاملة والـ API وبوابات الدفع */}
      {activeTab === "settings" && roleInfo.isAdmin && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white rounded-one-ui-lg p-6 border border-gray-100 shadow-card space-y-6 max-w-3xl"
        >
          <h3 className="font-extrabold text-base border-b border-gray-100 pb-3">
            هوية المتجر، الشعار، وإعدادات الأقسام
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600">
                اسم المتجر الرسمي
              </label>
              <input
                type="text"
                value={storeConfig.storeName || ""}
                onChange={(e) =>
                  setStoreConfig({ ...storeConfig, storeName: e.target.value })
                }
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600">
                رقم واتساب المتجر (مع كود الدولة بدون +)
              </label>
              <input
                type="text"
                placeholder="201000000000"
                value={storeConfig.whatsappNumber || ""}
                onChange={(e) =>
                  setStoreConfig({
                    ...storeConfig,
                    whatsappNumber: e.target.value
                  })
                }
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-600">
                رابط صورة الشعار (تستطيع تغييره في أي لحظة)
              </label>
              <input
                type="url"
                value={storeConfig.logoUrl || ""}
                onChange={(e) =>
                  setStoreConfig({ ...storeConfig, logoUrl: e.target.value })
                }
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600">
                تكلفة الشحن الأساسية (ج.م)
              </label>
              <input
                type="number"
                value={storeConfig.shippingCost ?? 50}
                onChange={(e) =>
                  setStoreConfig({
                    ...storeConfig,
                    shippingCost: Number(e.target.value)
                  })
                }
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600">
                الحد الأدنى للشحن المجاني (ج.م)
              </label>
              <input
                type="number"
                value={storeConfig.freeShippingThreshold ?? 500}
                onChange={(e) =>
                  setStoreConfig({
                    ...storeConfig,
                    freeShippingThreshold: Number(e.target.value)
                  })
                }
                className="w-full mt-1 px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold"
              />
            </div>
          </div>

          {/* زر إظهار أو إخفاء قسم القرطاسية والإكسسوارات */}
          <label className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-200 cursor-pointer">
            <div>
              <p className="text-xs font-extrabold text-brand-black">
                إظهار قسم القرطاسية والإكسسوارات للعملاء (المُبدّل العلوي)
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                عند إيقافه سيختفي زر القرطاسية من واجهة المتجر تماماً وتبقى مكتبة الكتب فقط
              </p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(storeConfig.showAccessories)}
              onChange={(e) =>
                setStoreConfig({
                  ...storeConfig,
                  showAccessories: e.target.checked
                })
              }
              className="w-5 h-5 accent-brand-red"
            />
          </label>

          {/* إعدادات بوابة الدفع الإلكتروني Paymob */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <label className="flex items-center justify-between p-4 rounded-2xl bg-brand-lightRed/50 border border-brand-red/20 cursor-pointer">
              <div>
                <p className="text-xs font-extrabold text-brand-black">
                  تفعيل بوابة الدفع الإلكتروني المباشر (Paymob API)
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  يدعم البطاقات البنكية، المحافظ الإلكترونية، والتقسيط
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(storeConfig.enableOnlinePayment)}
                onChange={(e) =>
                  setStoreConfig({
                    ...storeConfig,
                    enableOnlinePayment: e.target.checked
                  })
                }
                className="w-5 h-5 accent-brand-red"
              />
            </label>

            {storeConfig.enableOnlinePayment && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
                <div>
                  <label className="text-[11px] font-bold text-gray-500">
                    Paymob API Key
                  </label>
                  <input
                    type="text"
                    value={storeConfig.paymentApiKey || ""}
                    onChange={(e) =>
                      setStoreConfig({
                        ...storeConfig,
                        paymentApiKey: e.target.value.trim()
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white border text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500">
                    Integration ID
                  </label>
                  <input
                    type="text"
                    value={storeConfig.paymentIntegrationId || ""}
                    onChange={(e) =>
                      setStoreConfig({
                        ...storeConfig,
                        paymentIntegrationId: e.target.value.trim()
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white border text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500">
                    Iframe ID
                  </label>
                  <input
                    type="text"
                    value={storeConfig.paymentIframeId || ""}
                    onChange={(e) =>
                      setStoreConfig({
                        ...storeConfig,
                        paymentIframeId: e.target.value.trim()
                      })
                    }
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-white border text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="px-6 py-3.5 rounded-2xl bg-brand-black hover:bg-brand-red text-white text-xs font-extrabold flex items-center gap-2 transition shadow"
          >
            <Save className="w-4 h-4" />
            <span>
              {savingSettings ? "جاري الحفظ..." : "حفظ وتطبيق جميع الإعدادات"}
            </span>
          </button>
        </form>
      )}
    </div>
  );
}
