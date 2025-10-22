import type { GenerateSpecOptions } from "hono-openapi";
import packageJson from "../package.json" with { type: "json" };
import { API_KEY_HEADER_NAME } from "./constants.ts";
import { port } from "./globalContext.ts";
import { API_KEY_SECURITY_SCHEMA_NAME } from "./models/apiKeyAuthSecurity.ts";

export const openApiSpecs: Partial<GenerateSpecOptions> = {
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
			headers: {
				"X-Request-Id": { schema: { type: "string" } },
			},
		},
		servers: [{ url: `http://localhost:${port}`, description: "Local Server" }],
	},
};
