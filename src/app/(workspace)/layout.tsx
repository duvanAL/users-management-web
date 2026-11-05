import { session } from "@/lib/server";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  let s;
  try {
    s = await session();
  } catch {
    redirect("/login");
  }
  return (
    <Shell role={s.role} userId={s.userId}>
      {children}
    </Shell>
  );
}
