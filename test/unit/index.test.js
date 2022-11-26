/* eslint-env mocha */
/* eslint camelcase: off */
// OAuth 2.0 POST parameters use underscores

import { Session } from 'm3api/core.js';
import {
	OAuthClient,
	initOAuthSession,
	completeOAuthSession,
	refreshOAuthSession,
	serializeOAuthSession,
	deserializeOAuthSession,
} from '../../index.js';
import * as nodeCrypto from 'crypto';
import { format } from 'util';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use( chaiAsPromised );

class BaseTestSession extends Session {

	constructor( defaultParams = {}, defaultOptions = {} ) {
		super( 'en.wikipedia.org', defaultParams, {
			warn() {
				throw new Error( 'warn() should not be called in this test' );
			},
			userAgent: 'm3api-oauth2-unit-test',
			...defaultOptions,
		} );
	}

}

class SuccessfulTestSession extends BaseTestSession {
	async internalPost() {
		return { status: 200, headers: {}, body: {
			token_type: 'Bearer',
			expires_in: 14400,
			access_token: 'ACCESSTOKEN',
			refresh_token: 'REFRESHTOKEN',
		} };
	}
}

const client = new OAuthClient( 'CLIENTID', 'CLIENTSECRET' );
const clientOptions = { 'm3api-oauth2/client': client };

describe( 'OAuthClient', () => {

	it( 'hides client secret', () => {
		expect( String( client ) )
			.not.to.contain( 'CLIENTSECRET' );
		expect( format( client ) )
			.not.to.contain( 'CLIENTSECRET' );
		expect( JSON.stringify( Object.entries( client ) ) )
			.not.to.contain( 'CLIENTSECRET' );
	} );

} );

describe( 'initOAuthSession', () => {

	for ( const [ name, defaultOptions, options ] of [
		[ 'defaultOptions', clientOptions, {} ],
		[ 'defaultOptions', {}, clientOptions ],
	] ) {
		it( `gets client from ${name} and generates code challenge`, async () => {
			const session = new BaseTestSession( {}, defaultOptions );

			const url = new URL( await initOAuthSession( session, options ) );

			expect( url.origin, 'origin' ).to.equal( 'https://en.wikipedia.org' );
			expect( url.pathname, 'pathname' ).to.equal( '/w/rest.php/oauth2/authorize' );
			expect( new Set( url.searchParams.keys() ), 'search params' ).to.eql( new Set( [
				'response_type',
				'client_id',
				'code_challenge',
				'code_challenge_method',
			] ) );
			expect( url.searchParams.get( 'response_type' ), '?response_type' )
				.to.equal( 'code' );
			expect( url.searchParams.get( 'client_id' ), '?client_id' )
				.to.equal( 'CLIENTID' );
			const codeChallengePattern = 'webcrypto' in nodeCrypto ?
				/^[A-Za-z0-9-_]+$/ :
				/^[A-Za-z0-9_~]+$/;
			expect( url.searchParams.get( 'code_challenge' ), '?code_challenge' )
				.to.match( codeChallengePattern );
			expect( url.searchParams.get( 'code_challenge_method' ), '?code_challenge_method' )
				.to.equal( 'webcrypto' in nodeCrypto ? 'S256' : 'plain' );
			expect( url.hash, 'hash' ).to.equal( '' );
		} );
	}

	it( 'saves code challenge in session', async () => {
		const session = new BaseTestSession( {}, { 'm3api-oauth2/client': client } );

		await initOAuthSession( session );
		const serialization = serializeOAuthSession( session );

		expect( serialization ).to.have.property( 'codeVerifier' )
			.to.match( /^[A-Za-z0-9-._~]{43,128}$/, 'general OAuth 2.0 code verifier' )
			.and.to.match( /^[A-Za-z0-9_~]{43}$/, 'our code verifier' );
	} );

	it( 'throws if client option not specified', async () => {
		await expect( initOAuthSession( new BaseTestSession(), {} ) )
			.to.be.rejectedWith( /m3api-oauth2\/client/ );
	} );

} );

describe( 'completeOAuthSession', () => {

	for ( const [ name, defaultOptions, options ] of [
		[ 'defaultOptions', clientOptions, {} ],
		[ 'defaultOptions', {}, clientOptions ],
	] ) {
		it( `gets client from ${name} and gets access token`, async () => {
			let called = false;
			class TestSession extends BaseTestSession {
				async internalPost( apiUrl, urlParams, bodyParams ) {
					expect( apiUrl ).to.equal( 'https://en.wikipedia.org/w/rest.php/oauth2/access_token' );
					expect( urlParams ).to.eql( {} );
					expect( bodyParams ).to.eql( {
						grant_type: 'authorization_code',
						code: 'CODE',
						client_id: 'CLIENTID',
						client_secret: 'CLIENTSECRET',
						code_verifier: 'CODEVERIFIER',
					} );
					expect( called, 'not called yet' ).to.be.false;
					called = true;
					return {
						status: 200,
						headers: {},
						body: {
							token_type: 'Bearer',
							expires_in: 14400,
							access_token: 'ACCESSTOKEN',
							refresh_token: 'REFRESHTOKEN',
						},
					};
				}
			}

			const session = new TestSession( {}, defaultOptions );
			deserializeOAuthSession( session, { codeVerifier: 'CODEVERIFIER' } );

			await completeOAuthSession( session, 'http://localhost:12345/oauth/callback?code=CODE', options );
			expect( session.defaultOptions )
				.to.have.property( 'authorization', 'Bearer ACCESSTOKEN' );
			expect( called ).to.be.true;
		} );
	}

	it( 'passes user agent into internalPost()', async () => {
		let called = false;
		class TestSession extends BaseTestSession {
			async internalPost( apiUrl, urlParams, bodyParams, headers ) {
				expect( headers )
					.to.have.property( 'user-agent' )
					.to.match( /^my-user-agent / );
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				return {
					status: 200,
					headers: {},
					body: {
						token_type: 'Bearer',
						expires_in: 14400,
						access_token: 'ACCESSTOKEN',
						refresh_token: 'REFRESHTOKEN',
					},
				};
			}
		}

		const session = new TestSession( {}, {
			userAgent: 'my-user-agent',
			...clientOptions,
		} );
		await completeOAuthSession( session, 'http://localhost:12345/oauth/callback?code=CODE' );
		expect( called ).to.be.true;
	} );

	it( 'adds assert to defaultParams', async () => {
		const session = new SuccessfulTestSession( {}, {
			...clientOptions,
		} );
		await completeOAuthSession( session, 'http://localhost?code=CODE' );
		expect( session.defaultParams ).to.have.property( 'assert', 'user' );
	} );

	[
		[ 'defaultOptions', { 'm3api-oauth2/assert': false }, {} ],
		[ 'options', {}, { 'm3api-oauth2/assert': false } ],
	].forEach( ( [ name, defaultOptions, options ] ) => {
		it( `does not add assert to defaultParams with false in ${name}`, async () => {
			const session = new SuccessfulTestSession( {}, {
				...defaultOptions,
				...clientOptions,
			} );
			await completeOAuthSession( session, 'http://localhost?code=CODE', options );
			expect( session.defaultParams ).not.to.have.property( 'assert' );
		} );
	} );

	it( 'throws if status is not 200', async () => {
		let called = false;
		class TestSession extends BaseTestSession {
			async internalPost() {
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				return {
					status: 500,
					headers: {},
					body: {},
				};
			}
		}

		const session = new TestSession( {}, clientOptions );
		await expect( completeOAuthSession( session, 'http://localhost:12345/oauth/callback?code=CODE' ) )
			.to.be.rejectedWith( /500/ );
		expect( called ).to.be.true;
	} );

	it( 'throws if client option not specified', async () => {
		expect( completeOAuthSession( new BaseTestSession(), '', {} ) )
			.to.be.rejectedWith( /m3api-oauth2\/client/ );
	} );

} );

describe( 'refreshOAuthSession', () => {

	it( 'renews access token and refresh token', async () => {
		let called = false;
		class TestSession extends BaseTestSession {
			async internalPost( apiUrl, urlParams, bodyParams ) {
				expect( apiUrl ).to.equal( 'https://en.wikipedia.org/w/rest.php/oauth2/access_token' );
				expect( urlParams ).to.eql( {} );
				expect( bodyParams ).to.eql( {
					grant_type: 'refresh_token',
					refresh_token: 'REFRESHTOKEN1',
					client_id: 'CLIENTID',
					client_secret: 'CLIENTSECRET',
				} );
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				return {
					status: 200,
					headers: {},
					body: {
						token_type: 'Bearer',
						expires_in: 14400,
						access_token: 'ACCESSTOKEN2',
						refresh_token: 'REFRESHTOKEN2',
					},
				};
			}
		}

		const session = new TestSession( {}, clientOptions );
		deserializeOAuthSession( session, {
			accessToken: 'ACCESSTOKEN1',
			refreshToken: 'REFRESHTOKEN1',
		} );
		await refreshOAuthSession( session );
		expect( serializeOAuthSession( session ) ).to.eql( {
			accessToken: 'ACCESSTOKEN2',
			refreshToken: 'REFRESHTOKEN2',
		} );
		expect( called ).to.be.true;
	} );

	it( 'keeps old refresh token if no new refresh token returned', async () => {
		let called = false;
		class TestSession extends BaseTestSession {
			async internalPost() {
				expect( called, 'not called yet' ).to.be.false;
				called = true;
				return {
					status: 200,
					headers: {},
					body: {
						token_type: 'Bearer',
						expires_in: 14400,
						access_token: 'ACCESSTOKEN2',
						// no refresh_token
					},
				};
			}
		}

		const session = new TestSession( {}, clientOptions );
		deserializeOAuthSession( session, {
			accessToken: 'ACCESSTOKEN1',
			refreshToken: 'REFRESHTOKEN1',
		} );
		await refreshOAuthSession( session );
		expect( serializeOAuthSession( session ) ).to.eql( {
			accessToken: 'ACCESSTOKEN2',
			refreshToken: 'REFRESHTOKEN1',
		} );
		expect( called ).to.be.true;
	} );

} );

describe( 'serializeOAuthSession', () => {

	it( 'blank session', () => {
		const session = new BaseTestSession( {}, clientOptions );
		expect( serializeOAuthSession( session ) )
			.to.eql( {} );
	} );

	it( 'initialized session', async () => {
		const session = new BaseTestSession( {}, clientOptions );
		await initOAuthSession( session );
		const { codeVerifier, ...restSerialization } = serializeOAuthSession( session );
		expect( codeVerifier )
			.and.to.match( /^[A-Za-z0-9_~]{43}$/ );
		expect( restSerialization ).to.eql( {} );
	} );

	it( 'finished session', async () => {
		const session = new SuccessfulTestSession( {}, clientOptions );
		await initOAuthSession( session );
		await completeOAuthSession( session, 'http:localhost?code=CODE' );
		expect( serializeOAuthSession( session ) )
			.to.eql( {
				accessToken: 'ACCESSTOKEN',
				refreshToken: 'REFRESHTOKEN',
			} );
	} );

} );

describe( 'deserializeOAuthSession', () => {

	it( 'blank session', () => {
		const session = new BaseTestSession( {}, clientOptions );
		deserializeOAuthSession( session, {} );
		expect( session.defaultOptions ).not.to.have.property( 'authorization' );
	} );

	it( 'initialized session', () => {
		const session = new BaseTestSession( {}, clientOptions );
		deserializeOAuthSession( session, {
			codeVerifier: 'CODEVERIFIER',
		} );
		// we can’t see the refresh token in the session
		// (and already test elsewhere that completeOAuthSession() uses it),
		// so just serialize it again to check that it’s there
		expect( serializeOAuthSession( session ) )
			.to.have.property( 'codeVerifier', 'CODEVERIFIER' );
		expect( session.defaultOptions ).not.to.have.property( 'authorization' );
	} );

	describe( 'finished session', () => {

		it( 'adds authorization and assert=user by default', () => {
			const session = new BaseTestSession( {}, clientOptions );
			deserializeOAuthSession( session, {
				accessToken: 'ACCESSTOKEN',
			} );
			expect( session.defaultOptions )
				.to.have.property( 'authorization', 'Bearer ACCESSTOKEN' );
			expect( session.defaultParams )
				.to.have.property( 'assert', 'user' );
		} );

		it( 'preserves refresh token', () => {
			const session = new BaseTestSession( {}, clientOptions );
			deserializeOAuthSession( session, {
				refreshToken: 'REFRESHTOKEN',
			} );
			// we can’t see the refresh token in the session,
			// so just serialize it again to check that it’s there
			expect( serializeOAuthSession( session ) )
				.to.have.property( 'refreshToken', 'REFRESHTOKEN' );
		} );

		[
			[ 'defaultOptions', { 'm3api-oauth2/assert': false }, {} ],
			[ 'options', {}, { 'm3api-oauth2/assert': false } ],
		].forEach( ( [ name, defaultOptions, options ] ) => {
			it( `does not add assert to defaultParams with false in ${name}`, () => {
				const session = new SuccessfulTestSession( {}, {
					...defaultOptions,
					...clientOptions,
				} );
				deserializeOAuthSession( session, {
					accessToken: 'ACCESSTOKEN',
				}, options );
				expect( session.defaultParams ).not.to.have.property( 'assert' );
			} );
		} );

	} );

} );
