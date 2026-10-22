import Head from "next/head";
import "../styles/globals.css";
import Layout from "../components/Layout";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>دار صفقات كتابية | متجر الكتب والقرطاسية</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
        <meta
          name="description"
          content="المتجر الرسمي لدار صفقات كتابية للنشر والتوزيع - تسوق أحدث الإصدارات والروايات والقرطاسية"
        />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  );
}
