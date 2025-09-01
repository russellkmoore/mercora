/**
 * Admin Pages Management - Content Management System
 * 
 * Main page for managing all content pages in the admin dashboard.
 * Provides listing, creation, editing, and deletion of pages.
 */

import { Metadata } from "next";
import PageManagement from "./PageManagement";

export const metadata: Metadata = {
  title: "Pages Management | Admin - Mercora",
  description: "Manage content pages, privacy policy, terms of service, and other static content.",
};

export default function PagesPage() {
  return <PageManagement />;
}