/* eslint-env mocha */

import fs from 'fs';
import process from 'process';

import Session, { set } from 'm3api/node.js';
import {
	OAuthClient,
	initOAuthSession,
	completeOAuthSession,
	isCompleteOAuthSession,
	refreshOAuthSession,
	serializeOAuthSession,
	deserializeOAuthSession,
} from '../../index.js';

const userAgent = 'm3api-oauth2-integration-tests (https://github.com/lucaswerkmeister/m3api-oauth2/)';

describe( 'm3api-oauth2', () => {

	let mediawikiFullScriptPath,
		mediawikiUsername, mediawikiPassword,
		oauthClientId, oauthClientSecret,
		oauthNonconfidentialClientId, oauthNonconfidentialClientSecret,
		slowTestSleep;

	before( 'load credentials', async () => {
		// note: this code is based on similar code in m3api
		mediawikiFullScriptPath = process.env.MEDIAWIKI_FULL_SCRIPT_PATH;
		mediawikiUsername = process.env.MEDIAWIKI_USERNAME;
		mediawikiPassword = process.env.MEDIAWIKI_PASSWORD;
		oauthClientId = process.env.OAUTH_CLIENT_ID;
		oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;
		oauthNonconfidentialClientId = process.env.OAUTH_NONCONFIDENTIAL_CLIENT_ID;
		oauthNonconfidentialClientSecret = process.env.OAUTH_NONCONFIDENTIAL_CLIENT_SECRET;
		slowTestSleep = process.env.SLOW_TEST_SLEEP;

		if (
			!mediawikiUsername || !mediawikiPassword ||
			!oauthClientId || !oauthClientSecret ||
			!oauthNonconfidentialClientId || !oauthNonconfidentialClientSecret
		) {
			let envFile;
			try {
				envFile = await fs.promises.readFile( '.env', { encoding: 'utf8' } );
			} catch ( e ) {
				if ( e.code === 'ENOENT' ) {
					return;
				} else {
					throw e;
				}
			}

			for ( let line of envFile.split( '\n' ) ) {
				line = line.trim();
				if ( line.startsWith( '#' ) || line === '' ) {
					continue;
				}

				const match = line.match( /^([^=]*)='([^']*)'$/ );
				if ( !match ) {
					console.warn( `.env: ignoring bad format: ${ line }` );
					continue;
				}
				switch ( match[ 1 ] ) {
					case 'MEDIAWIKI_FULL_SCRIPT_PATH':
						if ( !mediawikiFullScriptPath ) {
							mediawikiFullScriptPath = match[ 2 ];
						}
						break;
					case 'MEDIAWIKI_USERNAME':
						if ( !mediawikiUsername ) {
							mediawikiUsername = match[ 2 ];
						}
						break;
					case 'MEDIAWIKI_PASSWORD':
						if ( !mediawikiPassword ) {
							mediawikiPassword = match[ 2 ];
						}
						break;
					case 'OAUTH_CLIENT_ID':
						if ( !oauthClientId ) {
							oauthClientId = match[ 2 ];
						}
						break;
					case 'OAUTH_CLIENT_SECRET':
						if ( !oauthClientSecret ) {
							oauthClientSecret = match[ 2 ];
						}
						break;
					case 'OAUTH_NONCONFIDENTIAL_CLIENT_ID':
						if ( !oauthNonconfidentialClientId ) {
							oauthNonconfidentialClientId = match[ 2 ];
						}
						break;
					case 'OAUTH_NONCONFIDENTIAL_CLIENT_SECRET':
						if ( !oauthNonconfidentialClientSecret ) {
							oauthNonconfidentialClientSecret = match[ 2 ];
						}
						break;
					case 'SLOW_TEST_SLEEP':
						if ( slowTestSleep === undefined ) {
							slowTestSleep = match[ 2 ];
						}
						break;
					default:
						console.warn( `.env: ignoring unknown assignment: ${ line }` );
						break;
				}
			}
		}
	} );

	before( 'log in', async () => {
		if (
			!mediawikiFullScriptPath ||
			!mediawikiUsername || !mediawikiPassword ||
			!oauthClientId || !oauthClientSecret ||
			!oauthNonconfidentialClientId || !oauthNonconfidentialClientSecret
		) {
			throw new Error( 'Incomplete environment!' );
		}

		// use returntoquery= to ensure that the returned-to URL doesn’t use the short URL,
		// so we can recognize it below without having to configure the article path :)
		await browser.url( `${ mediawikiFullScriptPath }/index.php?title=Special:UserLogin&returnto=Special:BlankPage&returntoquery=x=y` );
		await $( '#wpLoginAttempt' ).waitForExist();
		await $( '#wpName1' ).setValue( mediawikiUsername );
		await $( '#wpPassword1' ).setValue( mediawikiPassword );
		await $( '#wpLoginAttempt' ).click();
		await browser.waitUntil( async () => { // eslint-disable-line arrow-body-style
			return ( await browser.getUrl() ) === `${ mediawikiFullScriptPath }/index.php?title=Special:BlankPage&x=y`;
		} );
	} );

	for ( const [ description, clientFactory, supportsRefresh, callbackUrlFilter ] of [
		[
			'confidential client with secret',
			() => new OAuthClient( oauthClientId, oauthClientSecret ),
			true,
			( callbackUrl ) => callbackUrl,
		],
		[
			'non-confidential client with secret',
			() => new OAuthClient( oauthNonconfidentialClientId, oauthNonconfidentialClientSecret ),
			true,
			( callbackUrl ) => callbackUrl,
		],
		[
			'non-confidential client without secret',
			() => new OAuthClient( oauthNonconfidentialClientId ),
			false, // T323855
			( callbackUrl ) => callbackUrl,
		],
		[
			'relative callback URL',
			() => new OAuthClient( oauthClientId, oauthClientSecret ),
			true,
			( callbackUrl ) => {
				const url = new URL( callbackUrl );
				return url.pathname + url.search; // no origin
			},
		],
	] ) {
		// eslint-disable-next-line no-loop-func
		it( `node.js, ${ description }`, async () => {
			const makeSession = () => new Session( `${ mediawikiFullScriptPath }/api.php`, {
				formatversion: 2,
			}, {
				userAgent,
				'm3api-oauth2/client': clientFactory(),
			} );

			let session = makeSession();
			const authorizeUrl = await initOAuthSession( session );
			expect( await initOAuthSession( session ) )
				.toBe( authorizeUrl );
			expect( isCompleteOAuthSession( session ) )
				.toBe( false );
			let serialization = serializeOAuthSession( session );
			await browser.url( authorizeUrl );
			await $( '#mw-mwoauth-accept button' ).waitForExist();
			await $( '#mw-mwoauth-accept button' ).click();
			await browser.waitUntil( async () => {
				const currentOrigin = new URL( await browser.getUrl() ).origin;
				const mediawikiOrigin = new URL( mediawikiFullScriptPath ).origin;
				return currentOrigin !== mediawikiOrigin;
			} );

			const callbackUrl = await browser.getUrl();
			session = makeSession();
			deserializeOAuthSession( session, serialization );
			await completeOAuthSession( session, callbackUrlFilter( callbackUrl ) );
			expect( isCompleteOAuthSession( session ) )
				.toBe( true );
			serialization = serializeOAuthSession( session );

			session = makeSession();
			deserializeOAuthSession( session, serialization );
			expect( isCompleteOAuthSession( session ) )
				.toBe( true );
			let response = await session.request( {
				action: 'query',
				meta: set( 'userinfo' ),
			} );
			expect( response.query.userinfo ).not.toHaveProperty( 'anon' );
			expect( response.query.userinfo ).toHaveProperty( 'name', mediawikiUsername );

			if ( supportsRefresh ) {
				session = makeSession();
				deserializeOAuthSession( session, serialization );
				await refreshOAuthSession( session );
				response = await session.request( {
					action: 'query',
					meta: set( 'userinfo' ),
				} );
				expect( response.query.userinfo ).not.toHaveProperty( 'anon' );
				expect( response.query.userinfo ).toHaveProperty( 'name', mediawikiUsername );
			}
		} );
	}

	it( 'SLOW: node.js, automatic refresh', async function () {
		if ( slowTestSleep === undefined || slowTestSleep === '' ) {
			this.skip();
			return;
		}

		const makeSession = () => new Session( `${ mediawikiFullScriptPath }/api.php`, {
			formatversion: 2,
		}, {
			userAgent,
			'm3api-oauth2/client': new OAuthClient( oauthClientId, oauthClientSecret ),
		} );

		let session = makeSession();
		const authorizeUrl = await initOAuthSession( session );
		let serialization = serializeOAuthSession( session );
		await browser.url( authorizeUrl );
		await $( '#mw-mwoauth-accept button' ).waitForExist();
		await $( '#mw-mwoauth-accept button' ).click();
		await browser.waitUntil( async () => {
			const currentOrigin = new URL( await browser.getUrl() ).origin;
			const mediawikiOrigin = new URL( mediawikiFullScriptPath ).origin;
			return currentOrigin !== mediawikiOrigin;
		} );

		const callbackUrl = await browser.getUrl();
		session = makeSession();
		deserializeOAuthSession( session, serialization );
		await completeOAuthSession( session, callbackUrl );
		serialization = serializeOAuthSession( session );

		session = makeSession();
		deserializeOAuthSession( session, serialization );
		let response = await session.request( {
			action: 'query',
			meta: set( 'userinfo' ),
		} );
		expect( response.query.userinfo ).not.toHaveProperty( 'anon' );
		expect( response.query.userinfo ).toHaveProperty( 'name', mediawikiUsername );

		const now = new Date().toLocaleTimeString();
		console.log( `${ now } sleeping for ${ slowTestSleep }s to let the access token expire...` );
		await new Promise( ( resolve ) => {
			setTimeout( resolve, parseInt( slowTestSleep, 10 ) * 1000 );
		} );

		session = makeSession();
		deserializeOAuthSession( session, serialization );
		response = await session.request( {
			action: 'query',
			meta: set( 'userinfo' ),
		} );
		expect( response.query.userinfo ).not.toHaveProperty( 'anon' );
		expect( response.query.userinfo ).toHaveProperty( 'name', mediawikiUsername );
	} );

} );
