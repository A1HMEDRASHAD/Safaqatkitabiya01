import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowRight, User, BookOpen, Feather } from "lucide-react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import ProductCard from "../../components/ProductCard";

export default function AuthorProfilePage() {
  const router = useRouter();
  const { id } = router.query;

  const [author, setAuthor] = useState(null);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchAuthorAndBooks() {
      setLoading(true);
      try {
        const authorRef = doc(db, "authors", id);
        const authorSnap = await getDoc(authorRef);

        if (authorSnap.exists()) {
          setAuthor({ id: authorSnap.id, ...authorSnap.data() });

          const q = query(
            collection(db, "products"),
            where("authorId", "==", id)
          );
          const booksSnap = await getDocs(q);
          const list = booksSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((b) => b.archived !== true);

          list.sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          );
          setBooks(list);
        } else {
          setAuthor(null);
        }
      } catch (error) {
        console.error("خطأ في جلب ملف الكاتب:", error);
      }
      setLoading(false);
    }

    fetchAuthorAndBooks();
  }, [id]);

  if (loading) {
    return (
      <div className="py-12 space-y-6 animate-pulse">
        <div className="h-44 bg-white rounded-one-ui-lg p-6 border border-gray-100" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-72 bg-white rounded-one-ui" />
          ))}
        </div>
      </div>
    );
  }

  if (!author) {
    return (
      <div className="bg-white rounded-one-ui-lg p-12 text-center border border-gray-100 shadow-card my-8">
        <User className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <h2 className="font-extrabold text-base text-gray-800">
          لم يتم العثور على ملف الكاتب المطلوب
        </h2>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-brand-black text-white text-xs font-extrabold"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للمتجر</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
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

      {/* بطاقة التعريف بالكاتب بتصميم One UI 9 */}
      <div className="bg-white rounded-one-ui-lg p-6 sm:p-8 border border-gray-100 shadow-card flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-right">
        {author.photoUrl ? (
          <img
            src={author.photoUrl}
            alt={author.name}
            className="w-28 h-28 rounded-full object-cover border-4 border-brand-lightRed shadow-md shrink-0"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-brand-black text-white flex items-center justify-center shrink-0 shadow-md">
            <Feather className="w-10 h-10 text-brand-red" />
          </div>
        )}

        <div className="space-y-2 flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-lightRed text-brand-red text-xs font-extrabold">
            <Feather className="w-3.5 h-3.5" />
            <span>مؤلف لدى دار صفقات كتابية</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-brand-black">
            {author.name}
          </h1>

          {author.bio ? (
            <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
              {author.bio}
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              تصفح جميع الإصدارات والأعمال الأدبية الخاصة بالكاتب {author.name}.
            </p>
          )}

          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-100 text-xs font-extrabold text-brand-black">
              <BookOpen className="w-4 h-4 text-brand-red" />
              <span>عدد الإصدارات المتاحة: {books.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* شبكة مؤلفات الكاتب */}
      <div className="space-y-4">
        <h2 className="text-base sm:text-lg font-extrabold text-brand-black px-1">
          مؤلفات وإصدارات {author.name}
        </h2>

        {books.length === 0 ? (
          <div className="bg-white rounded-one-ui p-10 text-center text-gray-500 text-xs border border-gray-100">
            لا توجد إصدارات معروضة حالياً لهذا الكاتب.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {books.map((book) => (
              <ProductCard key={book.id} product={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
