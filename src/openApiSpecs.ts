import type { OpenApiSpecsOptions } from "hono-openapi";
import packageJson from "../package.json" with { type: "json" };
import { API_KEY_SECURITY_SCHEMA_NAME } from "./models/apiKeyAuthSecurity.ts";
import { API_KEY_HEADER_NAME } from "./constants.ts";
import { port } from "./globalContext.ts";

export const openApiSpecs: OpenApiSpecsOptions = {
	documentation: {
		info: {
			title: packageJson.name,
			version: packageJson.version,
			description: packageJson.description,
		},
		components: {
			securitySchemes: {
				[API_KEY_SECURITY_SCHEMA_NAME]: {
					type: "apiKey",
					in: "header",
					name: API_KEY_HEADER_NAME,
				},
			},
		},
		servers: [{ url: `http://localhost:${port}`, description: "Local Server" }],
	},
};
