/** biome-ignore-all lint/suspicious/noConfusingVoidType: for consistency with validator types */
/** biome-ignore-all lint/complexity/noBannedTypes: for consistency with validator types */

import type { Env, Input, MiddlewareHandler, TypedResponse, ValidationTargets } from "hono";
import { validator as hValidator, type ResolverReturnType } from "hono-openapi";
import type { Hook } from "@hono/standard-validator";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type HasUndefined<T> = undefined extends T ? true : false;

/**
 * Wrapper around hono-openapi validator, modifying the validation error response
 * shape through a decorated hook.
 *
 * Type information and generic magic are copy-pasted directly from validator,
 * with no modifications
 */
export function validator<
	Schema extends StandardSchemaV1<unknown, unknown>,
	Target extends keyof ValidationTargets,
	E extends Env,
	P extends string,
	In = StandardSchemaV1.InferInput<Schema>,
	Out = StandardSchemaV1.InferOutput<Schema>,
	I extends Input = {
		in: HasUndefined<In> extends true
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
	V extends I = I
>(
	target: Target,
	schema: Schema,
	hook?: Hook<StandardSchemaV1.InferOutput<Schema>, E, P, Target>,
	options?: ResolverReturnType["options"]
): MiddlewareHandler<E, P, V> {
	return hValidator<Schema, Target, E, P, In, Out, I, V>(
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
		},
		options
	);
}
