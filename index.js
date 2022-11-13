/* eslint camelcase: off */
// OAuth 2.0 POST parameters use underscores

import {
	DEFAULT_OPTIONS,
} from 'm3api/core.js';

/**
 * Request options understood by this package.
 * All other options will be passed through to m3api.
 *
 * @typedef Options
 * @type {Object}
 * @property {OAuthClient} ['m3api-oauth2/client']
 * The OAuth client, encapsulating the credentials.
 * This option must be specified, there is no possible default value.
 * (It’s recommended to set it in the session’s default options.)
 */

Object.assign( DEFAULT_OPTIONS, {
	'm3api-oauth2/client': { // the default is a fake OAuthClient to throw a more helpful exception
		get consumerToken() {
			throw new Error( 'The m3api-oauth2/client request option was not specified!' );
		},
	},
} );

/** @private */
const secretTokenSymbol = Symbol( 'OAuthClient.secretToken' );

/**
 * An OAuth 2.0 client, encapsulating the public consumer token (or client ID)
 * and the private secret token (or client secret).
 */
class OAuthClient {

	/**
	 * @param {string} consumerToken
	 * @param {string} secretToken
	 */
	constructor( consumerToken, secretToken ) {
		/** @public */
		this.consumerToken = consumerToken;
		/** @private */
		Object.defineProperty( this, secretTokenSymbol, {
			value: secretToken,
		} );
	}

}

/**
 * Get the URL to authorize a user.
 *
 * You should send the user to this URL,
 * then later call {@link handleCallback} once they’ve been redirected back to you.
 *
 * This function needs to be async for technical reasons,
 * but should resolve basically immediately
 * (no server communication is involved).
 *
 * @param {Session} session The session with which the authorization will be associated.
 * @param {Options} [options] Request options.
 * The 'm3api-oauth2/client' option must be specified
 * either here or in the session’s default options.
 * @return {string}
 */
async function getAuthorizeUrl( session, options = {} ) {
	const { 'm3api-oauth2/client': client } = {
		...DEFAULT_OPTIONS,
		...session.defaultOptions,
		...options,
	};
	const restUrl = session.apiUrl.replace( /api\.php$/, 'rest.php' );
	const clientId = client.consumerToken;
	return `${restUrl}/oauth2/authorize?response_type=code&client_id=${clientId}`;
}

/**
 * Handle an authorization callback from the user.
 *
 * Call this method when the user returns from the {@link getAuthorizeUrl} result,
 * with the full URL they were redirected to.
 * The session will be set up for authenticated requests.
 *
 * @param {Session} session The session to which the authorization will apply.
 * @param {string} callbackUrl The URL the user was redirected to.
 * @param {Options} [options] Request options.
 * The 'm3api-oauth2/client' option must be specified
 * either here or in the session’s default options.
 */
async function handleCallback( session, callbackUrl, options = {} ) {
	const { 'm3api-oauth2/client': client } = {
		...DEFAULT_OPTIONS,
		...session.defaultOptions,
		...options,
	};
	const restUrl = session.apiUrl.replace( /api\.php$/, 'rest.php' );
	const accessTokenUrl = `${restUrl}/oauth2/access_token`;
	const code = new URL( callbackUrl ).searchParams.get( 'code' );
	const { status, body } = await session.internalPost( accessTokenUrl, {}, {
		grant_type: 'authorization_code',
		code,
		client_id: client.consumerToken,
		client_secret: client[ secretTokenSymbol ],
	}, { 'user-agent': session.getUserAgent( options ) } );

	if ( status !== 200 ) {
		throw new Error( `OAuth request returned non-200 HTTP status code: ${status}` );
	}

	session.defaultOptions.authorization = `Bearer ${body.access_token}`;
}

export {
	OAuthClient,
	getAuthorizeUrl,
	handleCallback,
};
