/* eslint-env mocha */
/* eslint camelcase: off */
// OAuth 2.0 POST parameters use underscores

import { Session } from 'm3api/core.js';
import {
	OAuthClient,
	getAuthorizeUrl,
	handleCallback,
} from '../../index.js';
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

const client = new OAuthClient( 'CLIENTID', 'CLIENTSECRET' );

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

describe( 'getAuthorizeUrl', () => {

	for ( const [ name, defaultOptions, options ] of [
		[ 'defaultOptions', { 'm3api-oauth2/client': client }, {} ],
		[ 'defaultOptions', {}, { 'm3api-oauth2/client': client } ],
	] ) {
		it( `gets client from ${name}`, async () => {
			const session = new BaseTestSession( {}, defaultOptions );
			expect( await getAuthorizeUrl( session, options ) )
				.to.equal( 'https://en.wikipedia.org/w/rest.php/oauth2/authorize?response_type=code&client_id=CLIENTID' );
		} );
	}

	it( 'throws if client option not specified', async () => {
		await expect( getAuthorizeUrl( new BaseTestSession(), {} ) )
			.to.be.rejectedWith( /m3api-oauth2\/client/ );
	} );

} );

describe( 'handleCallback', () => {

	for ( const [ name, defaultOptions, options ] of [
		[ 'defaultOptions', { 'm3api-oauth2/client': client }, {} ],
		[ 'defaultOptions', {}, { 'm3api-oauth2/client': client } ],
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
			await handleCallback( session, 'http://localhost:12345/oauth/callback?code=CODE', options );
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
			'm3api-oauth2/client': client,
		} );
		await handleCallback( session, 'http://localhost:12345/oauth/callback?code=CODE' );
		expect( called ).to.be.true;
	} );

	it( 'adds assert to defaultParams', async () => {
		class TestSession extends BaseTestSession {
			async internalPost() {
				return { status: 200, headers: {}, body: {
					token_type: 'Bearer',
					expires_in: 14400,
					access_token: 'ACCESSTOKEN',
					refresh_token: 'REFRESHTOKEN',
				} };
			}
		}

		const session = new TestSession( {}, {
			'm3api-oauth2/client': client,
		} );
		await handleCallback( session, 'http://localhost?code=CODE' );
		expect( session.defaultParams ).to.have.property( 'assert', 'user' );
	} );

	[
		[ 'defaultOptions', { 'm3api-oauth2/assert': false }, {} ],
		[ 'options', {}, { 'm3api-oauth2/assert': false } ],
	].forEach( ( [ name, defaultOptions, options ] ) => {
		it( `does not add assert to defaultParams with false in ${name}`, async () => {
			class TestSession extends BaseTestSession {
				async internalPost() {
					return { status: 200, headers: {}, body: {
						token_type: 'Bearer',
						expires_in: 14400,
						access_token: 'ACCESSTOKEN',
						refresh_token: 'REFRESHTOKEN',
					} };
				}
			}

			const session = new TestSession( {}, {
				...defaultOptions,
				'm3api-oauth2/client': client,
			} );
			await handleCallback( session, 'http://localhost?code=CODE', options );
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

		const session = new TestSession( {}, { 'm3api-oauth2/client': client } );
		await expect( handleCallback( session, 'http://localhost:12345/oauth/callback?code=CODE' ) )
			.to.be.rejectedWith( /500/ );
		expect( called ).to.be.true;
	} );

	it( 'throws if client option not specified', async () => {
		expect( handleCallback( new BaseTestSession(), '', {} ) )
			.to.be.rejectedWith( /m3api-oauth2\/client/ );
	} );

} );
