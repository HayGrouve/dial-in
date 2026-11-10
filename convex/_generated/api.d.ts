/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as brews from "../brews.js";
import type * as coffees from "../coffees.js";
import type * as crons from "../crons.js";
import type * as data from "../data.js";
import type * as equipment from "../equipment.js";
import type * as erase from "../erase.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as import_ from "../import.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_clerkWebhook from "../lib/clerkWebhook.js";
import type * as lib_fields from "../lib/fields.js";
import type * as lib_photos from "../lib/photos.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  brews: typeof brews;
  coffees: typeof coffees;
  crons: typeof crons;
  data: typeof data;
  equipment: typeof equipment;
  erase: typeof erase;
  files: typeof files;
  http: typeof http;
  import: typeof import_;
  "lib/auth": typeof lib_auth;
  "lib/clerkWebhook": typeof lib_clerkWebhook;
  "lib/fields": typeof lib_fields;
  "lib/photos": typeof lib_photos;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
