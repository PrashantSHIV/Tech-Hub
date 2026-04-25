import "@/styles/design.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getAuthEventName, getAuthSession } from "@/lib/auth";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith("/admin");
  const [canRenderAdminRoute, setCanRenderAdminRoute] = useState(false);

  useEffect(() => {
    const checkAccess = () => {
      if (!router.pathname.startsWith("/admin")) {
        setCanRenderAdminRoute(false);
        return;
      }

      const session = getAuthSession();
      if (!session) {
        setCanRenderAdminRoute(false);
        void router.replace("/login");
        return;
      }

      setCanRenderAdminRoute(true);
    };

    checkAccess();
    window.addEventListener(getAuthEventName(), checkAccess);
    window.addEventListener("storage", checkAccess);

    return () => {
      window.removeEventListener(getAuthEventName(), checkAccess);
      window.removeEventListener("storage", checkAccess);
    };
  }, [router]);

  return (
    <>
      <Head>
        <title>Tech Hobby - Technical Documentation & Tutorials</title>
      </Head>
      {isAdminRoute && !canRenderAdminRoute ? null : <Component {...pageProps} />}
    </>
  );
}
