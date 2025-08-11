import z from "zod";
import { SLUG_LENGTH } from "../constants.ts";

export const slugSchema = z.string().min(1).max(SLUG_LENGTH).regex(/^\w+$/);
