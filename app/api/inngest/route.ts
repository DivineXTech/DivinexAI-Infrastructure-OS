import { serve } from "inngest/next";
import { inngest } from "@/src/workflow/inngest/client";
import { atlasFunctions } from "@/src/workflow/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: atlasFunctions,
});
