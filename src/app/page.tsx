import { Suspense } from "react";
import { connection } from "next/server";

import { HeaderAccount, HeaderAccountFallback } from "@/components/layout/HeaderAccount";
import { PropertyExplorer } from "@/components/properties/PropertyExplorer";
import { PropertyExplorerLoading } from "@/components/properties/PropertyExplorerLoading";
import { getPublishedProperties } from "@/features/properties/supabase-repository";
import { selectHomepageInventory } from "@/features/properties/homepage-inventory";

export async function PublishedPropertyExplorer() {
  await connection();
  const publishedProperties = await getPublishedProperties();
  const inventory = selectHomepageInventory(publishedProperties, process.env.NODE_ENV);
  return (
    <PropertyExplorer
      accountControl={
        <Suspense fallback={<HeaderAccountFallback />}>
          <HeaderAccount />
        </Suspense>
      }
      initialProperties={inventory.properties}
      inventoryMode={inventory.mode}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={<PropertyExplorerLoading />}>
      <PublishedPropertyExplorer />
    </Suspense>
  );
}
