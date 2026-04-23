import "@/styles/design.css";
import type { AppProps } from "next/app";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Indie+Flower&family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Young+Serif&display=swap" rel="stylesheet" />
        <title>Tech Hobby - Technical Documentation & Tutorials</title>
      </Head>
      <Component {...pageProps} />
    </>
  );
}
