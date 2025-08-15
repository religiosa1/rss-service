import { describe, it } from "node:test";
import { generateFeedLink } from "./generateFeedLink.ts";

describe("generateFeedLink", () => {
	it("gets the correct url for basic use case", (t) => {
		const result = generateFeedLink("foo", "http://example.com");
		t.assert.equal(result, "http://example.com/feed/foo");
	});

	it("url-encodes required params", (t) => {
		const result = generateFeedLink("foo bar", "http://кириллический.домен");
		t.assert.equal(result, "http://xn--e1afaabgbega6cr0f.xn--d1acufc/feed/foo%20bar");
	});

	it("respects path in publicUr", (t) => {
		const result = generateFeedLink("foo", "http://example.com/some-path");
		t.assert.equal(result, "http://example.com/some-path/feed/foo");
	});

	it("doesn't add extra slashes if public url path ends with it", (t) => {
		const result = generateFeedLink("foo", "http://example.com/some-path/");
		t.assert.equal(result, "http://example.com/some-path/feed/foo");
	});

	it("strips fragments and searchParam from public url", (t) => {
		t.assert.equal(generateFeedLink("foo", "http://example.com/?foo=bar#baz"), "http://example.com/feed/foo");
		t.assert.equal(generateFeedLink("foo", "http://example.com/#baz"), "http://example.com/feed/foo");
		t.assert.equal(generateFeedLink("foo", "http://example.com/?foo=bar"), "http://example.com/feed/foo");
	});

	it("replies with no domain if public url is missing", (t) => {
		const result = generateFeedLink("foo", "");
		t.assert.equal(result, "/feed/foo");
	});

	it("public url  can be just a path as well", (t) => {
		const result = generateFeedLink("foo", "/some-path");
		t.assert.equal(result, "/some-path/feed/foo");
	});
});
