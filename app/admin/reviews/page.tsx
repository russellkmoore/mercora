import ReviewModerationDashboard from "@/components/admin/reviews/ReviewModerationDashboard";

export const metadata = {
  title: "Review moderation",
};

export default function AdminReviewsPage() {
  return (
    <main className="p-6 lg:p-8">
      <ReviewModerationDashboard />
    </main>
  );
}
