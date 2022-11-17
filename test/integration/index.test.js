/* eslint-env mocha */

import fs from 'fs';
import process from 'process';

import Session, { set } from 'm3api/node.js';
import {
	OAuthClient,
	getAuthorizeUrl,
	handleCallback,
	serializeOAuthSession,
	deserializeOAuthSession,
} from '../../index.js';

const userAgent = 'm3api-oauth2-integration-tests (https://github.com/lucaswerkmeister/m3api-oauth2/)';

describe( 'm3api-oauth2', () => {

	let mediawikiUsername, mediawikiPassword, oauthClientId, oauthClientSecret;

	before( 'load credentials', async () => {
		// note: this code is based on similar code in m3api
		mediawikiUsername = process.env.MEDIAWIKI_USERNAME;
		mediawikiPassword = process.env.MEDIAWIKI_PASSWORD;
		oauthClientId = process.env.OAUTH_CLIENT_ID;
		oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;

		if ( !mediawikiUsername || !mediawikiPassword || !oauthClientId || !oauthClientSecret ) {
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
					console.warn( `.env: ignoring bad format: ${line}` );
					continue;
				}
				switch ( match[ 1 ] ) {
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
					default:
						console.warn( `.env: ignoring unknown assignment: ${line}` );
						break;
				}
			}
		}
	} );

	before( 'log in', async () => {
		if ( !mediawikiUsername || !mediawikiPassword || !oauthClientId || !oauthClientSecret ) {
			throw new Error( 'Incomplete environment!' );
		}

		await browser.url( 'https://test.wikipedia.beta.wmflabs.org/wiki/Special:UserLogin?returnto=Special:BlankPage' );
		await $( '#wpLoginAttempt' ).waitForExist();
		await $( '#wpName1' ).setValue( mediawikiUsername );
		await $( '#wpPassword1' ).setValue( mediawikiPassword );
		await $( '#wpLoginAttempt' ).click();
		await browser.waitUntil( async () => {
			return ( await browser.getUrl() ) === 'https://test.wikipedia.beta.wmflabs.org/wiki/Special:BlankPage';
		} );
	} );

	it( 'node.js', async () => {
		const makeSession = () => new Session( 'test.wikipedia.beta.wmflabs.org', {
			formatversion: 2,
		}, {
			userAgent,
			'm3api-oauth2/client': new OAuthClient( oauthClientId, oauthClientSecret ),
		} );

		let session = makeSession();
		const authorizeUrl = await getAuthorizeUrl( session );
		let serialization = serializeOAuthSession( session );
		await browser.url( authorizeUrl );
		await $( '#mw-mwoauth-accept button' ).waitForExist();
		await $( '#mw-mwoauth-accept button' ).click();
		await browser.waitUntil( async () => {
			return ( await browser.getUrl() ) !== authorizeUrl;
		} );

		const callbackUrl = await browser.getUrl();
		session = makeSession();
		deserializeOAuthSession( session, serialization );
		await handleCallback( session, callbackUrl );
		serialization = serializeOAuthSession( session );

		session = makeSession();
		deserializeOAuthSession( session, serialization );
		const response = await session.request( {
			action: 'query',
			meta: set( 'userinfo' ),
		} );
		expect( response.query.userinfo ).not.toHaveProperty( 'anon' );
		expect( response.query.userinfo ).toHaveProperty( 'name', mediawikiUsername );
	} );

} );
