import { getDbAsync } from "@/lib/db";

export const getCategories = async () => {
  const db = await getDbAsync();
  return db.query.categories.findMany();
};

export async function getCategoryBySlug(slug: string) {
  const db = await getDbAsync();
  return db.query.categories.findFirst({
    where: (category, { eq }) => eq(category.slug, slug),
  });
}
