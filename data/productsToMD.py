import csv
import os

input_csv = "products.csv"
output_dir = "products_md"

os.makedirs(output_dir, exist_ok=True)

with open(input_csv, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        slug = row["slug"]
        filename = os.path.join(output_dir, f"{slug}.md")
        ai_notes = row.get("ai_notes", "").strip()
        notes_section = f"\n**AI NOTES:** {ai_notes}\n" if ai_notes else ""

        # Parse raw values
        regular_price = int(row["price"]) / 100
        on_sale = row.get("on_sale", "0") in ["1", "true", "TRUE", "yes"]
        has_sale_price = row.get("sale_price", "").strip() != ""

        # Decide which price to show as primary
        if on_sale and has_sale_price:
            sale_price = int(row["sale_price"]) / 100
            formatted_price = f"${sale_price:.2f}"
        else:
            sale_price = None
            formatted_price = f"${regular_price:.2f}"
        
        tags = row.get("tags", "").replace(",", ", ")
        use_cases = row.get("use_cases", "").replace(",", ", ")
        attributes = row.get("attributes", "").split(",")

        attr_list = "\n".join(f"- {a.strip().replace(':', ': ')}" for a in attributes if ":" in a)

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

        with open(filename, "w", encoding="utf-8") as f:
            f.write(content)
        
