import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RouteError from "@/app/error";
import GlobalError from "@/app/global-error";

const secret = "private database exception: record detail";
const error = Object.assign(new Error(secret), { digest: "private-digest" });

describe("neutral error boundaries", () => {
  it("renders a route fallback without exposing exception details", () => {
    const html = renderToStaticMarkup(React.createElement(RouteError, { error, reset() {} }));
    expect(html).toContain("Something went wrong");
    expect(html).not.toContain(secret);
    expect(html).not.toContain("private-digest");
  });

  it("renders the root fallback without application providers or error details", () => {
    const html = renderToStaticMarkup(React.createElement(GlobalError, { error, reset() {} }));
    expect(html).toContain("<html");
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html).not.toContain(secret);
    expect(html).not.toContain("private-digest");
  });
});
