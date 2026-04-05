/**
 * Auth.js API Route Handler.
 * Handles /api/auth/* routes (signin, callback, signout, etc.)
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
