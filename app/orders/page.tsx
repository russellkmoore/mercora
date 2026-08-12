import { redirect } from "next/navigation";

export default async function OrdersCompatibilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((entry) => query.append(key, entry));
    else if (value !== undefined) query.set(key, value);
  }
  redirect(`/account/orders${query.size ? `?${query.toString()}` : ""}`);
}
