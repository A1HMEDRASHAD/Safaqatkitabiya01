import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ShoppingBag,
  Bookmark,
  Star,
  ArrowRight,
  BookOpen,
  Calendar,
  Layers,
  Building2,
  User,
  ChevronLeft,
  MessageCircle,
  Sparkles,
  Tag,
  CheckCircle2,
  Ban,
  Plus,
  Minus
} from "lucide-react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useStore } from "../../components/Layout";
import ProductCard from "../../components/ProductCard";

export default function ProductDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { addToCart, toggleWishlist, isInWishlist, settings } = useStore();

  const [product, setProduct] = useState(null);
  const [author, setAuthor] = useState(null);
  const [authorBooks, setAuthorBooks] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchProductDetails() {
      setLoading(true);
      try {
        // 1. جلب بيانات الكتاب أو المنتج
        const productRef = doc(db, "products", id);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          setProduct(null);
          setLoading(false);
          return;
        }

        const currentProduct = { id: productSnap.id, ...productSnap.data() };
        setProduct(currentProduct);
        setQuantity(1);

        // 2. جلب بيانات ملف الكاتب إن وجد
        if (currentProduct.authorId) {
          const authorRef = doc(db, "authors", currentProduct.authorId);
          const authorSnap = await getDoc(authorRef);
          if (authorSnap.exists()) {
            setAuthor({ id: authorSnap.id, ...authorSnap.data() });
          }
        } else {
          setAuthor(null);
        }

        // 3. جلب كتب الكاتب الأخرى والمنتجات المقترحة من نفس الفئة
        const allProductsSnap = await getDocs(collection(db, "products"));
        const allProducts = allProductsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((item) => item.id !== currentProduct.id && item.archived !== true);

        if (currentProduct.authorId) {
          const sameAuthor = allProducts
            .filter((item) => item.authorId === currentProduct.authorId)
            .slice(0, 4);
          setAuthorBooks(sameAuthor);
        } else {
          setAuthorBooks([]);
        }

        const sameCategory = allProducts
          .filter(
            (item) =>
              item.category === currentProduct.category &&
              item.authorId !== currentProduct.authorId
          )
          .slice(0, 4);
        setRelatedProducts(sameCategory);
      } catch (error) {
        console.error("خطأ في جلب تفاصيل المنتج:", error);
      }
      setLoading(false);
    }

    fetchProductDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="py-12 space-y-6 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded-full" />
        <div className="bg-white rounded-one-ui-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="aspect-[3/4] bg-gray-200 rounded-one-ui" />
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-24 bg-gray-100 rounded-2xl w-full" />
            <div className="h-12 bg-gray-200 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white rounded-one-ui-lg p-12 text-center border border-gray-100 shadow-card my-8">
        <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h2 className="font-extrabold text-lg text-brand-black">
          عذراً، هذا المنتج غير متوفر أو تم نقله
        </h2>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-full bg-brand-black text-white text-xs font-extrabold hover:bg-brand-red transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لتصفح المتجر</span>
        </Link>
      </div>
    );
  }

  const saved = isInWishlist(product.id);
  const outOfStock = product.stock !== undefined && Number(product.stock) <= 0;
  const maxStock = product.stock !== undefined ? Number(product.stock) : 99;

  const originalPrice = Number(product.price || 0);
  const finalPrice = Number(product.finalPrice || product.price || 0);
  const hasDiscount = finalPrice < originalPrice && originalPrice > 0;
  const discountPercentage = hasDiscount
    ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
    : 0;

  const handleDirectWhatsApp = () => {
    const cleanPhone = (settings.whatsappNumber || "").replace(/[^0-9]/g, "");
    const msg = `مرحباً دار صفقات كتابية، أود طلب كتاب/منتج: (${product.title}) - الكمية: (${quantity}) - بسعر: (${finalPrice * quantity} ج.م).`;
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-8 pb-10">
      {/* زر الرجوع السريع */}
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200/80 text-xs font-bold text-gray-700 hover:bg-gray-50 transition shadow-sm"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة</span>
        </button>
      </div>

      {/* البطاقة الرئيسية لتفاصيل الكتاب */}
      <div className="bg-white rounded-one-ui-lg p-5 sm:p-8 border border-gray-100 shadow-card grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* صورة الغلاف والشارات */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="relative w-full max-w-sm aspect-[3/4] rounded-one-ui bg-gray-100 overflow-hidden shadow-glass border border-gray-100">
            <img
              src={product.coverUrl}
              alt={product.title}
              className="w-full h-full object-cover"
            />

            <div className="absolute top-3 right-3 flex flex-col gap-2">
              {product.badgeText && (
                <span className="px-3 py-1 rounded-full bg-brand-black/90 backdrop-blur-md text-white text-xs font-extrabold flex items-center gap-1.5 shadow">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{product.badgeText}</span>
                </span>
              )}
              {hasDiscount && (
                <span className="px-3 py-1 rounded-full bg-brand-red text-white text-xs font-extrabold flex items-center gap-1.5 shadow">
                  <Tag className="w-3.5 h-3.5" />
                  <span>خصم {discountPercentage}%</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleWishlist(product)}
              className={`absolute top-3 left-3 p-3 rounded-full backdrop-blur-md shadow transition ${
                saved
                  ? "bg-brand-red text-white"
                  : "bg-white/90 text-gray-700 hover:bg-white"
              }`}
            >
              <Bookmark className={`w-5 h-5 ${saved ? "fill-current" : ""}`} />
            </button>
          </div>
        </div>

        {/* المعلومات والتفاصيل الفنية وأزرار الشراء */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* الفئة والتقييم وحالة التوفر */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {product.category && (
                  <span className="px-3.5 py-1 rounded-full bg-brand-lightRed text-brand-red text-xs font-extrabold">
                    {product.category}
                  </span>
                )}
                <div className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-extrabold flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>{Number(product.rating || 5.0).toFixed(1)}</span>
                </div>
              </div>

              {outOfStock ? (
                <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1">
                  <Ban className="w-3.5 h-3.5" />
                  <span>نفدت الكمية حالياً</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>متوفر في المخزون</span>
                </span>
              )}
            </div>

            {/* العنوان */}
            <h1 className="text-xl sm:text-2xl font-black text-brand-black leading-snug">
              {product.title}
            </h1>

            {/* بطاقة الكاتب المختصرة (تفتح ملف الكاتب) */}
            {(author || product.authorName) && (
              <Link
                href={product.authorId ? `/author/${product.authorId}` : "#"}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/70 hover:border-brand-red transition group"
              >
                <div className="flex items-center gap-3">
                  {author?.photoUrl ? (
                    <img
                      src={author.photoUrl}
                      alt={author.name}
                      className="w-11 h-11 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-brand-black text-white flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-gray-500 font-bold">
                      المؤلف / الكاتب
                    </p>
                    <p className="text-sm font-extrabold text-brand-black group-hover:text-brand-red transition">
                      {author?.name || product.authorName}
                    </p>
                  </div>
                </div>
                {product.authorId && (
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-red">
                    <span>ملف الكاتب</span>
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                )}
              </Link>
            )}

            {/* السعر */}
            <div className="p-4 rounded-2xl bg-brand-surface border border-gray-200/60 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-bold">سعر النسخة</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black text-brand-red">
                    {finalPrice} ج.م
                  </span>
                  {hasDiscount && (
                    <span className="text-sm text-gray-400 line-through font-bold">
                      {originalPrice} ج.م
                    </span>
                  )}
                </div>
              </div>

              {/* محدد الكمية */}
              {!outOfStock && (
                <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-full border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-extrabold text-sm">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* النبذة والوصف */}
            {product.description && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-extrabold text-gray-400">
                  نبذة عن الإصدار
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* المواصفات الفنية للكتاب */}
            {(product.pagesCount ||
              product.releaseYear ||
              product.coverType ||
              product.publisher) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                {product.pagesCount && (
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                    <Layers className="w-4 h-4 mx-auto text-brand-red mb-1" />
                    <p className="text-[11px] text-gray-400 font-bold">
                      عدد الصفحات
                    </p>
                    <p className="text-xs font-extrabold text-brand-black">
                      {product.pagesCount} صفحة
                    </p>
                  </div>
                )}
                {product.releaseYear && (
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                    <Calendar className="w-4 h-4 mx-auto text-brand-red mb-1" />
                    <p className="text-[11px] text-gray-400 font-bold">
                      سنة الإصدار
                    </p>
                    <p className="text-xs font-extrabold text-brand-black">
                      {product.releaseYear}
                    </p>
                  </div>
                )}
                {product.coverType && (
                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                    <BookOpen className="w-4 h-4 mx-auto text-brand-red mb-1" />
                    <p className="text-[11px] text-gray-400 font-bold">
                      نوع الغلاف
                    </p>
                    <p className="text-xs font-extrabold text-brand-black">
                      {product.coverType}
                    </p>
                  </div>
                )}
                <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <Building2 className="w-4 h-4 mx-auto text-brand-red mb-1" />
                  <p className="text-[11px] text-gray-400 font-bold">الناشر</p>
                  <p className="text-xs font-extrabold text-brand-black">
                    {product.publisher || "دار صفقات كتابية"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* أزرار الإضافة للسلة والطلب السريع */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => addToCart(product, quantity)}
              className={`flex-1 py-4 px-6 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all ${
                outOfStock
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-brand-black text-white hover:bg-brand-red active:scale-98"
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span>
                {outOfStock ? "نفدت الكمية" : "إضافة إلى سلة المشتريات"}
              </span>
            </button>

            {!outOfStock && (
              <button
                type="button"
                onClick={handleDirectWhatsApp}
                className="py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                <span>اطلب عبر واتساب</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* القسم الأول تحت الكتاب: مؤلفات أخرى لنفس الكاتب */}
      {authorBooks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-extrabold text-brand-black">
              إصدارات أخرى للكاتب {author?.name || product.authorName}
            </h2>
            {product.authorId && (
              <Link
                href={`/author/${product.authorId}`}
                className="text-xs font-bold text-brand-red flex items-center gap-1"
              >
                <span>عرض الكل</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {authorBooks.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      )}

      {/* القسم الثاني تحت الكتاب: كتب مقترحة من نفس الفئة */}
      {relatedProducts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-extrabold text-brand-black px-1">
            إصدارات مقترحة من فئة ({product.category})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
