# Changelog

This file records the changes in each m3api-oauth2 release.

The annotated tag (and GitHub release) for each version also lists the changes,
but this file may sometimes contain later improvements (e.g. typo fixes).

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
