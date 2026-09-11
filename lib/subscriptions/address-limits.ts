/**
 * Shared field-length cap for a shipping address's `city` and `region`.
 *
 * Three independent layers validate a saved address for the subscription
 * flow, and all three must agree or an address that passes an earlier layer
 * fails at a later one:
 *  - `components/subscriptions/acquisition-client.ts` (`shippingAddressFromSaved`)
 *    — the client-side filter applied when the panel loads/refreshes the list.
 *  - `lib/subscriptions/acquisition-service.ts` (`assertValidShippingAddress`
 *    equivalent guard) — the server-side acquisition-service guard.
 *  - `app/api/setup-intent/route.ts` (`parseAddress`) — the setup-intent
 *    route's own request parser.
 *
 * Change the bound here; the three call sites import it rather than
 * hardcoding their own number.
 */
export const ADDRESS_CITY_REGION_MAX = 200;
