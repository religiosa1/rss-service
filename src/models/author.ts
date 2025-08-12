import z from "zod";
import { URL_LENGTH } from "../constants.ts";

export const authorScheme = z.object({
	name: z.string().max(254).nullable().optional(),
	email: z.string().max(254).nullable().optional(),
	link: z.string().max(URL_LENGTH).url().nullable().optional(),
	avatar: z.string().max(URL_LENGTH).url().nullable().optional(),
});
export type AuthorModel = z.infer<typeof authorScheme>;
