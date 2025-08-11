export function raise(message: string, error: ErrorConstructor = Error): never {
	throw new error(message);
}
