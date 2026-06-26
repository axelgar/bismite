"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="secondary"
      onClick={async () => {
        await authClient.signOut();
        router.push("/signin");
      }}
    >
      Sign out
    </button>
  );
}
