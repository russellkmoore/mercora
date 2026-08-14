-- Additive content-publishing foundation.
--
-- Deploy/rollback contract:
-- - Old application code ignores these tables and template rows.
-- - New code treats empty blog tables as a valid no-content state.
-- - Roll back by deploying old code; do not down-migrate content tables.
-- - No existing CMS page or template row is updated or deleted.

CREATE TABLE blog_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
    slug TEXT NOT NULL UNIQUE CHECK (
        length(slug) BETWEEN 1 AND 160
        AND slug NOT GLOB '*[^a-z0-9-]*'
        AND substr(slug, 1, 1) != '-'
        AND substr(slug, -1, 1) != '-'
    ),
    description TEXT CHECK (description IS NULL OR length(description) <= 1000),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()) CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()) CHECK (updated_at >= 0)
);

CREATE INDEX blog_categories_slug_idx ON blog_categories(slug);

CREATE TABLE blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    slug TEXT NOT NULL UNIQUE CHECK (
        length(slug) BETWEEN 1 AND 160
        AND slug NOT GLOB '*[^a-z0-9-]*'
        AND substr(slug, 1, 1) != '-'
        AND substr(slug, -1, 1) != '-'
    ),
    author TEXT NOT NULL CHECK (length(trim(author)) BETWEEN 1 AND 160),
    excerpt TEXT CHECK (excerpt IS NULL OR length(excerpt) <= 1000),
    tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags) AND json_type(tags) = 'array'),
    cover_image_url TEXT CHECK (cover_image_url IS NULL OR length(cover_image_url) <= 2048),
    cover_image_alt TEXT CHECK (cover_image_alt IS NULL OR length(cover_image_alt) <= 300),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    editor_json TEXT CHECK (editor_json IS NULL OR (length(editor_json) <= 1048576 AND json_valid(editor_json))),
    html TEXT NOT NULL DEFAULT '' CHECK (length(html) <= 1048576),
    reading_time INTEGER NOT NULL DEFAULT 1 CHECK (reading_time BETWEEN 1 AND 1440),
    category_id INTEGER REFERENCES blog_categories(id) ON DELETE SET NULL,
    meta_title TEXT CHECK (meta_title IS NULL OR length(meta_title) <= 200),
    meta_description TEXT CHECK (meta_description IS NULL OR length(meta_description) <= 500),
    published_at INTEGER CHECK (published_at IS NULL OR published_at >= 0),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()) CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()) CHECK (updated_at >= 0),
    created_by TEXT CHECK (created_by IS NULL OR length(created_by) <= 255),
    updated_by TEXT CHECK (updated_by IS NULL OR length(updated_by) <= 255)
);

CREATE INDEX blog_posts_slug_idx ON blog_posts(slug);
CREATE INDEX blog_posts_status_published_idx ON blog_posts(status, published_at DESC);
CREATE INDEX blog_posts_category_idx ON blog_posts(category_id);
CREATE INDEX blog_posts_updated_idx ON blog_posts(updated_at DESC);

-- These rows make every generic structured layout selectable by the existing
-- CMS editor. Existing merchant-owned templates win on name conflicts.
INSERT OR IGNORE INTO page_templates
    (name, display_name, description, fields, default_content)
VALUES
(
    'guide',
    'Structured Guide',
    'Sectioned how-to content. Each level-two heading begins a section.',
    '{"title":{"type":"text","required":true},"content":{"type":"richtext","required":true},"excerpt":{"type":"textarea","required":false}}',
    '<p>Introduce the guide.</p><h2>First step</h2><p>Explain what to do.</p><h2>Next step</h2><p>Continue the guide.</p>'
),
(
    'faq',
    'FAQ',
    'Frequently asked questions. Each level-two heading is a question.',
    '{"title":{"type":"text","required":true},"content":{"type":"richtext","required":true},"excerpt":{"type":"textarea","required":false}}',
    '<h2>What should customers know?</h2><p>Write the answer here.</p><h2>Where can they get help?</h2><p>Write the answer here.</p>'
),
(
    'contact',
    'Contact',
    'Contact and support information arranged in short sections.',
    '{"title":{"type":"text","required":true},"content":{"type":"richtext","required":true},"excerpt":{"type":"textarea","required":false}}',
    '<h2>Email</h2><p>Add your configured support address.</p><h2>Support hours</h2><p>Add your support hours.</p>'
),
(
    'story',
    'Story',
    'Long-form company, mission, or editorial narrative.',
    '{"title":{"type":"text","required":true},"content":{"type":"richtext","required":true},"excerpt":{"type":"textarea","required":false}}',
    '<p>Introduce the story.</p><h2>Background</h2><p>Tell the story here.</p><h2>Mission</h2><p>Explain what drives the organization.</p>'
);
