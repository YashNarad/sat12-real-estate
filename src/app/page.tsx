import { Suspense } from "react";

import { HomeClient } from "@/components/home/HomeClient";
import { HeaderAccount, HeaderAccountFallback } from "@/components/layout/HeaderAccount";

export default function Home() {
  return (
    <HomeClient
      accountControl={
        <Suspense fallback={<HeaderAccountFallback />}>
          <HeaderAccount />
        </Suspense>
      }
    />
  );
}
