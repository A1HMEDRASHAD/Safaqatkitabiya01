import React from "react";
import Link from "next/link";
import { 
  Star, 
  Bookmark, 
  ShoppingBag, 
  Sparkles, 
  Tag, 
  Ban 
} from "lucide-react";
import { useStore } from "./Layout";

export default function ProductCard({ product }) {
  const { addToCart, toggleWishlist, isInWishlist } = useStore();

  if (!product) return null;

  const saved = isInWishlist(product.id);
  const outOfStock = product.stock !== undefined && Number(product.stock) <= 0;

  const originalPrice = Number(product.price || 0);
  const finalPrice = Number(product.finalPrice || product.price || 0);
  const hasDiscount = finalPrice < originalPrice && originalPrice > 0;
  const discountPercentage = hasDiscount
    ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
    : 0;

  return (
    <div className="group bg-white rounded-one-ui p-3 border border-gray-100 shadow-card hover:shadow-glass transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
      {/* قسم الغلاف والشارات وأيقونة الحفظ */}
      <div>
        <div className="relative aspect-[3/4] w-full rounded-2xl bg-gray-100 overflow-hidden mb-3">
          <Link href={`/product/${product.id}`} className="block w-full h-full">
            <img
              src={product.coverUrl || "https://via.placeholder.com/400x550?text=Safaqat"}
              alt={product.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </Link>

          {/* الشارات الذكية على الغلاف (من الإدارة أو الخصم أو المخزون) */}
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-10">
            {outOfStock ? (
              <span className="px-2.5 py-1 rounded-full bg-gray-900/90 backdrop-blur-md text-white text-[11px] font-extrabold flex items-center gap-1 shadow-sm">
                <Ban className="w-3 h-3 text-red-400" />
                <span>نفدت الكمية</span>
              </span>
            ) : (
              <>
                {product.badgeText && (
                  <span className="px-2.5 py-1 rounded-full bg-brand-black/90 backdrop-blur-md text-white text-[11px] font-extrabold flex items-center gap-1 shadow-sm">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{product.badgeText}</span>
                  </span>
                )}

                {hasDiscount && (
                  <span className="px-2.5 py-1 rounded-full bg-brand-red text-white text-[11px] font-extrabold flex items-center gap-1 shadow-sm">
                    <Tag className="w-3 h-3" />
                    <span>خصم {discountPercentage}%</span>
                  </span>
                )}
              </>
            )}
          </div>

          {/* زر الحفظ في مكتبتي */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist(product);
            }}
            aria-label="حفظ في مكتبتي"
            className={`absolute top-2.5 left-2.5 z-10 p-2 rounded-full backdrop-blur-md transition-all shadow-sm ${
              saved
                ? "bg-brand-red text-white"
                : "bg-white/85 text-gray-700 hover:bg-white"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
          </button>

          {/* التقييم بالنجوم أسفل الغلاف */}
          <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-brand-black text-[11px] font-extrabold flex items-center gap-1 shadow-sm">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{Number(product.rating || 5.0).toFixed(1)}</span>
          </div>
        </div>

        {/* الفئة وعنوان الكتاب والكاتب */}
        <div className="px-1">
          {product.category && (
            <span className="text-[11px] font-bold text-brand-red block mb-0.5">
              {product.category}
            </span>
          )}

          <Link href={`/product/${product.id}`}>
            <h3 className="font-extrabold text-sm sm:text-base text-brand-black line-clamp-1 hover:text-brand-red transition-colors">
              {product.title}
            </h3>
          </Link>

          {/* اسم الكاتب مع رابط لملفه الشخصي إن كان كتاباً */}
          {product.authorName && (
            <div className="mt-0.5">
              {product.authorId ? (
                <Link
                  href={`/author/${product.authorId}`}
                  className="text-xs text-gray-500 hover:text-brand-black font-medium line-clamp-1 transition-colors"
                >
                  {product.authorName}
                </Link>
              ) : (
                <span className="text-xs text-gray-500 font-medium line-clamp-1">
                  {product.authorName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* السعر وزر الإضافة للسلة */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between px-1">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-base text-brand-black">
              {finalPrice}
            </span>
            <span className="text-[11px] font-bold text-gray-500">ج.م</span>
          </div>
          {hasDiscount && (
            <span className="text-[11px] text-gray-400 line-through block -mt-1">
              {originalPrice} ج.م
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={outOfStock}
          onClick={() => addToCart(product, 1)}
          className={`p-2.5 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
            outOfStock
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-brand-black text-white hover:bg-brand-red active:scale-95"
          }`}
          aria-label="إضافة إلى السلة"
        >
          <ShoppingBag className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
