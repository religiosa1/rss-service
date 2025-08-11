declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/** Name of libsql database file */
			DB_FILE_NAME: string | undefined;
			/** TCP Port on which service will run */
			PORT: string | undefined;
			/** Disable both OpenApi and Scalar documentation */
			DISABLE_OPEN_API: boolean | undefined;
			/** Disable Scalar documentation */
			DISABLE_SCALAR: boolean | undefined;
			/** API key used to authorize the admin part */
			API_KEY: string | undefined;
		}
	}
}

export {};
