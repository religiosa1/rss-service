import { resolver } from "hono-openapi/zod";
import z from "zod";

const errorResponseSchema = z.object({
	success: z.literal(false),
	status: z.number().int().min(400).max(599),
	message: z.string(),
});
export type ErrorResponseModel = z.infer<typeof errorResponseSchema>;

export const errorResponseOpenApiSchema = {
	"application/json": { schema: resolver(errorResponseSchema) },
} as const;

const zodIssueSchema = z.object({
	code: z.string(),
	expected: z.any().optional(),
	received: z.any().optional(),
	path: z.array(z.union([z.string(), z.number()])),
	message: z.string(),
});

const validationErrorResponseSchema = errorResponseSchema.extend({
	error: z
		.object({
			issues: z.array(zodIssueSchema),
			name: z.literal("ZodError"),
		})
		.describe("Zod error object"),
});

export const validationErrorResponseOpenApiSchema = {
	"application/json": { schema: resolver(validationErrorResponseSchema) },
};
