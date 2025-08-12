import { serve } from "@hono/node-server";
import app from "./src/app.ts";

serve(app, (info) => {
	const host = info.family === "IPv6" ? `[${info.address}]` : info.address;
	console.log(`RSS Server is running on http://${host}:${info.port}/`);
});
