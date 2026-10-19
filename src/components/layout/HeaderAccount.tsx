import { connection } from "next/server";

import { logoutAction } from "@/app/actions/auth";
import { getHomepageAccount } from "@/features/auth/homepage-account";

import { AccountMenu } from "./AccountMenu";

export async function HeaderAccount() {
  await connection();
  const account = await getHomepageAccount();
  return <AccountMenu account={account} logoutAction={logoutAction} />;
}

export function HeaderAccountFallback() {
  return (
    <div aria-label="Loading account" className="flex min-h-11 items-center gap-3 px-2">
      <span className="size-10 animate-pulse rounded-full bg-zinc-100" />
      <span className="hidden h-4 w-20 animate-pulse rounded bg-zinc-100 sm:block" />
    </div>
  );
}
