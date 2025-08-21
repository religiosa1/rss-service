import pino from "pino";
import packageJson from "../package.json" with { type: "json" };

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
	const { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT } = process.env;
	const isOtelLogging = OTEL_EXPORTER_OTLP_ENDPOINT || OTEL_EXPORTER_OTLP_LOGS_ENDPOINT;
	const transport = isOtelLogging
		? {
				targets: [
					{
						target: "pino-opentelemetry-transport",
						options: {
							resourceAttributes: {
								"service.name": packageJson.name,
								"service.version": packageJson.version,
							},
						},
					},
					{
						target: "pino/file",
						options: { destination: 1 }, // stdout
					},
				],
			}
		: undefined;
	return pino({
		base: null,
		level: "info",
		transport,
		timestamp: pino.stdTimeFunctions.epochTime,
	});
}
