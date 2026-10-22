import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  BookOpen,
  Sparkles,
  X,
  User,
  ChevronLeft,
  SlidersHorizontal
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useStore } from "../components/Layout";
import ProductCard from "../components/ProductCard";

// دالة ذكية لتوحيد الحروف العربية أثناء البحث (تجاهل الهمزات والتاء المربوطة والتشكيل)
function normalizeArabic(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, "");
}

const DEFAULT_BOOK_CATEGORIES = [
  "الكل",
  "روايات",
  "قصص",
  "سرد",
  "نصوص أدبية",
  "فكر وفلسفة",
  "شعر",
  "تطوير ذات",
  "تاريخ"
];

const DEFAULT_ACCESSORY_CATEGORIES = [
  "الكل",
  "فواصل كتب",
  "دفاتر ومفكرات",
  "أقلام فاخرة",
  "إضاءة قراءة",
  "حقائب قماشية",
  "هدايا القراء"
];

export default function HomePage() {
  const { settings, activeSection, setActiveSection, roleInfo } = useStore();

  const [products, setProducts] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);

  // حالات البحث والفئات والترتيب
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [sortBy, setSortBy] = useState("newest"); // newest | price-asc | price-desc | best-selling

  const searchContainerRef = useRef(null);

  // جلب الكتب، الإكسسوارات، وملفات الكتّاب من Firebase
  useEffect(() => {
    async function fetchStoreData() {
      setLoading(true);
      try {
        const [productsSnap, authorsSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "authors"))
        ]);

        const productsList = productsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((item) => item.archived !== true);

        const authorsList = authorsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        // ترتيب أحدث الإصدارات أولاً بشكل افتراضي
        productsList.sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );

        setProducts(productsList);
        setAuthors(authorsList);
      } catch (error) {
        console.error("خطأ في جلب بيانات المتجر:", error);
      }
      setLoading(false);
    }

    fetchStoreData();
  }, []);

  // إذا كان قسم القرطاسية مخفياً من الإدارة، نضمن بقاء العميل في قسم الكتب
  useEffect(() => {
    if (!settings.showAccessories && activeSection === "accessories") {
      setActiveSection("books");
    }
  }, [settings.showAccessories, activeSection, setActiveSection]);

  // إغلاق قائمة الاقتراحات الذكية عند الضغط خارج مربع البحث
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // إعادة ضبط الفئة المختارة عند التبديل بين الكتب والقرطاسية
  const handleSectionSwitch = (section) => {
    setActiveSection(section);
    setSelectedCategory("الكل");
  };

  // استخراج الفئات المتاحة بشكل ديناميكي + الفئات الافتراضية
  const categories = useMemo(() => {
    const baseCategories =
      activeSection === "books"
        ? DEFAULT_BOOK_CATEGORIES
        : DEFAULT_ACCESSORY_CATEGORIES;

    const sectionProducts = products.filter(
      (p) => (p.type || "book") === (activeSection === "books" ? "book" : "accessory")
    );

    const dynamicCats = sectionProducts
      .map((p) => p.category)
      .filter((c) => Boolean(c) && !baseCategories.includes(c));

    return [...baseCategories, ...new Set(dynamicCats)];
  }, [products, activeSection]);

  // خوارزمية الاقتراحات الفورية الذكية (تقترح الكتّاب والكتب أثناء الكتابة)
  const instantSuggestions = useMemo(() => {
    const normalizedQ = normalizeArabic(searchQuery);
    if (!normalizedQ || normalizedQ.length < 1) {
      return { matchedAuthors: [], matchedProducts: [] };
    }

    const matchedAuthors = authors
      .filter((author) => normalizeArabic(author.name).includes(normalizedQ))
      .slice(0, 4);

    const matchedProducts = products
      .filter((p) => {
        if (!settings.showAccessories && p.type === "accessory") return false;
        const titleMatch = normalizeArabic(p.title).includes(normalizedQ);
        const authorMatch = normalizeArabic(p.authorName).includes(normalizedQ);
        const catMatch = normalizeArabic(p.category).includes(normalizedQ);
        return titleMatch || authorMatch || catMatch;
      })
      .slice(0, 6);

    return { matchedAuthors, matchedProducts };
  }, [searchQuery, authors, products, settings.showAccessories]);

  // فلترة وترتيب المنتجات المعروضة في الشبكة
  const filteredProducts = useMemo(() => {
    const targetType = activeSection === "books" ? "book" : "accessory";
    const normalizedQ = normalizeArabic(searchQuery);

    let list = products.filter((p) => (p.type || "book") === targetType);

    if (selectedCategory !== "الكل") {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (normalizedQ) {
      list = list.filter(
        (p) =>
          normalizeArabic(p.title).includes(normalizedQ) ||
          normalizeArabic(p.authorName).includes(normalizedQ) ||
          normalizeArabic(p.description).includes(normalizedQ)
      );
    }

    const sorted = [...list];
    if (sortBy === "price-asc") {
      sorted.sort(
        (a, b) =>
          Number(a.finalPrice || a.price || 0) -
          Number(b.finalPrice || b.price || 0)
      );
    } else if (sortBy === "price-desc") {
      sorted.sort(
        (a, b) =>
          Number(b.finalPrice || b.price || 0) -
          Number(a.finalPrice || a.price || 0)
      );
    } else if (sortBy === "best-selling") {
      sorted.sort((a, b) => Number(b.soldCount || 0) - Number(a.soldCount || 0));
    } else {
      sorted.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
    }

    return sorted;
  }, [products, activeSection, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="space-y-5 pb-8">
      {/* 1. المُبدّل العلوي بتصميم Samsung One UI 9 (يظهر فقط إذا كانت القرطاسية مفعّلة من الإدارة) */}
      {settings.showAccessories && (
        <div className="bg-gray-200/75 p-1.5 rounded-full flex items-center max-w-md mx-auto shadow-inner">
          <button
            type="button"
            onClick={() => handleSectionSwitch("books")}
            className={`flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-300 ${
              activeSection === "books"
                ? "bg-brand-black text-white shadow-sm"
                : "text-gray-600 hover:text-brand-black"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>مكتبة الكتب</span>
          </button>

          <button
            type="button"
            onClick={() => handleSectionSwitch("accessories")}
            className={`flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-300 ${
              activeSection === "accessories"
                ? "bg-brand-red text-white shadow-sm"
                : "text-gray-600 hover:text-brand-black"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>القرطاسية والإكسسوارات</span>
          </button>
        </div>
      )}

      {/* 2. شريط البحث الذكي الفوري مع الاقتراحات المنسدلة */}
      <div ref={searchContainerRef} className="relative z-20">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-gray-400 absolute right-4 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            placeholder={
              activeSection === "books"
                ? "ابحث عن كتاب، رواية، أو اسم كاتب..."
                : "ابحث في القرطاسية وإكسسوارات القراءة..."
            }
            className="w-full pr-12 pl-12 py-4 rounded-one-ui bg-white border border-gray-200/80 shadow-card text-sm font-medium focus:outline-none focus:border-brand-red transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setShowSuggestions(false);
              }}
              className="absolute left-3.5 p-1.5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* القائمة المنسدلة للاقتراحات الذكية الفورية (كتّاب + كتب) */}
        {showSuggestions &&
          searchQuery.trim().length > 0 &&
          (instantSuggestions.matchedAuthors.length > 0 ||
            instantSuggestions.matchedProducts.length > 0) && (
            <div className="absolute top-full mt-2 inset-x-0 bg-white rounded-one-ui shadow-glass border border-gray-100 overflow-hidden divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {/* اقتراحات الكتّاب والمؤلفين */}
              {instantSuggestions.matchedAuthors.length > 0 && (
                <div className="p-3">
                  <p className="text-[11px] font-extrabold text-gray-400 px-2 mb-2">
                    الكتّاب والمؤلفون
                  </p>
                  <div className="space-y-1">
                    {instantSuggestions.matchedAuthors.map((author) => (
                      <Link
                        key={author.id}
                        href={`/author/${author.id}`}
                        onClick={() => setShowSuggestions(false)}
                        className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          {author.photoUrl ? (
                            <img
                              src={author.photoUrl}
                              alt={author.name}
                              className="w-9 h-9 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-brand-lightRed text-brand-red flex items-center justify-center">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-extrabold text-brand-black">
                              {author.name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              تصفح الملف الشخصي ومؤلفات الكاتب
                            </p>
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* اقتراحات الكتب والمنتجات */}
              {instantSuggestions.matchedProducts.length > 0 && (
                <div className="p-3">
                  <p className="text-[11px] font-extrabold text-gray-400 px-2 mb-2">
                    الإصدارات والمنتجات المقترحة
                  </p>
                  <div className="space-y-1">
                    {instantSuggestions.matchedProducts.map((item) => (
                      <Link
                        key={item.id}
                        href={`/product/${item.id}`}
                        onClick={() => setShowSuggestions(false)}
                        className="flex items-center justify-between p-2 rounded-2xl hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.coverUrl}
                            alt={item.title}
                            className="w-10 h-14 object-cover rounded-xl bg-gray-100 shrink-0"
                          />
                          <div>
                            <p className="text-xs font-extrabold text-brand-black line-clamp-1">
                              {item.title}
                            </p>
                            {item.authorName && (
                              <p className="text-[11px] text-gray-500">
                                {item.authorName}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-brand-red shrink-0">
                          {item.finalPrice || item.price} ج.م
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
      </div>

      {/* 3. شريط الفئات الأفقي السلس (بأسلوب يوتيوب) + فلتر الترتيب */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  active
                    ? "bg-brand-black text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200/80 hover:border-gray-300"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* قائمة الترتيب المصغرة */}
        <div className="relative shrink-0">
          <div className="flex items-center bg-white border border-gray-200/80 rounded-full px-3 py-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500 ml-1.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none"
            >
              <option value="newest">الأحدث</option>
              <option value="best-selling">الأكثر مبيعاً</option>
              <option value="price-asc">الأقل سعراً</option>
              <option value="price-desc">الأعلى سعراً</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. شبكة عرض الكتب والمنتجات */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 pt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="bg-white rounded-one-ui p-3 border border-gray-100 h-80 animate-pulse flex flex-col justify-between"
            >
              <div className="w-full aspect-[3/4] bg-gray-200 rounded-2xl" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mt-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mt-1" />
              <div className="h-8 bg-gray-200 rounded-xl w-full mt-3" />
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-one-ui-lg p-12 text-center border border-gray-100 shadow-card my-4">
          <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-extrabold text-base text-gray-800">
            {searchQuery
              ? "لا توجد نتائج مطابقة لبحثك"
              : "لا توجد إصدارات مضافة في هذا القسم حالياً"}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {searchQuery
              ? "جرّب البحث بكلمات أخرى أو تصفح الفئات المتاحة"
              : "ستتوفر أحدث إصدارات دار صفقات كتابية هنا قريباً"}
          </p>
          {(roleInfo.isAdmin || roleInfo.isStaff) && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-brand-red text-white text-xs font-extrabold hover:bg-brand-darkRed transition"
            >
              <span>إضافة كتب ومؤلفين من لوحة الإدارة</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
