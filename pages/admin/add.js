import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  UserPlus,
  UploadCloud,
  ArrowRight,
  CheckCircle2,
  Trash2,
  Feather,
  Image as ImageIcon,
  RefreshCw,
  Layers,
  Tag
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { compressAndUploadImage } from "../../lib/upload";
import { useStore } from "../../components/Layout";

const BOOK_CATEGORIES = [
  "روايات",
  "قصص",
  "سرد",
  "نصوص أدبية",
  "فكر وفلسفة",
  "شعر",
  "تطوير ذات",
  "تاريخ"
];

const ACCESSORY_CATEGORIES = [
  "فواصل كتب",
  "دفاتر ومفكرات",
  "أقلام فاخرة",
  "إضاءة قراءة",
  "حقائب قماشية",
  "هدايا القراء"
];

export default function AdminAddPage() {
  const router = useRouter();
  const { user, roleInfo, authLoading, showToast } = useStore();

  // التبويب النشط: product (إضافة كتاب أو إكسسوار) | author (إدارة وإضافة الكتّاب)
  const [activeMode, setActiveMode] = useState("product");

  // قائمة الكتّاب المسجلين لربط الكتاب بالكاتب
  const [authors, setAuthors] = useState([]);
  const [loadingAuthors, setLoadingAuthors] = useState(true);

  // حالات نموذج الكتاب / المنتج
  const [productType, setProductType] = useState("book"); // book | accessory
  const [title, setTitle] = useState("");
  const [selectedAuthorId, setSelectedAuthorId] = useState("");
  const [customAuthorName, setCustomAuthorName] = useState("");
  const [category, setCategory] = useState("روايات");
  const [customCategory, setCustomCategory] = useState("");
  const [price, setPrice] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [stock, setStock] = useState("20");
  const [badgeText, setBadgeText] = useState("إصدار جديد");
  const [rating, setRating] = useState("5.0");
  const [pagesCount, setPagesCount] = useState("");
  const [releaseYear, setReleaseYear] = useState(
    new Date().getFullYear().toString()
  );
  const [coverType, setCoverType] = useState("غلاف ورقي (Paperback)");
  const [publisher, setPublisher] = useState("دار صفقات كتابية");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // حالات نموذج إضافة كاتب جديد
  const [authorName, setAuthorName] = useState("");
  const [authorBio, setAuthorBio] = useState("");
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState("");
  const [uploadingAuthorPhoto, setUploadingAuthorPhoto] = useState(false);
  const [savingAuthor, setSavingAuthor] = useState(false);

  // حماية الصفحة
  useEffect(() => {
    if (!authLoading) {
      if (!user || (!roleInfo.isAdmin && !roleInfo.isStaff)) {
        router.push("/");
      }
    }
  }, [user, roleInfo, authLoading, router]);

  // جلب قائمة الكتّاب
  const fetchAuthors = async () => {
    setLoadingAuthors(true);
    try {
      const snap = await getDocs(collection(db, "authors"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
      setAuthors(list);
    } catch (e) {
      console.error("خطأ في جلب الكتّاب:", e);
    }
    setLoadingAuthors(false);
  };

  useEffect(() => {
    if (user && (roleInfo.isAdmin || roleInfo.isStaff)) {
      fetchAuthors();
    }
  }, [user, roleInfo]);

  // تبديل الفئات الافتراضية عند تغيير نوع المنتج بين كتاب وإكسسوار
  const handleProductTypeChange = (type) => {
    setProductType(type);
    if (type === "book") {
      setCategory(BOOK_CATEGORIES[0]);
    } else {
      setCategory(ACCESSORY_CATEGORIES[0]);
    }
  };

  // رفع وضغط صورة غلاف الكتاب تلقائياً عبر ImgBB
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const uploadedUrl = await compressAndUploadImage(file);
      setCoverUrl(uploadedUrl);
      showToast("تم ضغط ورفع صورة الغلاف بنجاح");
    } catch (error) {
      showToast(error.message || "تعذر رفع الصورة", "error");
    }
    setUploadingCover(false);
  };

  // رفع وضغط صورة الكاتب الشخصية
  const handleAuthorPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAuthorPhoto(true);
    try {
      const uploadedUrl = await compressAndUploadImage(file);
      setAuthorPhotoUrl(uploadedUrl);
      showToast("تم ضغط ورفع صورة الكاتب بنجاح");
    } catch (error) {
      showToast(error.message || "تعذر رفع صورة الكاتب", "error");
    }
    setUploadingAuthorPhoto(false);
  };

  // حفظ الكتاب أو الإكسسوار في قاعدة البيانات
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("يرجى كتابة عنوان الكتاب أو المنتج", "error");
      return;
    }
    if (!price || Number(price) <= 0) {
      showToast("يرجى تحديد السعر الأساسي", "error");
      return;
    }
    if (!coverUrl.trim()) {
      showToast("يرجى رفع صورة الغلاف أو وضع رابطها", "error");
      return;
    }

    setSavingProduct(true);
    try {
      const matchedAuthor = authors.find((a) => a.id === selectedAuthorId);
      const resolvedAuthorName = matchedAuthor
        ? matchedAuthor.name
        : customAuthorName.trim();

      const resolvedCategory =
        category === "custom" ? customCategory.trim() : category;

      const basePrice = Number(price);
      const discountedPrice =
        finalPrice && Number(finalPrice) > 0 ? Number(finalPrice) : basePrice;

      const payload = {
        type: productType,
        title: title.trim(),
        authorId: matchedAuthor ? matchedAuthor.id : null,
        authorName: productType === "book" ? resolvedAuthorName : "",
        category: resolvedCategory || "عام",
        price: basePrice,
        finalPrice: discountedPrice,
        stock: Number(stock || 0),
        soldCount: 0,
        badgeText: badgeText.trim(),
        rating: Number(rating || 5.0),
        pagesCount: productType === "book" ? pagesCount.trim() : "",
        releaseYear: productType === "book" ? releaseYear.trim() : "",
        coverType: productType === "book" ? coverType.trim() : "",
        publisher: productType === "book" ? publisher.trim() : "",
        description: description.trim(),
        coverUrl: coverUrl.trim(),
        archived: false,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, "products"), payload);
      showToast(`تم نشر "${payload.title}" في المتجر بنجاح!`);

      // تفريغ الحقول لإضافة كتاب آخر بسرعة
      setTitle("");
      setPrice("");
      setFinalPrice("");
      setDescription("");
      setCoverUrl("");
      setPagesCount("");

      // خيار التوجيه لصفحة الكتاب
      router.push(`/product/${docRef.id}`);
    } catch (error) {
      console.error("خطأ في حفظ المنتج:", error);
      showToast("حدث خطأ أثناء حفظ المنتج", "error");
    }
    setSavingProduct(false);
  };

  // حفظ ملف كاتب جديد
  const handleSaveAuthor = async (e) => {
    e.preventDefault();
    if (!authorName.trim()) {
      showToast("يرجى كتابة اسم الكاتب", "error");
      return;
    }

    setSavingAuthor(true);
    try {
      const payload = {
        name: authorName.trim(),
        bio: authorBio.trim(),
        photoUrl: authorPhotoUrl.trim(),
        createdAt: new Date().toISOString()
      };

      const ref = await addDoc(collection(db, "authors"), payload);
      const newAuthorObj = { id: ref.id, ...payload };
      setAuthors((prev) => [...prev, newAuthorObj]);
      setSelectedAuthorId(ref.id);

      setAuthorName("");
      setAuthorBio("");
      setAuthorPhotoUrl("");
      showToast(`تم إنشاء ملف الكاتب "${payload.name}" بنجاح`);
    } catch (error) {
      console.error("خطأ في حفظ الكاتب:", error);
      showToast("تعذر حفظ ملف الكاتب", "error");
    }
    setSavingAuthor(false);
  };

  const handleDeleteAuthor = async (authorId) => {
    if (!window.confirm("هل أنت متأكد من حذف ملف هذا الكاتب؟")) return;
    try {
      await deleteDoc(doc(db, "authors", authorId));
      setAuthors((prev) => prev.filter((a) => a.id !== authorId));
      showToast("تم حذف ملف الكاتب");
    } catch (e) {
      showToast("تعذر حذف الكاتب", "error");
    }
  };

  if (authLoading) {
    return (
      <div className="py-16 text-center">
        <RefreshCw className="w-8 h-8 text-brand-red animate-spin mx-auto" />
      </div>
    );
  }

  const categoryList =
    productType === "book" ? BOOK_CATEGORIES : ACCESSORY_CATEGORIES;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-14">
      {/* شريط العنوان والرجوع للوحة الإدارة */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-gray-200 text-xs font-extrabold text-gray-700 hover:bg-gray-50 transition shadow-sm"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للوحة التحكم</span>
        </Link>

        <h1 className="text-base sm:text-lg font-black text-brand-black">
          إضافة الإصدارات والكتّاب
        </h1>
      </div>

      {/* المُبدّل العلوي بين إضافة منتج أو إضافة ملف كاتب */}
      <div className="bg-gray-200/75 p-1.5 rounded-full flex items-center max-w-md mx-auto">
        <button
          type="button"
          onClick={() => setActiveMode("product")}
          className={`flex-1 py-2.5 px-4 rounded-full text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeMode === "product"
              ? "bg-brand-black text-white shadow-sm"
              : "text-gray-600 hover:text-brand-black"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>إضافة كتاب / إكسسوار</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode("author")}
          className={`flex-1 py-2.5 px-4 rounded-full text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
            activeMode === "author"
              ? "bg-brand-red text-white shadow-sm"
              : "text-gray-600 hover:text-brand-black"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>إدارة وإضافة الكتّاب ({authors.length})</span>
        </button>
      </div>

      {/* القسم الأول: نموذج رفع كتاب أو إكسسوار */}
      {activeMode === "product" && (
        <form
          onSubmit={handleSaveProduct}
          className="bg-white rounded-one-ui-lg p-5 sm:p-8 border border-gray-100 shadow-card space-y-6"
        >
          {/* اختيار نوع المنتج: كتاب أم إكسسوار قرطاسية */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleProductTypeChange("book")}
              className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                productType === "book"
                  ? "border-brand-black bg-brand-black text-white shadow-sm"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>كتاب / إصدار أدبي</span>
            </button>

            <button
              type="button"
              onClick={() => handleProductTypeChange("accessory")}
              className={`p-4 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                productType === "accessory"
                  ? "border-brand-red bg-brand-red text-white shadow-sm"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>قرطاسية وإكسسوارات</span>
            </button>
          </div>

          {/* رفع صورة الغلاف مع الضغط التلقائي */}
          <div className="p-5 rounded-2xl bg-brand-surface border-2 border-dashed border-gray-300 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="معاينة الغلاف"
                  className="w-28 h-40 object-cover rounded-2xl shadow-md border border-gray-200 shrink-0"
                />
              ) : (
                <div className="w-28 h-40 rounded-2xl bg-gray-200/70 flex flex-col items-center justify-center text-gray-400 shrink-0">
                  <ImageIcon className="w-8 h-8 mb-1" />
                  <span className="text-[11px] font-bold">صورة الغلاف</span>
                </div>
              )}

              <div className="flex-1 space-y-3 w-full">
                <label className="w-full py-3.5 px-4 rounded-2xl bg-brand-black hover:bg-brand-red text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition shadow-sm">
                  {uploadingCover ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري ضغط الصورة ورفعها على ImgBB...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>اختر صورة الغلاف من جهازك أو جوالك</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    disabled={uploadingCover}
                    className="hidden"
                  />
                </label>

                <input
                  type="url"
                  placeholder="أو الصق رابط صورة الغلاف المباشر هنا..."
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
                />
              </div>
            </div>
          </div>

          {/* البيانات الأساسية للكتاب أو الإكسسوار */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-extrabold text-gray-700">
                {productType === "book"
                  ? "عنوان الكتاب / الرواية *"
                  : "اسم منتج القرطاسية / الإكسسوار *"}
              </label>
              <input
                type="text"
                required
                placeholder="مثال: مملكة الكوابيس والضباب"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold focus:outline-none focus:border-brand-red"
              />
            </div>

            {/* اختيار الكاتب (يظهر للكتب فقط) */}
            {productType === "book" && (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-gray-700">
                      ربط بملف كاتب مسجل
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveMode("author")}
                      className="text-[11px] font-extrabold text-brand-red hover:underline"
                    >
                      + إنشاء ملف كاتب جديد
                    </button>
                  </div>
                  <select
                    value={selectedAuthorId}
                    onChange={(e) => setSelectedAuthorId(e.target.value)}
                    className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-extrabold focus:outline-none focus:border-brand-red"
                  >
                    <option value="">-- أو اكتب اسم الكاتب يدوياً بالأسفل --</option>
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedAuthorId && (
                  <div>
                    <label className="text-xs font-extrabold text-gray-700">
                      اسم الكاتب / المؤلف (يدوي)
                    </label>
                    <input
                      type="text"
                      placeholder="اكتب اسم الكاتب..."
                      value={customAuthorName}
                      onChange={(e) => setCustomAuthorName(e.target.value)}
                      className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
                    />
                  </div>
                )}
              </>
            )}

            {/* الفئة والتصنيف */}
            <div>
              <label className="text-xs font-extrabold text-gray-700">
                الفئة / القسم *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-extrabold focus:outline-none focus:border-brand-red"
              >
                {categoryList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="custom">+ كتابة فئة جديدة مخصصة...</option>
              </select>
            </div>

            {category === "custom" && (
              <div>
                <label className="text-xs font-extrabold text-gray-700">
                  اسم الفئة الجديدة *
                </label>
                <input
                  type="text"
                  required
                  placeholder="اكتب اسم الفئة..."
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
                />
              </div>
            )}

            {/* الأسعار والمخزون */}
            <div>
              <label className="text-xs font-extrabold text-gray-700">
                السعر الأساسي (ج.م) *
              </label>
              <input
                type="number"
                required
                placeholder="150"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-black focus:outline-none focus:border-brand-red"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-700">
                السعر بعد الخصم (اتركه فارغاً إن لم يوجد خصم)
              </label>
              <input
                type="number"
                placeholder="120"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-black text-brand-red focus:outline-none focus:border-brand-red"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-700">
                الكمية المتوفرة في المخزون *
              </label>
              <input
                type="number"
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-extrabold focus:outline-none focus:border-brand-red"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-700 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-brand-red" />
                <span>الشارة المميزة أعلى الغلاف (اختياري)</span>
              </label>
              <input
                type="text"
                placeholder="مثال: إصدار جديد / الأكثر مبيعاً / طبعة خاصة"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="w-full mt-1.5 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold focus:outline-none focus:border-brand-red"
              />
            </div>
          </div>

          {/* المواصفات الفنية الخاصة بالكتب فقط */}
          {productType === "book" && (
            <div className="pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-extrabold text-gray-500">
                  عدد الصفحات
                </label>
                <input
                  type="number"
                  placeholder="240"
                  value={pagesCount}
                  onChange={(e) => setPagesCount(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-gray-500">
                  سنة الإصدار
                </label>
                <input
                  type="text"
                  placeholder="2026"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-gray-500">
                  نوع الغلاف
                </label>
                <input
                  type="text"
                  value={coverType}
                  onChange={(e) => setCoverType(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-gray-500">
                  التقييم (من 5)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold"
                />
              </div>
            </div>
          )}

          {/* النبذة والوصف التفصيلي */}
          <div>
            <label className="text-xs font-extrabold text-gray-700">
              نبذة عن الإصدار / وصف المنتج
            </label>
            <textarea
              rows={4}
              placeholder="اكتب نبذة تشويقية عن الكتاب أو تفاصيل المنتج..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1.5 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold leading-relaxed focus:outline-none focus:border-brand-red"
            />
          </div>

          <button
            type="submit"
            disabled={savingProduct || uploadingCover}
            className="w-full py-4 px-6 rounded-2xl bg-brand-black hover:bg-brand-red text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {savingProduct
                ? "جاري نشر الإصدار في المتجر..."
                : "نشر وإضافة إلى المتجر الآن"}
            </span>
          </button>
        </form>
      )}

      {/* القسم الثاني: إنشاء وإدارة ملفات الكتّاب والمؤلفين */}
      {activeMode === "author" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveAuthor}
            className="md:col-span-6 bg-white rounded-one-ui-lg p-6 border border-gray-100 shadow-card space-y-4 h-fit"
          >
            <h2 className="font-extrabold text-sm flex items-center gap-2">
              <Feather className="w-4 h-4 text-brand-red" />
              <span>إنشاء ملف شخصي لكاتب جديد</span>
            </h2>

            {/* صورة الكاتب */}
            <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
              {authorPhotoUrl ? (
                <img
                  src={authorPhotoUrl}
                  alt="صورة الكاتب"
                  className="w-16 h-16 rounded-full object-cover border-2 border-brand-red shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                  <Feather className="w-6 h-6" />
                </div>
              )}

              <div className="flex-1 space-y-2">
                <label className="w-full py-2 px-3 rounded-xl bg-brand-black text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer">
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {uploadingAuthorPhoto
                      ? "جاري رفع الصورة..."
                      : "رفع صورة الكاتب (اختياري)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAuthorPhotoUpload}
                    disabled={uploadingAuthorPhoto}
                    className="hidden"
                  />
                </label>
                <input
                  type="url"
                  placeholder="أو رابط الصورة المباشر..."
                  value={authorPhotoUrl}
                  onChange={(e) => setAuthorPhotoUrl(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border text-[11px]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-700">
                اسم الكاتب / المؤلف *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: أحمد رشاد"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-extrabold focus:outline-none focus:border-brand-red"
              />
            </div>

            <div>
              <label className="text-xs font-extrabold text-gray-700">
                السيرة الذاتية والنبذة الأدبية عن الكاتب
              </label>
              <textarea
                rows={4}
                placeholder="اكتب نبذة تعريفية تظهر للقراء في صفحة ملف الكاتب..."
                value={authorBio}
                onChange={(e) => setAuthorBio(e.target.value)}
                className="w-full mt-1 p-3.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs font-bold leading-relaxed focus:outline-none focus:border-brand-red"
              />
            </div>

            <button
              type="submit"
              disabled={savingAuthor || uploadingAuthorPhoto}
              className="w-full py-3.5 rounded-2xl bg-brand-red hover:bg-brand-darkRed text-white text-xs font-extrabold transition shadow-sm"
            >
              {savingAuthor ? "جاري الحفظ..." : "حفظ وإنشاء ملف الكاتب"}
            </button>
          </form>

          {/* قائمة الكتّاب المسجلين */}
          <div className="md:col-span-6 bg-white rounded-one-ui-lg p-6 border border-gray-100 shadow-card space-y-3">
            <h3 className="font-extrabold text-sm">
              الكتّاب المسجلون في الدار ({authors.length})
            </h3>

            {loadingAuthors ? (
              <p className="text-xs text-gray-400 py-8 text-center">
                جاري تحميل قائمة الكتّاب...
              </p>
            ) : authors.length === 0 ? (
              <p className="text-xs text-gray-400 py-8 text-center">
                لم يتم تسجيل أي كاتب بعد. أنشئ أول ملف كاتب من النموذج المجاور.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {authors.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-2xl bg-gray-50 border border-gray-200/70 flex items-center justify-between gap-3"
                  >
                    <Link
                      href={`/author/${a.id}`}
                      className="flex items-center gap-3 flex-1"
                    >
                      {a.photoUrl ? (
                        <img
                          src={a.photoUrl}
                          alt={a.name}
                          className="w-11 h-11 rounded-full object-cover border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-brand-black text-white flex items-center justify-center shrink-0">
                          <Feather className="w-4 h-4 text-brand-red" />
                        </div>
                      )}
                      <div>
                        <p className="font-extrabold text-xs text-brand-black hover:text-brand-red">
                          {a.name}
                        </p>
                        <p className="text-[11px] text-gray-400 line-clamp-1">
                          {a.bio || "اضغط لعرض صفحة الكاتب"}
                        </p>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDeleteAuthor(a.id)}
                      className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition"
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
    </div>
  );
}
