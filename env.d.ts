declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/** Name of libsql database file (or a turso url)*/
			DB_FILE_NAME?: string;
			/** authToken for Turso/libsql http */
			DB_AUTH_TOKEN?: string;
			/** Do not apply DB migrations on app startup */
			DB_SKIP_MIGRATIONS?: boolean;
			/** TCP Port on which service will run */
			PORT?: string;
			/** Host/ip address where to listen to. Defaults to "localhost" */
			HOST?: string;
			/** Disable both OpenApi and Scalar documentation */
			DISABLE_OPEN_API?: boolean;
			/** Disable Scalar documentation (OpenApi schema will still be on) */
			DISABLE_SCALAR?: boolean;
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
		}
	}
}

export {};
