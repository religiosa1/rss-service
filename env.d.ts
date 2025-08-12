declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/** Name of libsql database file (or a turso url)*/
			DB_FILE_NAME: string | undefined;
			/** authToken for Turso/libsql http */
			DB_AUTH_TOKEN: stirng | undefined;
			/** Do not apply DB migrations on app startup */
			DB_SKIP_MIGRATIONS: boolean | undefined;
			/** TCP Port on which service will run */
			PORT: string | undefined;
			/** Disable both OpenApi and Scalar documentation */
			DISABLE_OPEN_API: boolean | undefined;
			/** Disable Scalar documentation (OpenApi schema will still be on) */
			DISABLE_SCALAR: boolean | undefined;
			/** API key used to authorize the create/update/delete endpoints */
			API_KEY: string | undefined;
			/** Public url of the service, for values in feeds */
			PUBLIC_URL: string | undefined;
			/** Value used in generator field of RSS feeds. */
			RSS_GENERATOR: string | undefined;
		}
	}
}

export {};
