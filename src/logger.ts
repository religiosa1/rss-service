import pino from "pino";

export const logger = setupLogger();

function setupLogger(nodeEnv = process.env.NODE_ENV): pino.Logger {
	switch (nodeEnv) {
		case "production":
			return setupProdLogger();
		case "test":
			return pino({ level: "silent" });
		default:
			return pino({
				base: null,
				level: "trace",
				transport: {
					target: "hono-pino/debug-log",
				},
				timestamp: pino.stdTimeFunctions.epochTime,
			});
	}
}

function setupProdLogger(): pino.Logger {
	// TODO otel support
	return pino({
		base: null,
		level: "info",
		timestamp: pino.stdTimeFunctions.epochTime,
	});
}
