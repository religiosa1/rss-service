#!/usr/bin/env node

/* Generating OpenAPI json specs.
 * you can run this script with `npm run --silent generate-openapi-specs` or
 * with just `node ./scripts/generateOpenApiSpecs.ts`
 */

import { generateSpecs } from "hono-openapi";
import { app } from "../src/app.ts";
import { openApiSpecs } from "../src/openApiSpecs.ts";

const spec = await generateSpecs(app, openApiSpecs);
process.stdout.write(JSON.stringify(spec, null, 2));
