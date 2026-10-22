import React, { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ShoppingBag,
  Bookmark,
  User,
  Store,
  ShieldCheck,
  LogOut,
  LogIn,
  Package,
  FileText,
  MessageCircle,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Truck,
  X,
  ChevronLeft,
  Mail,
  Lock
} from "lucide-react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import {
  auth,
  db,
  googleProvider,
  checkUserRole,
  getStoreSettings
} from "../lib/firebase";

const StoreContext = createContext();

export function useStore() {
  return useContext(StoreContext);
}

export default function Layout({ children }) {
  const router = useRouter();

  // حالات المستخدم والصلاحيات
  const [user, setUser] = useState(null);
  const [roleInfo, setRoleInfo] = useState({
    role: "guest",
    isAdmin: false,
    isStaff: false,
    permissions: []
  });
  const [authLoading, setAuthLoading] = useState(true);

  // إعدادات المتجر العامة
  const [settings, setSettings] = useState({
    storeName: "صفقات كتابية",
    logoUrl: "https://i.ibb.co/WNgF31VK/41043.png",
    whatsappNumber: "201000000000",
    showAccessories: false,
    freeShippingThreshold: 500,
    shippingCost: 50,
    enableOnlinePayment: false
  });

  // القسم النشط في المتجر (مكتبة الكتب أو القرطاسية والإكسسوارات)
  const [activeSection, setActiveSection] = useState("books");

  // السلة والمحفوظات (مكتبتي)
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);

  // النوافذ المنبثقة للشريط السفلي (مكتبتي / حسابي)
  const [activeDrawer, setActiveDrawer] = useState(null); // null | "wishlist" | "account"
  const [myOrders, setMyOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // تسجيل الدخول بالبريد الإلكتروني
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // إشعارات النظام الذكية (Toast)
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // 1. جلب إعدادات المتجر عند التشغيل
  const refreshSettings = async () => {
    const data = await getStoreSettings();
    if (data) setSettings(data);
  };

  useEffect(() => {
    refreshSettings();
    // استرجاع السلة والمحفوظات من المتصفح مبدئياً
    try {
      const savedCart = localStorage.getItem("safaqat_cart");
      const savedWish = localStorage.getItem("safaqat_wishlist");
      if (savedCart) setCart(JSON.parse(savedCart));
      if (savedWish) setWishlist(JSON.parse(savedWish));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 2. مراقبة حالة تسجيل الدخول ومزامنة السحابة
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const roleData = await checkUserRole(currentUser);
        setRoleInfo(roleData);

        // جلب بيانات العميل المحفوظة في السحابة (السلة + مكتبتي)
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const cloudData = userSnap.data();
            if (cloudData.cart && cloudData.cart.length > 0) {
              setCart(cloudData.cart);
              localStorage.setItem("safaqat_cart", JSON.stringify(cloudData.cart));
            }
            if (cloudData.wishlist && cloudData.wishlist.length > 0) {
              setWishlist(cloudData.wishlist);
              localStorage.setItem("safaqat_wishlist", JSON.stringify(cloudData.wishlist));
            }
          } else {
            await setDoc(userRef, {
              email: currentUser.email,
              displayName: currentUser.displayName || "",
              cart: cart,
              wishlist: wishlist,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("خطأ في مزامنة حساب العميل:", err);
        }
      } else {
        setRoleInfo({ role: "guest", isAdmin: false, isStaff: false, permissions: [] });
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // دالة حفظ التعديلات في المتصفح والسحابة معاً
  const syncUserData = async (newCart, newWishlist) => {
    try {
      localStorage.setItem("safaqat_cart", JSON.stringify(newCart));
      localStorage.setItem("safaqat_wishlist", JSON.stringify(newWishlist));
      if (user) {
        const userRef = doc(db, "users", user.uid);
        await setDoc(
          userRef,
          {
            email: user.email,
            cart: newCart,
            wishlist: newWishlist,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      }
    } catch (e) {
      console.error("خطأ في حفظ البيانات السحابية:", e);
    }
  };

  // دوال التحكم بالسلة
  const addToCart = (product, quantity = 1) => {
    if (product.stock !== undefined && Number(product.stock) <= 0) {
      showToast("عذراً، نفدت كمية هذا المنتج حالياً", "error");
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      let updated;
      if (existingIndex > -1) {
        updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        if (product.stock && newQty > Number(product.stock)) {
          showToast("الكمية المطلوبة تتجاوز المخزون المتاح", "error");
          return prev;
        }
        updated[existingIndex].quantity = newQty;
      } else {
        updated = [...prev, { ...product, quantity }];
      }
      syncUserData(updated, wishlist);
      return updated;
    });

    showToast(`تمت إضافة "${product.title}" إلى السلة`);
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const updated = prev.filter((item) => item.id !== productId);
      syncUserData(updated, wishlist);
      return updated;
    });
  };

  const updateCartQty = (productId, newQty) => {
    if (newQty < 1) return removeFromCart(productId);
    setCart((prev) => {
      const updated = prev.map((item) => {
        if (item.id === productId) {
          if (item.stock && newQty > Number(item.stock)) {
            showToast("الكمية تتجاوز المتاح في المخزون", "error");
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      });
      syncUserData(updated, wishlist);
      return updated;
    });
  };

  const clearCart = () => {
    setCart([]);
    syncUserData([], wishlist);
  };

  // دوال التحكم بمكتبتي (المحفوظات)
  const toggleWishlist = (product) => {
    setWishlist((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      let updated;
      if (exists) {
        updated = prev.filter((item) => item.id !== product.id);
        showToast("تمت الإزالة من مكتبتي");
      } else {
        updated = [...prev, product];
        showToast("تم الحفظ في مكتبتي");
      }
      syncUserData(cart, updated);
      return updated;
    });
  };

  const isInWishlist = (productId) => {
    return wishlist.some((item) => item.id === productId);
  };

  // حسابات السلة
  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.finalPrice || item.price || 0) * item.quantity,
    0
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // تسجيل الدخول بجوجل أو البريد
  const loginWithGoogle = async () => {
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("تم تسجيل الدخول بنجاح");
    } catch (error) {
      setAuthError("تعذر تسجيل الدخول عبر جوجل، حاول مرة أخرى");
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!emailInput || !passwordInput) {
      setAuthError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
        showToast("مرحباً بك مجدداً");
      } else {
        await createUserWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
        showToast("تم إنشاء حسابك بنجاح");
      }
      setEmailInput("");
      setPasswordInput("");
    } catch (error) {
      setAuthError("تأكد من صحة البريد الإلكتروني وكلمة المرور (6 أحرف على الأقل)");
    }
  };

  const logout = async () => {
    await signOut(auth);
    setActiveDrawer(null);
    showToast("تم تسجيل الخروج");
    if (router.pathname.startsWith("/admin")) {
      router.push("/");
    }
  };

  // جلب طلبات العميل عند فتح تبويب "حسابي"
  const fetchMyOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const q = query(
        collection(db, "orders"),
        where("userEmail", "==", user.email.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setMyOrders(list);
    } catch (e) {
      console.error("خطأ في جلب الطلبات:", e);
    }
    setOrdersLoading(false);
  };

  useEffect(() => {
    if (activeDrawer === "account" && user) {
      fetchMyOrders();
    }
  }, [activeDrawer, user]);

  // دالة تعجيل الطلب عبر واتساب
  const handleUrgentWhatsApp = (order) => {
    const cleanPhone = (settings.whatsappNumber || "").replace(/[^0-9]/g, "");
    const message = `مرحباً دار صفقات كتابية، أود الاستفسار وتعجيل طلبي رقم (${order.orderNumber})، حيث أن حالة الطلب الحالية هي: (${order.statusLabel || "قيد المراجعة"}). شكراً لكم.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const contextValue = {
    user,
    roleInfo,
    authLoading,
    settings,
    refreshSettings,
    activeSection,
    setActiveSection,
    cart,
    addToCart,
    removeFromCart,
    updateCartQty,
    clearCart,
    cartTotal,
    cartCount,
    wishlist,
    toggleWishlist,
    isInWishlist,
    showToast,
    openAccountDrawer: () => setActiveDrawer("account")
  };

  return (
    <StoreContext.Provider value={contextValue}>
      <div className="min-h-screen flex flex-col bg-brand-surface text-brand-black pb-28">
        {/* إشعارات النظام العائمة (One UI Toast) */}
        {toast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-full shadow-glass bg-brand-black/95 text-white text-sm font-bold transition-all">
            {toast.type === "error" ? (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* الهيدر العلوي الأنيق (الشعار + زر الإدارة السري + السلة) */}
        <header className="sticky top-0 z-30 glass-bar border-b border-gray-200/60 no-print">
          <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
            {/* الشعار على اليمين */}
            <Link
              href="/"
              onClick={() => setActiveDrawer(null)}
              className="flex items-center gap-3 group"
            >
              <div className="h-12 px-3 rounded-2xl bg-brand-black flex items-center justify-center shadow-sm overflow-hidden">
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.storeName}
                    className="h-10 w-auto object-contain"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : null}
                <span className="text-white font-extrabold text-base tracking-wide px-1">
                  {settings.storeName}
                </span>
              </div>
            </Link>

            {/* الأزرار على اليسار: زر الإدارة (للإدارة فقط) + السلة */}
            <div className="flex items-center gap-2.5">
              {(roleInfo.isAdmin || roleInfo.isStaff) && (
                <Link
                  href="/admin"
                  onClick={() => setActiveDrawer(null)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-brand-red text-white text-xs sm:text-sm font-bold shadow-sm hover:bg-brand-darkRed transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>لوحة التحكم</span>
                </Link>
              )}

              <Link
                href="/cart"
                onClick={() => setActiveDrawer(null)}
                className="relative p-3 rounded-full bg-white border border-gray-200/80 shadow-sm hover:bg-gray-50 transition-all"
                aria-label="سلة المشتريات"
              >
                <ShoppingBag className="w-5 h-5 text-brand-black" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-brand-red text-white text-xs font-extrabold flex items-center justify-center shadow">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </header>

        {/* محتوى الصفحة الأساسي */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 pt-4">
          {children}
        </main>

        {/* نافذة "مكتبتي" (الكتب المحفوظة) بتصميم One UI 9 */}
        {activeDrawer === "wishlist" && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-2xl rounded-t-one-ui-lg sm:rounded-one-ui-lg max-h-[85vh] flex flex-col shadow-glass overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bookmark className="w-5 h-5 text-brand-red" />
                  <h2 className="text-lg font-extrabold">مكتبتي المحفوظة</h2>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                {wishlist.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Bookmark className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-bold text-gray-700">مكتبتك فارغة حالياً</p>
                    <p className="text-sm mt-1">
                      احفظ كتبك المفضلة للعودة إليها في أي وقت
                    </p>
                  </div>
                ) : (
                  wishlist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100 gap-3"
                    >
                      <div
                        onClick={() => {
                          setActiveDrawer(null);
                          router.push(`/product/${item.id}`);
                        }}
                        className="flex items-center gap-3 cursor-pointer flex-1"
                      >
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          className="w-14 h-20 object-cover rounded-xl bg-gray-200 shrink-0"
                        />
                        <div>
                          <h3 className="font-bold text-sm line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.authorName}
                          </p>
                          <p className="text-sm font-extrabold text-brand-red mt-1">
                            {item.finalPrice || item.price} ج.م
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => addToCart(item, 1)}
                          className="px-3.5 py-2 rounded-xl bg-brand-black text-white text-xs font-bold hover:bg-brand-red transition"
                        >
                          أضف للسلة
                        </button>
                        <button
                          onClick={() => toggleWishlist(item)}
                          className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* نافذة "حسابي وطلباتي" وتسجيل الدخول */}
        {activeDrawer === "account" && (
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-2xl rounded-t-one-ui-lg sm:rounded-one-ui-lg max-h-[88vh] flex flex-col shadow-glass overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <User className="w-5 h-5 text-brand-red" />
                  <h2 className="text-lg font-extrabold">
                    {user ? "حسابي وسجل طلباتي" : "تسجيل الدخول"}
                  </h2>
                </div>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {!user ? (
                  <div className="max-w-md mx-auto py-4 space-y-5">
                    <div className="text-center">
                      <h3 className="font-extrabold text-base text-gray-900">
                        احفظ سلتك وفواتيرك في السحابة
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        سجّل دخولك لمتابعة طلباتك والعودة لمشترياتك في أي وقت
                      </p>
                    </div>

                    <button
                      onClick={loginWithGoogle}
                      className="w-full py-3.5 px-4 rounded-2xl bg-brand-black text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm hover:bg-gray-900 transition"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>المتابعة السريعة باستخدام حساب Google</span>
                    </button>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink mx-3 text-gray-400 text-xs">
                        أو عبر البريد الإلكتروني
                      </span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <form onSubmit={handleEmailAuth} className="space-y-3">
                      {authError && (
                        <div className="p-3 rounded-xl bg-red-50 text-brand-red text-xs font-bold">
                          {authError}
                        </div>
                      )}
                      <div className="relative">
                        <Mail className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                        <input
                          type="email"
                          placeholder="البريد الإلكتروني"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="w-full pr-10 pl-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-brand-red"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
                        <input
                          type="password"
                          placeholder="كلمة المرور"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="w-full pr-10 pl-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-brand-red"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3 rounded-2xl bg-brand-red text-white font-bold text-sm hover:bg-brand-darkRed transition"
                      >
                        {authMode === "login" ? "دخول" : "إنشاء حساب جديد"}
                      </button>
                    </form>

                    <div className="text-center">
                      <button
                        onClick={() =>
                          setAuthMode(authMode === "login" ? "register" : "login")
                        }
                        className="text-xs font-bold text-gray-600 hover:text-brand-red"
                      >
                        {authMode === "login"
                          ? "ليس لديك حساب؟ أنشئ حساباً جديداً"
                          : "لديك حساب بالفعل؟ سجّل الدخول"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* بطاقة معلومات الحساب */}
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-sm text-gray-900">
                          {user.displayName || "عميل صفقات كتابية"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                        {(roleInfo.isAdmin || roleInfo.isStaff) && (
                          <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-brand-lightRed text-brand-red text-[11px] font-bold">
                            {roleInfo.isAdmin ? "حساب الإدارة العليا" : "حساب موظف"}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={logout}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>خروج</span>
                      </button>
                    </div>

                    {/* زر الانتقال السريع للوحة الإدارة إن كان مديراً */}
                    {(roleInfo.isAdmin || roleInfo.isStaff) && (
                      <Link
                        href="/admin"
                        onClick={() => setActiveDrawer(null)}
                        className="w-full p-4 rounded-2xl bg-brand-black text-white flex items-center justify-between shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-brand-red" />
                          <div>
                            <p className="font-extrabold text-sm">
                              فتح لوحة التحكم الكاملة
                            </p>
                            <p className="text-xs text-gray-400">
                              إدارة الكتب، الكتّاب، الطلبات، الكوبونات، والـ API
                            </p>
                          </div>
                        </div>
                        <ChevronLeft className="w-5 h-5" />
                      </Link>
                    )}

                    {/* سجل الطلبات */}
                    <div>
                      <h3 className="font-extrabold text-sm mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4 text-brand-red" />
                        <span>سجل طلباتي ({myOrders.length})</span>
                      </h3>

                      {ordersLoading ? (
                        <p className="text-xs text-gray-500 py-6 text-center">
                          جاري تحميل سجل الطلبات...
                        </p>
                      ) : myOrders.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-gray-50 text-center text-gray-500 text-xs">
                          لا توجد طلبات مسجلة حتى الآن.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {myOrders.map((order) => (
                            <div
                              key={order.id}
                              className="p-4 rounded-2xl border border-gray-200 bg-white space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-sm text-brand-black">
                                  #{order.orderNumber}
                                </span>
                                <span
                                  className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                                    order.status === "completed"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : order.status === "shipping"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {order.status === "shipping" ? (
                                    <Truck className="w-3.5 h-3.5" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5" />
                                  )}
                                  {order.statusLabel || "قيد المراجعة"}
                                </span>
                              </div>

                              <div className="text-xs text-gray-500 flex items-center justify-between">
                                <span>
                                  التاريخ:{" "}
                                  {order.createdAt
                                    ? new Date(order.createdAt).toLocaleDateString("ar-EG")
                                    : "-"}
                                </span>
                                <span className="font-extrabold text-sm text-brand-black">
                                  الإجمالي: {order.totalAmount} ج.م
                                </span>
                              </div>

                              <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/invoice/${order.id}`}
                                  onClick={() => setActiveDrawer(null)}
                                  className="flex-1 py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>الفاتورة الإلكترونية</span>
                                </Link>

                                {order.status !== "completed" && (
                                  <button
                                    onClick={() => handleUrgentWhatsApp(order)}
                                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    <span>تعجيل الطلب عبر واتساب</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* الشريط السفلي الزجاجي العائم بأسلوب Samsung One UI 9 (4 أزرار أساسية) */}
        <nav className="fixed bottom-4 inset-x-0 z-30 px-4 no-print pointer-events-none">
          <div className="max-w-md mx-auto glass-bar border border-gray-200/90 rounded-full shadow-glass px-3 py-2 flex items-center justify-around pointer-events-auto">
            {/* 1. المتجر */}
            <button
              onClick={() => {
                setActiveDrawer(null);
                if (router.pathname !== "/") router.push("/");
              }}
              className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-full transition-all ${
                router.pathname === "/" && !activeDrawer
                  ? "bg-brand-black text-white font-bold"
                  : "text-gray-600 hover:text-brand-black"
              }`}
            >
              <Store className="w-5 h-5" />
              <span className="text-[11px] mt-0.5">المتجر</span>
            </button>

            {/* 2. مكتبتي */}
            <button
              onClick={() =>
                setActiveDrawer(activeDrawer === "wishlist" ? null : "wishlist")
              }
              className={`relative flex flex-col items-center justify-center px-4 py-1.5 rounded-full transition-all ${
                activeDrawer === "wishlist"
                  ? "bg-brand-black text-white font-bold"
                  : "text-gray-600 hover:text-brand-black"
              }`}
            >
              <Bookmark className="w-5 h-5" />
              <span className="text-[11px] mt-0.5">مكتبتي</span>
              {wishlist.length > 0 && (
                <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-brand-red"></span>
              )}
            </button>

            {/* 3. السلة */}
            <button
              onClick={() => {
                setActiveDrawer(null);
                router.push("/cart");
              }}
              className={`relative flex flex-col items-center justify-center px-4 py-1.5 rounded-full transition-all ${
                router.pathname === "/cart" && !activeDrawer
                  ? "bg-brand-black text-white font-bold"
                  : "text-gray-600 hover:text-brand-black"
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[11px] mt-0.5">السلة</span>
              {cartCount > 0 && (
                <span className="absolute top-0.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10px] font-extrabold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* 4. حسابي */}
            <button
              onClick={() =>
                setActiveDrawer(activeDrawer === "account" ? null : "account")
              }
              className={`relative flex flex-col items-center justify-center px-4 py-1.5 rounded-full transition-all ${
                activeDrawer === "account"
                  ? "bg-brand-black text-white font-bold"
                  : "text-gray-600 hover:text-brand-black"
              }`}
            >
              <User className="w-5 h-5" />
              <span className="text-[11px] mt-0.5">حسابي</span>
              {user && (
                <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>
          </div>
        </nav>
      </div>
    </StoreContext.Provider>
  );
}
