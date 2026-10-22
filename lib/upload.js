import imageCompression from "browser-image-compression";

// مفتاح الـ API الخاص بك لمنصة ImgBB
const DEFAULT_IMGBB_API_KEY = "bac3eeb4c41bcfcb38f6ada28c50c825";

/**
 * دالة لضغط الصورة في المتصفح ثم رفعها إلى ImgBB وإرجاع الرابط المباشر
 * @param {File} imageFile - ملف الصورة المختار من الجهاز أو الجوال
 * @param {string} customApiKey - مفتاح بديل في حال تم تغييره من إعدادات الإدارة
 * @returns {Promise<string>} - رابط الصورة المباشر بعد الرفع
 */
export async function compressAndUploadImage(imageFile, customApiKey = null) {
  if (!imageFile) {
    throw new Error("يرجى اختيار صورة أولاً");
  }

  // التحقق من أن الملف المرفوع هو صورة بالفعل
  if (!imageFile.type.startsWith("image/")) {
    throw new Error("الملف المختار ليس صورة صالحة");
  }

  const apiKey = customApiKey || DEFAULT_IMGBB_API_KEY;

  try {
    // 1. إعدادات الضغط الذكي للحفاظ على دقة الغلاف مع تقليص الحجم لأقصى درجة
    const compressionOptions = {
      maxSizeMB: 0.25, // الحد الأقصى لحجم الصورة بعد الضغط (حوالي 250 كيلوبايت فقط)
      maxWidthOrHeight: 1200, // أبعاد ممتازة لأغلفة الكتب والشاشات الحديثة
      useWebWorker: true,
      fileType: "image/webp", // تحويل الصيغة إلى WebP لسرعة فتح فائقة في المتجر
      initialQuality: 0.85,
    };

    // تنفيذ الضغط في متصفح المستخدم قبل الرفع
    let fileToUpload = imageFile;
    try {
      fileToUpload = await imageCompression(imageFile, compressionOptions);
    } catch (compressionError) {
      console.warn("تعذر ضغط الصورة، سيتم رفع الصورة الأصلية:", compressionError);
      fileToUpload = imageFile;
    }

    // 2. تجهيز البيانات لإرسالها إلى API منصة ImgBB
    const formData = new FormData();
    formData.append("image", fileToUpload);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`فشل الاتصال بخادم رفع الصور (كود: ${response.status})`);
    }

    const result = await response.json();

    if (!result.success || !result.data || !result.data.url) {
      throw new Error("لم نتمكن من استلام رابط الصورة من المنصة");
    }

    // إرجاع الرابط المباشر للصورة ليتم تخزينه في Firebase
    return result.data.display_url || result.data.url;
  } catch (error) {
    console.error("خطأ أثناء ضغط أو رفع الصورة:", error);
    throw new Error(error.message || "حدث خطأ غير متوقع أثناء رفع الصورة");
  }
}
