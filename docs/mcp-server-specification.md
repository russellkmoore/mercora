# Mercora MCP commerce API

Mercora exposes an authenticated HTTP API for agent-assisted catalog discovery,
session carts, checkout, and order status. The API is store-neutral: catalog,
shipping, pricing, tax, promotion, inventory, and payment behavior comes from
the same configuration and services used by the storefront.

The tool schema is available from `GET /api/mcp/schema`. Authenticated clients
can use either the individual REST routes under `/api/mcp` or the JSON tool
dispatcher at `POST /api/mcp`.

## Authentication and credentials

Send an agent credential in one of these headers:

```http
X-Agent-API-Key: mcp_...
```

```http
Authorization: Bearer mcp_...
```

Query-string credentials are not accepted. New credentials are generated with
Web Crypto, stored only as SHA-256 digests, expire after 90 days by default,
and are returned in plaintext only when created or rotated. A manager can
choose a lifetime from 1 through 365 days.

Migration `0012_expand_mcp_agent_credentials.sql` uses an
expand/rotate/contract transition:

1. Existing plaintext credentials remain usable initially.
2. The first successful use stores the digest, retires the plaintext value,
   and gives the credential a 30-day rotation window.
3. Explicit rotation immediately replaces the credential and its expiry.
4. The legacy column can be removed in a future contract migration after no
   version-1 credentials remain.

The public demo credential formerly installed by a migration is removed.
`npm run dev` applies `data/d1/seed-dev.sql` to the local D1 database only; its
known test credential is never installed by preview or production migrations.

### Permissions

Permissions are deny-by-default. `admin` and `*` satisfy all scopes.

| Permission | Allows |
| --- | --- |
| `write:cart` | Add, update, remove, bulk-add, or clear cart lines |
| `place:orders` | Create a bound PaymentIntent and finalize an order |
| `agents:manage` | Create, list, inspect, disable, and rotate agents |

An `agents:manage` credential cannot delegate a permission it does not hold.
Only `admin` or `*` may delegate arbitrary permissions.

Per-agent requests-per-minute limits apply to every authenticated request. The
orders-per-hour limit applies to `place_order`. D1 stores and resets both
counters by fixed time window.

## Identity and session ownership

The authenticated credential is the sole source of agent identity.
`X-Agent-Context` may carry bounded user preferences, but a client-provided
`agentId` is always replaced with the authenticated agent ID.

Session IDs use cryptographically random UUIDs. Every cart, shipping, payment,
and order mutation verifies that the session belongs to the authenticated
agent before reading or changing it. Order lookup also verifies the agent ID;
an order identifier alone is not authorization.

Create a session with:

```http
POST /api/mcp/sessions
X-Agent-API-Key: mcp_...
```

Use the returned `sessionId` for subsequent cart and checkout tools.

## Catalog and wire data

Discovery capabilities are derived from active catalog categories, product
prices, shipping settings, and allowed countries. No demo-store categories,
brands, product names, or fulfillment claims are compiled into MCP responses.

Only active products and variants cross the public MCP boundary. Internal
costs, inventory records, barcodes, integration references, extensions, and
media-processing metadata are removed by the shared public product serializer.

Money responses use the MACH decimal wire shape:

```json
{ "amount": 31.49, "currency": "USD", "precision": 2 }
```

Persisted commerce values remain integer minor units. Shipping and billing
addresses accept either legacy flat names such as `street`, `state`, and
`postalCode` or MACH names such as `line1`, `region`, and `postal_code`; they
are normalized before pricing or persistence.

## Commerce workflow

The safe purchase sequence is:

1. Create a session.
2. Search the active catalog and add product/variant IDs to the session cart.
3. Request shipping options for that owned session and address.
4. Call `create_payment_intent` with the session, shipping address, configured
   shipping method, and optional discount or gift-card input.
5. Complete the returned Stripe PaymentIntent using its client secret.
6. Call `place_order` with the returned `orderId` and `paymentIntentId`.
7. Poll `get_order_status` with the order ID when needed.

`create_payment_intent` does not trust cart names or prices. It reloads each
product and variant, validates inventory, applies configured shipping,
promotions, gift cards, and tax through the shared checkout pricing service,
then creates both:

- a Stripe PaymentIntent whose amount, currency, order ID, agent ID, and
  session ID are bound in metadata; and
- a durable pending order containing the exact canonical quote and line
  allocations.

If Stripe returns a mismatched amount or currency, or pending-order persistence
fails, Mercora cancels the PaymentIntent. `place_order` verifies that the
pending order, PaymentIntent, agent, and session all match before invoking the
shared idempotent payment finalizer. That finalizer verifies captured payment
with Stripe and runs the same durable inventory and post-payment effects as the
storefront.

Client-supplied totals, display names, prices, cart objects, and paid flags are
never authoritative.

## Tool summary

| Area | Tools |
| --- | --- |
| Discovery | `search_products`, `assess_request`, `get_recommendations` |
| Cart | `add_to_cart`, `update_cart`, `remove_from_cart`, `get_cart`, `bulk_add_to_cart`, `clear_cart` |
| Checkout | `get_shipping_options`, `validate_payment`, `create_payment_intent`, `place_order` |
| Orders | `get_order_status` |
| Agents | `create_agent`, `list_agents`, `get_agent_details`, `update_agent_status`, `rotate_agent_key` |

`get_order_status` returns only an order owned by the authenticated agent. Its
`shipment` object is derived from server-owned carrier/tracking columns and the
validated runtime carrier registry; stored or client-provided tracking URLs are
never trusted. `tracking_history` contains the real order-created marker plus a
bounded, customer-safe projection of `shipment_created` and `tracking_updated`
audit events. Actor identifiers, email-delivery events, and opaque event details
are not exposed. Legacy shipped orders without an audit row fall back to their
persisted `shipped_at` marker rather than receiving fabricated history.

The dedicated `/api/mcp/tools/order/track` endpoint presents the same owned
shipment as camel-cased carrier, tracking-link, and history fields. Missing,
non-MCP, and differently owned orders remain indistinguishable.

## Rotation operations

Managers can rotate an agent credential through either interface:

- `PATCH /api/mcp/tools/agents/{agentId}` with
  `{ "rotateApiKey": true, "apiKeyTtlDays": 90 }`; or
- the dispatcher tool `rotate_agent_key` with `agentId` and optional
  `apiKeyTtlDays`.

Store the returned key immediately. Rotation invalidates the previous key and
the plaintext replacement cannot be recovered from the database.

Before removing legacy credential support, operators should confirm that no
active row remains at credential version 1 and that all required clients have
received rotated credentials.
