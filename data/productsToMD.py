"""
=== Product CSV to Markdown Converter ===

This script converts product data from a CSV file into individual markdown files
for use in the Mercora eCommerce platform. Each product becomes a separate .md
file with frontmatter metadata and formatted content.

=== Purpose ===
- Transform CSV product data into markdown files for static site generation
- Generate consistent frontmatter for product pages
- Handle pricing logic for regular vs sale prices
- Format product attributes and descriptions for display
- Support AI vectorization by creating structured product content

=== Input Format ===
Expects a CSV file (products.csv) with the following columns:
- id: Unique product identifier
- name: Product display name
- slug: URL-friendly product identifier
- categories: Product categories
- price: Regular price in cents (e.g., 2999 for $29.99)
- sale_price: Sale price in cents (optional)
- on_sale: Boolean indicator (1/true/yes for on sale)
- short_description: Brief product summary
- long_description: Detailed product information
- tags: Comma-separated product tags
- use_cases: Comma-separated use case scenarios
- attributes: Comma-separated key:value attribute pairs
- ai_notes: Additional notes for AI context (optional)

=== Output Format ===
Creates markdown files in products_md/ directory with:
- YAML frontmatter containing structured metadata
- Formatted product descriptions
- Parsed attributes list
- AI notes section (if present)

=== Usage ===
    python productsToMD.py

=== Dependencies ===
- csv (standard library)
- os (standard library)

=== Author ===
Russell Moore - Mercora eCommerce Platform
"""

import csv
import os

# Configuration constants
INPUT_CSV = "products.csv"
OUTPUT_DIR = "products_md"

def parse_price(price_str):
    """
    Convert price string from cents to dollars.
    
    Args:
        price_str (str): Price in cents (e.g., "2999")
    
    Returns:
        float: Price in dollars (e.g., 29.99)
    """
    return int(price_str) / 100

def is_on_sale(sale_flag):
    """
    Determine if product is on sale based on various flag formats.
    
    Args:
        sale_flag (str): Sale indicator from CSV
    
    Returns:
        bool: True if product is on sale
    """
    return sale_flag in ["1", "true", "TRUE", "yes"]

def format_comma_separated(value):
    """
    Clean and format comma-separated values.
    
    Args:
        value (str): Comma-separated string
    
    Returns:
        str: Formatted string with proper spacing
    """
    return value.replace(",", ", ")

def parse_attributes(attributes_str):
    """
    Parse attribute string into formatted list.
    
    Args:
        attributes_str (str): Comma-separated key:value pairs
    
    Returns:
        str: Formatted markdown list of attributes
    """
    attributes = attributes_str.split(",")
    attr_list = []
    
    for attr in attributes:
        attr = attr.strip()
        if ":" in attr:
            # Format as "key: value" for better readability
            formatted_attr = attr.replace(':', ': ')
            attr_list.append(f"- {formatted_attr}")
    
    return "\n".join(attr_list)

def determine_pricing(row):
    """
    Calculate pricing display logic for regular vs sale prices.
    
    Args:
        row (dict): CSV row data
    
    Returns:
        tuple: (formatted_price, regular_price, sale_price_or_none)
    """
    regular_price = parse_price(row["price"])
    on_sale = is_on_sale(row.get("on_sale", "0"))
    has_sale_price = row.get("sale_price", "").strip() != ""

    if on_sale and has_sale_price:
        sale_price = parse_price(row["sale_price"])
        formatted_price = f"${sale_price:.2f}"
        return formatted_price, regular_price, sale_price
    else:
        formatted_price = f"${regular_price:.2f}"
        return formatted_price, regular_price, None

def generate_markdown_content(row):
    """
    Generate complete markdown content for a product.
    
    Args:
        row (dict): CSV row containing product data
    
    Returns:
        str: Complete markdown file content
    """
    slug = row["slug"]
    ai_notes = row.get("ai_notes", "").strip()
    notes_section = f"\n**AI NOTES:** {ai_notes}\n" if ai_notes else ""

    # Process pricing
    formatted_price, regular_price, sale_price = determine_pricing(row)
    
    # Format lists and attributes
    tags = format_comma_separated(row.get("tags", ""))
    use_cases = format_comma_separated(row.get("use_cases", ""))
    attr_list = parse_attributes(row.get("attributes", ""))

    # Build frontmatter and content
    content = f"""---
id: {row['id']}
title: {row['name']}
slug: {slug}
categories: {row['categories']}
price: {formatted_price}
regular_price: ${regular_price:.2f}
on_sale: {"true" if sale_price else "false"}
tags: [{tags}]
use_cases: [{use_cases}]
---

{row['short_description']}

{notes_section}

## Details

{row['long_description']}

## Attributes

{attr_list}
"""
    return content

def main():
    """
    Main function to process CSV and generate markdown files.
    
    Reads the input CSV file and creates individual markdown files
    for each product in the output directory.
    """
    # Create output directory if it doesn't exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    try:
        with open(INPUT_CSV, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            processed_count = 0
            for row in reader:
                slug = row["slug"]
                filename = os.path.join(OUTPUT_DIR, f"{slug}.md")
                
                # Generate markdown content
                content = generate_markdown_content(row)
                
                # Write to file
                with open(filename, "w", encoding="utf-8") as f:
                    f.write(content)
                
                processed_count += 1
                print(f"Generated: {filename}")
            
            print(f"\n✅ Successfully processed {processed_count} products")
            print(f"📁 Output directory: {OUTPUT_DIR}/")
    
    except FileNotFoundError:
        print(f"❌ Error: {INPUT_CSV} not found")
        print("Please ensure the CSV file exists in the current directory")
    
    except Exception as e:
        print(f"❌ Error processing CSV: {str(e)}")

if __name__ == "__main__":
    main()
        
