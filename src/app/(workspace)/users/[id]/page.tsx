import { UserDetail } from "@/components/modules";
export const metadata = { title: "Detalle de usuario" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UserDetail id={id} />;
}
