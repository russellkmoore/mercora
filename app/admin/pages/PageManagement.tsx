/**
 * Page Management Component - Content Management System
 * 
 * Provides comprehensive interface for managing content pages including:
 * - Page listing with status, templates, and search
 * - Create, edit, publish/unpublish, and delete operations
 * - Rich text editing with live preview
 * - Template-based page creation
 * - SEO management and version control
 */

"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Search,
  Eye,
  EyeOff,
  Calendar,
  User,
  Globe,
  Lock,
  BarChart3,
  Bot,
  Loader2
} from "lucide-react";

interface PageData {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  status: 'draft' | 'published' | 'archived';
  template: string;
  published_at?: number;
  created_at: number;
  updated_at: number;
  created_by?: string;
  updated_by?: string;
  version: number;
  show_in_nav: boolean;
  nav_title?: string;
  is_protected: boolean;
  custom_css?: string;
  custom_js?: string;
}

interface PageTemplate {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  fields: string;
  default_content?: string;
}

interface PageStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
}

const STATUS_COLORS = {
  draft: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-800"
};

const STATUS_ICONS = {
  draft: EyeOff,
  published: Eye,
  archived: Lock
};

export default function PageManagement() {
  const [pages, setPages] = useState<PageData[]>([]);
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [stats, setStats] = useState<PageStats>({ total: 0, published: 0, draft: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageData | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Partial<PageData>>({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    meta_title: "",
    meta_description: "",
    meta_keywords: "",
    status: "draft",
    template: "default",
    show_in_nav: false,
    nav_title: "",
    is_protected: false,
    custom_css: "",
    custom_js: ""
  });

  // Load data on component mount
  useEffect(() => {
    loadPages();
    loadTemplates();
    loadStats();
  }, []);

  // Load pages with optional filters
  const loadPages = async (search?: string, status?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (search) params.append('search', search);
      if (status && status !== 'all') params.append('status', status);
      
      const response = await fetch(`/api/admin/pages?${params.toString()}`);
      const result = await response.json() as { success: boolean; data?: PageData[]; error?: string };
      
      if (result.success) {
        setPages(result.data || []);
      } else {
        console.error("Failed to load pages:", result.error);
      }
    } catch (error) {
      console.error("Error loading pages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load page templates
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/admin/page-templates');
      const result = await response.json() as { success: boolean; data?: PageTemplate[]; error?: string };
      
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  // Load page statistics
  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/pages?stats=true');
      const result = await response.json() as { success: boolean; data?: PageStats; error?: string };
      
      if (result.success) {
        setStats(result.data || { total: 0, published: 0, draft: 0, archived: 0 });
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // Handle search
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    loadPages(term, filterStatus);
  };

  // Handle status filter
  const handleStatusFilter = (status: string) => {
    setFilterStatus(status);
    loadPages(searchTerm, status);
  };

  // Generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Handle form input changes
  const handleInputChange = (field: keyof PageData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-generate slug from title
    if (field === 'title' && value) {
      const slug = generateSlug(value);
      setFormData(prev => ({
        ...prev,
        slug
      }));
    }
  };

  // Create new page
  const handleCreatePage = async () => {
    try {
      const response = await fetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json() as { success: boolean; data?: PageData; error?: string; message?: string };

      if (result.success) {
        setIsCreateDialogOpen(false);
        setFormData({
          title: "",
          slug: "",
          content: "",
          excerpt: "",
          meta_title: "",
          meta_description: "",
          meta_keywords: "",
          status: "draft",
          template: "default",
          show_in_nav: false,
          nav_title: "",
          is_protected: false,
          custom_css: "",
          custom_js: ""
        });
        loadPages();
        loadStats();
      } else {
        console.error("Failed to create page:", result.error);
        alert("Failed to create page: " + result.error);
      }
    } catch (error) {
      console.error("Error creating page:", error);
      alert("Error creating page");
    }
  };

  // Edit page
  const handleEditPage = (page: PageData) => {
    setEditingPage(page);
    setFormData(page);
    setIsEditDialogOpen(true);
  };

  // Update page
  const handleUpdatePage = async () => {
    if (!editingPage) return;

    try {
      const response = await fetch(`/api/admin/pages/${editingPage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json() as { success: boolean; data?: PageData; error?: string; message?: string };

      if (result.success) {
        setIsEditDialogOpen(false);
        setEditingPage(null);
        loadPages();
        loadStats();
      } else {
        console.error("Failed to update page:", result.error);
        alert("Failed to update page: " + result.error);
      }
    } catch (error) {
      console.error("Error updating page:", error);
      alert("Error updating page");
    }
  };

  // Toggle page status (publish/unpublish)
  const handleToggleStatus = async (page: PageData, action: 'publish' | 'unpublish') => {
    try {
      const response = await fetch(`/api/admin/pages/${page.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const result = await response.json() as { success: boolean; data?: PageData; error?: string; message?: string };

      if (result.success) {
        loadPages();
        loadStats();
      } else {
        console.error(`Failed to ${action} page:`, result.error);
        alert(`Failed to ${action} page: ` + result.error);
      }
    } catch (error) {
      console.error(`Error ${action}ing page:`, error);
      alert(`Error ${action}ing page`);
    }
  };

  // Delete page
  const handleDeletePage = async (page: PageData) => {
    try {
      const response = await fetch(`/api/admin/pages/${page.id}`, {
        method: 'DELETE'
      });

      const result = await response.json() as { success: boolean; error?: string; message?: string };

      if (result.success) {
        loadPages();
        loadStats();
      } else {
        console.error("Failed to delete page:", result.error);
        alert("Failed to delete page: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting page:", error);
      alert("Error deleting page");
    }
  };

  // Generate content with AI
  const handleGenerateContent = async () => {
    if (!formData.title) {
      alert("Please enter a page title first");
      return;
    }

    setIsGeneratingContent(true);
    
    try {
      const template = getTemplate(formData.template || 'default');
      const templateDescription = template?.description || 'general content page';
      
      const prompt = `CRITICAL: Generate complete, untruncated HTML content. Do NOT stop mid-sentence or mid-tag.

You are generating HTML content for a page titled "${formData.title}" (${templateDescription}) for Mercora outdoor gear eCommerce.

STRICT REQUIREMENTS:
- Generate ONLY inner HTML content (NO DOCTYPE, html, head, body tags)
- Start with: <h1>${formData.title}</h1>  
- Use semantic elements: h2, h3, p, ul, ol, section, div
- Be professional, NO personality, jokes, or conversational tone
- Generate 3-5 comprehensive sections with detailed content
- MUST be complete - no cut-off content or incomplete sentences
- Target 2000-3000 characters for comprehensive coverage

MUST INCLUDE (for completeness):
- Multiple detailed sections with subsections
- Lists with 5-8 items each where appropriate
- Detailed paragraphs explaining policies/procedures
- Contact information or next steps where relevant

Generate complete content now:`;

      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: prompt,
          userName: 'Admin',
          userContext: 'content-generation'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const result = await response.json() as { answer?: string; error?: string };
      
      if (result.answer) {
        // Clean the response to ensure it's just inner HTML content
        let cleanedContent = result.answer
          .replace(/```html/gi, '')
          .replace(/```/g, '')
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
          .replace(/<body[^>]*>/gi, '')
          .replace(/<\/body>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/Camping rule #\d+:.*?-- Volt/gi, '') // Remove Volt's personality additions
          .replace(/\n\s*They're.*?\.\s*/gi, '') // Remove personality continuations
          .replace(/-- Volt.*$/gim, '') // Remove any Volt signatures
          .replace(/\*winks\*/gi, '') // Remove personality actions
          .replace(/\*.*?\*/gi, '') // Remove any action text in asterisks
          .trim();
        
        // Update form data with generated content
        setFormData(prev => ({
          ...prev,
          content: cleanedContent
        }));
      } else {
        throw new Error(result.error || 'No content generated');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Get template by name
  const getTemplate = (templateName: string) => {
    return templates.find(t => t.name === templateName);
  };

  // Format date - handles both Unix timestamps (numbers) and date strings
  const formatDate = (dateValue: string | number) => {
    let date: Date;
    
    if (typeof dateValue === 'number') {
      // Unix timestamp in seconds, convert to milliseconds
      date = new Date(dateValue * 1000);
    } else {
      // Date string
      date = new Date(dateValue);
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Pages Management</h1>
          <p className="text-gray-400 mt-1">
            Manage content pages, privacy policy, terms of service, and other static content.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Page
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-neutral-900 border-neutral-800">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Page</DialogTitle>
            </DialogHeader>
            <CreateEditPageForm
              formData={formData}
              templates={templates}
              onChange={handleInputChange}
              onSubmit={handleCreatePage}
              onCancel={() => setIsCreateDialogOpen(false)}
              onGenerateContent={handleGenerateContent}
              isGeneratingContent={isGeneratingContent}
              isEdit={false}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Pages</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Published</p>
              <p className="text-2xl font-bold text-white">{stats.published}</p>
            </div>
            <Eye className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Drafts</p>
              <p className="text-2xl font-bold text-white">{stats.draft}</p>
            </div>
            <EyeOff className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
        
        <Card className="bg-neutral-800 border-neutral-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Archived</p>
              <p className="text-2xl font-bold text-white">{stats.archived}</p>
            </div>
            <Lock className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-neutral-800 border-neutral-700 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search pages by title or content..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-neutral-700 border-neutral-600 text-white"
            />
          </div>
          <Select value={filterStatus} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-neutral-700 border-neutral-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Pages Table */}
      <Card className="bg-neutral-800 border-neutral-700">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-neutral-700">
                <TableHead className="text-gray-300">Title</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Template</TableHead>
                <TableHead className="text-gray-300">Updated</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    Loading pages...
                  </TableCell>
                </TableRow>
              ) : pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    No pages found
                  </TableCell>
                </TableRow>
              ) : (
                pages.map((page) => {
                  const StatusIcon = STATUS_ICONS[page.status];
                  const template = getTemplate(page.template);
                  
                  return (
                    <TableRow key={page.id} className="border-neutral-700 hover:bg-neutral-700/50">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-white">{page.title}</div>
                          <div className="text-sm text-gray-400">/{page.slug}</div>
                          <div className="flex items-center gap-2">
                            {page.show_in_nav && (
                              <Badge variant="outline" className="text-xs">
                                <Globe className="w-3 h-3 mr-1" />
                                Navigation
                              </Badge>
                            )}
                            {page.is_protected && (
                              <Badge variant="outline" className="text-xs">
                                <Lock className="w-3 h-3 mr-1" />
                                Protected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[page.status]}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {page.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-300">
                          {template?.display_name || page.template}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-gray-300">{formatDate(page.updated_at)}</div>
                          <div className="text-xs text-gray-400">v{page.version}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPage(page)}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          
                          {page.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(page, 'publish')}
                              className="text-green-400 hover:text-green-300 hover:bg-green-900/20"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {page.status === 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(page, 'unpublish')}
                              className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                            >
                              <EyeOff className="w-4 h-4" />
                            </Button>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-neutral-900 border-neutral-800">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">Delete Page</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  Are you sure you want to delete "{page.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-neutral-700 border-neutral-600 text-white hover:bg-neutral-600">
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeletePage(page)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Page</DialogTitle>
          </DialogHeader>
          <CreateEditPageForm
            formData={formData}
            templates={templates}
            onChange={handleInputChange}
            onSubmit={handleUpdatePage}
            onCancel={() => setIsEditDialogOpen(false)}
            onGenerateContent={handleGenerateContent}
            isGeneratingContent={isGeneratingContent}
            isEdit={true}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create/Edit Page Form Component
function CreateEditPageForm({
  formData,
  templates,
  onChange,
  onSubmit,
  onCancel,
  onGenerateContent,
  isGeneratingContent,
  isEdit
}: {
  formData: Partial<PageData>;
  templates: PageTemplate[];
  onChange: (field: keyof PageData, value: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onGenerateContent: () => void;
  isGeneratingContent: boolean;
  isEdit: boolean;
}) {
  const handleTemplateChange = (templateName: string) => {
    const template = templates.find(t => t.name === templateName);
    onChange('template', templateName);
    
    // Set default content if creating new page and template has default content
    if (!isEdit && template?.default_content && !formData.content) {
      onChange('content', template.default_content);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-white">Title *</Label>
          <Input
            id="title"
            value={formData.title || ""}
            onChange={(e) => onChange('title', e.target.value)}
            className="bg-neutral-700 border-neutral-600 text-white"
            placeholder="Enter page title"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="slug" className="text-white">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug || ""}
            onChange={(e) => onChange('slug', e.target.value)}
            className="bg-neutral-700 border-neutral-600 text-white"
            placeholder="page-url-slug"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="status" className="text-white">Status</Label>
          <Select value={formData.status} onValueChange={(value) => onChange('status', value)}>
            <SelectTrigger className="bg-neutral-700 border-neutral-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="template" className="text-white">Template</Label>
          <Select value={formData.template} onValueChange={handleTemplateChange}>
            <SelectTrigger className="bg-neutral-700 border-neutral-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700">
              {templates.map(template => (
                <SelectItem key={template.name} value={template.name}>
                  {template.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content" className="text-white">Content *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerateContent}
            disabled={isGeneratingContent || !formData.title?.trim()}
            className="border-orange-600 text-orange-400 hover:bg-orange-600 hover:text-white"
          >
            {isGeneratingContent ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Bot className="w-3 h-3 mr-1" />
                Generate with Volt AI
              </>
            )}
          </Button>
        </div>
        <Textarea
          id="content"
          value={formData.content || ""}
          onChange={(e) => onChange('content', e.target.value)}
          className="bg-neutral-700 border-neutral-600 text-white min-h-[200px]"
          placeholder="Enter page content (HTML supported) or use Volt AI to generate content"
        />
      </div>

      {/* Excerpt */}
      <div className="space-y-2">
        <Label htmlFor="excerpt" className="text-white">Excerpt</Label>
        <Textarea
          id="excerpt"
          value={formData.excerpt || ""}
          onChange={(e) => onChange('excerpt', e.target.value)}
          className="bg-neutral-700 border-neutral-600 text-white"
          placeholder="Short description of the page"
          rows={3}
        />
      </div>

      {/* SEO Fields */}
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="meta_title" className="text-white">SEO Title</Label>
          <Input
            id="meta_title"
            value={formData.meta_title || ""}
            onChange={(e) => onChange('meta_title', e.target.value)}
            className="bg-neutral-700 border-neutral-600 text-white"
            placeholder="SEO title (defaults to page title)"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="meta_description" className="text-white">SEO Description</Label>
          <Textarea
            id="meta_description"
            value={formData.meta_description || ""}
            onChange={(e) => onChange('meta_description', e.target.value)}
            className="bg-neutral-700 border-neutral-600 text-white"
            placeholder="SEO description for search engines"
            rows={2}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="meta_keywords" className="text-white">SEO Keywords</Label>
          <Input
            id="meta_keywords"
            value={formData.meta_keywords || ""}
            onChange={(e) => onChange('meta_keywords', e.target.value)}
            className="bg-neutral-700 border-neutral-600 text-white"
            placeholder="comma, separated, keywords"
          />
        </div>
      </div>

      {/* Navigation Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="show_in_nav"
            checked={formData.show_in_nav || false}
            onCheckedChange={(checked) => onChange('show_in_nav', checked)}
          />
          <Label htmlFor="show_in_nav" className="text-white">Show in Navigation</Label>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="nav_title" className="text-white">Navigation Title</Label>
          <Input
            id="nav_title"
            value={formData.nav_title || ""}
            onChange={(e) => onChange('nav_title', e.target.value)}
            className="bg-neutral-700 border-neutral-600 text-white"
            placeholder="Alternative title for navigation"
          />
        </div>
      </div>

      {/* Advanced Options */}
      <div className="flex items-center space-x-2">
        <Switch
          id="is_protected"
          checked={formData.is_protected || false}
          onCheckedChange={(checked) => onChange('is_protected', checked)}
        />
        <Label htmlFor="is_protected" className="text-white">Protected Page (requires login)</Label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-neutral-600 text-gray-300 hover:bg-neutral-700"
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {isEdit ? 'Update Page' : 'Create Page'}
        </Button>
      </div>
    </div>
  );
}