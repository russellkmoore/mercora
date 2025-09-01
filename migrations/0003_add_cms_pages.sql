-- Migration: Add CMS (Content Management System) tables
-- Date: 2025-09-01
-- Description: Add pages, page_versions, and page_templates tables for content management

-- Main pages table for content management
CREATE TABLE pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Page identification
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    
    -- Content
    content TEXT NOT NULL, -- Rich text content (HTML)
    excerpt TEXT, -- Optional short description
    
    -- SEO and metadata
    meta_title TEXT, -- SEO title (defaults to title)
    meta_description TEXT, -- SEO description
    meta_keywords TEXT, -- SEO keywords
    
    -- Publishing
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at INTEGER, -- timestamp
    
    -- Content organization
    template TEXT DEFAULT 'default', -- page template type
    parent_id INTEGER REFERENCES pages(id), -- For hierarchical pages
    sort_order INTEGER DEFAULT 0, -- Display order
    
    -- System fields
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    created_by TEXT, -- User ID who created the page
    updated_by TEXT, -- User ID who last updated the page
    
    -- Version control
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Navigation and display
    show_in_nav INTEGER DEFAULT 0 CHECK (show_in_nav IN (0, 1)),
    nav_title TEXT, -- Alternative title for navigation
    
    -- Advanced features
    custom_css TEXT, -- Page-specific styling
    custom_js TEXT, -- Page-specific JavaScript
    
    -- Access control
    is_protected INTEGER DEFAULT 0 CHECK (is_protected IN (0, 1)),
    required_roles TEXT -- JSON array of required roles
);

-- Page versions table for content history
CREATE TABLE page_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    
    -- Versioned content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT,
    
    -- Version metadata
    version INTEGER NOT NULL,
    change_summary TEXT, -- Description of changes
    
    -- System fields
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    created_by TEXT NOT NULL
);

-- Page templates configuration
CREATE TABLE page_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Template identification
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    
    -- Template configuration
    fields TEXT NOT NULL, -- JSON configuration of fields
    default_content TEXT, -- Default content for new pages
    
    -- System fields
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- Indexes for performance on pages table
CREATE INDEX pages_slug_idx ON pages(slug);
CREATE INDEX pages_status_idx ON pages(status);
CREATE INDEX pages_parent_idx ON pages(parent_id);
CREATE INDEX pages_published_idx ON pages(published_at);
CREATE INDEX pages_nav_idx ON pages(show_in_nav);

-- Index for page versions
CREATE INDEX page_versions_page_id_version_idx ON page_versions(page_id, version);

-- Indexes for page templates
CREATE INDEX page_templates_name_idx ON page_templates(name);
CREATE INDEX page_templates_active_idx ON page_templates(is_active);

-- Insert default page templates
INSERT INTO page_templates (name, display_name, description, fields, default_content) VALUES
(
    'default',
    'Default Page',
    'Standard content page with title and content',
    '{"title": {"type": "text", "required": true}, "content": {"type": "richtext", "required": true}, "excerpt": {"type": "textarea", "required": false}}',
    '<p>Enter your page content here...</p>'
),
(
    'legal',
    'Legal Document',
    'Template for privacy policy, terms of service, etc.',
    '{"title": {"type": "text", "required": true}, "content": {"type": "richtext", "required": true}, "last_updated": {"type": "date", "required": true}, "effective_date": {"type": "date", "required": false}}',
    '<h2>1. Introduction</h2><p>Enter your legal document content here...</p><h2>2. Definitions</h2><p>Define key terms...</p><h2>3. Contact Information</h2><p>How to contact us regarding this document...</p>'
),
(
    'about',
    'About Page',
    'Company or team information page',
    '{"title": {"type": "text", "required": true}, "content": {"type": "richtext", "required": true}, "hero_image": {"type": "image", "required": false}, "team_section": {"type": "richtext", "required": false}}',
    '<h2>Our Story</h2><p>Tell your company''s story...</p><h2>Our Mission</h2><p>What drives us...</p><h2>Our Team</h2><p>Meet the people behind the company...</p>'
);

-- Insert some sample pages to demonstrate the system
INSERT INTO pages (title, slug, content, status, template, meta_description, show_in_nav, sort_order) VALUES
(
    'Privacy Policy',
    'privacy-policy',
    '<h1>Privacy Policy</h1><p><strong>Last Updated:</strong> ' || date('now') || '</p><h2>1. Information We Collect</h2><p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us.</p><h2>2. How We Use Your Information</h2><p>We use the information we collect to provide, maintain, and improve our services.</p><h2>3. Information Sharing</h2><p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent.</p><h2>4. Contact Us</h2><p>If you have any questions about this Privacy Policy, please contact us.</p>',
    'published',
    'legal',
    'Learn how we collect, use, and protect your personal information.',
    1,
    100
),
(
    'Terms of Service',
    'terms-of-service',
    '<h1>Terms of Service</h1><p><strong>Last Updated:</strong> ' || date('now') || '</p><h2>1. Acceptance of Terms</h2><p>By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.</p><h2>2. Description of Service</h2><p>We provide an AI-powered eCommerce platform for outdoor gear and equipment.</p><h2>3. User Accounts</h2><p>You are responsible for maintaining the confidentiality of your account credentials.</p><h2>4. Contact Information</h2><p>For questions about these terms, please contact us.</p>',
    'published',
    'legal',
    'Read our terms and conditions for using our eCommerce platform.',
    1,
    101
),
(
    'About Us',
    'about',
    '<h1>About Mercora</h1><h2>Our Story</h2><p>Mercora is an innovative AI-powered eCommerce platform specializing in outdoor gear and equipment. We combine cutting-edge artificial intelligence with a passion for outdoor adventures.</p><h2>Our Mission</h2><p>To revolutionize the outdoor gear shopping experience through intelligent recommendations, personalized service, and expert knowledge powered by AI.</p><h2>Why Choose Us</h2><ul><li><strong>AI-Powered Recommendations:</strong> Our intelligent assistant Volt helps you find the perfect gear</li><li><strong>Expert Knowledge:</strong> Comprehensive product information and outdoor expertise</li><li><strong>Quality Products:</strong> Carefully curated selection of premium outdoor equipment</li><li><strong>Fast Shipping:</strong> Quick delivery to get you outdoors faster</li></ul><h2>Contact Us</h2><p>Have questions? Our team is here to help you find the perfect outdoor gear for your next adventure.</p>',
    'published',
    'about',
    'Learn about our mission to revolutionize outdoor gear shopping through AI.',
    1,
    1
);