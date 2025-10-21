declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/** Name of libsql database file (or a turso url)*/
			DB_FILE_NAME?: string;
			/** authToken for Turso/libsql http */
			DB_AUTH_TOKEN?: string;
			/** Do not apply DB migrations on app startup if set to "1" */
			DB_SKIP_MIGRATIONS?: string;
			/** TCP Port on which service will run */
			PORT?: string;
			/** Host/ip address where to listen to. Defaults to "localhost" */
			HOST?: string;
			/** Disable both OpenApi and Scalar documentation if set to "1" */
			DISABLE_OPEN_API?: string;
			/** Disable Scalar documentation (OpenApi schema will still be on) */
			DISABLE_SCALAR?: string;
			/** Disable prometheus metrics if set to "1" */
			DISABLE_PROMETHEUS?: string;
			/** API key used to authorize the create/update/delete endpoints */
			API_KEY?: string;
			/** Public url of the service, for values in feeds */
			PUBLIC_URL?: string;
			/** Value used in generator field of RSS feeds. */
			RSS_GENERATOR?: string;
			/** Your usual: production, development, test
			 *
			 * "test" value modifies the behavior of the service for compatibility
			 * with node test runner and should only be used during the test runner
			 * launches.
			 */
			NODE_ENV?: string;

			// OpenTelemetry logging; consumed by pino-opentelemetry-transport

			/**
			 * OTLP collector endpoint. If set, logging information will be
			 * supported to the provided endpoint (otherwise logs to stdout)
			 */
			OTEL_EXPORTER_OTLP_ENDPOINT;
			/** Logging-specific override OTLP endpoint */
			OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string;

			/** OTEL logging format, possible values:
			 * http/protobuf, grpc, http or console */
			OTEL_EXPORTER_OTLP_PROTOCOL?: string;
			/** Logging-specific override for OTLP_PROTOCOL */
			OTEL_EXPORTER_OTLP_LOGS_PROTOCOL?: string;
		}
	}
}

export {};
