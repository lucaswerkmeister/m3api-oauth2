# Changelog

This file records the changes in each m3api-oauth2 release.

The annotated tag (and GitHub release) for each version also lists the changes,
but this file may sometimes contain later improvements (e.g. typo fixes).

## next (not yet released)

No changes yet.

## v0.3.2 (2025-03-24)

- The callback URL passed into `completeOAuthSession()` may now be a relative URL.
- Improved error handling in `completeOAuthSession()`.
- Updated dependencies.

## v0.3.1 (2024-09-07)

- Updated m3api requirement to the latest version (0.8.3) –
  versions 0.8.0-0.8.2 no longer work against Wikimedia production
  since mid-June 2024 (see issue #3).
- Updated dependencies.

## v0.3.0 (2023-07-11)

- BREAKING CHANGE:
  m3api-oauth2 now requires at least Node.js version 18.2.0,
  up from Node 12.22.0 or Node 14.17.0 previously.
  As part of this, the `m3api-oauth2/requireCrypto` request option has been removed,
  as we no longer support any platform where the Web Crypto API is not available:
  it is now always used unconditionally.
- Updated dependencies.

## v0.2.0 (2023-04-11)

- The access token is now refreshed automatically;
  it is no longer necessary to call `refreshOAuthSession()` by hand,
  and sessions should remain usable indefinitely.
- Updated dependencies.

## v0.1.1 (2022-12-04)

No code changes from v0.1.0,
just a fix to the GitHub Actions workflow pushing the release to npm.
(v0.1.0 could not be pushed to npm, unfortunately.)

## v0.1.0 (2022-12-04)

Initial release, including:

- The `OAuthClient` class and
  `initOAuthSession()` and `completeOAuthSession()` functions,
  to perform the OAuth 2.0 authorization code flow.
- The `refreshOAuthSession()` function,
  to perform the refresh flow (albeit not yet automatically).
- The `serializeOAuthSession()` and `deserializeOAuthSession()` functions,
  to serialize the OAuth state of a session between requests.
- PKCE support, for non-confidential clients without a client secret.
