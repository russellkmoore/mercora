import { getDbAsync } from "@/lib/db";

export const getCategories = async () => {
  const db = await getDbAsync();
  return db.query.categories.findMany();
};