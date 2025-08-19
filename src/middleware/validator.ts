/** biome-ignore-all lint/suspicious/noConfusingVoidType: for consistency with zValidator types */
/** biome-ignore-all lint/complexity/noBannedTypes: for consistency with zValidator types */

import type { Hook } from "@hono/zod-validator";

import type { Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from "hono";
import { validator as zValidator } from "hono-openapi/zod";
import type { ZodSchema, z } from "zod";

/**
 * Wrapper around hono-openapi/zod, modifying the validation error response
 * shape through a decorated hook.
 *
 * Type information and generic magic are copy-pasted directly from zValidator,
 * with minimal modifications (HasUndefined helper type removed for the sake of brevity)
 */
export function validator<
	T extends ZodSchema,
	Target extends keyof ValidationTargets,
	E extends Env,
	P extends string,
	In = z.input<T>,
	Out = z.output<T>,
	I extends Input = {
		in: undefined extends In
			? {
					[K in Target]?: In extends ValidationTargets[K]
						? In
						: {
								[K2 in keyof In]?: ValidationTargets[K][K2];
							};
				}
			: {
					[K in Target]: In extends ValidationTargets[K]
						? In
						: {
								[K2 in keyof In]: ValidationTargets[K][K2];
							};
				};
		out: {
			[K in Target]: Out;
		};
	},
	V extends I = I,
>(target: Target, schema: T, hook?: Hook<z.infer<T>, E, P, Target>): MiddlewareHandler<E, P, V> {
	return zValidator<T, Target, E, P, In, Out, I>(
		target,
		schema,
		async (result, c): Promise<void | Response | TypedResponse<{}>> => {
			if (hook) {
				const hookResult = await hook(result, c);
				if (hookResult) {
					if (hookResult instanceof Response) {
						return hookResult;
					}

					if ("response" in hookResult) {
						return hookResult.response as Response;
					}
				}
			}
			if (!result.success) {
				return c.json(
					{
						success: false,
						status: 400,
						message: "Bad request",
						error: result.error,
					},
					400
				);
			}
		}
	);
}
