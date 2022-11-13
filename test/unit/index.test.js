/* eslint-env mocha */

import { Session } from 'm3api/core.js';
import {
} from '../../index.js';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use( chaiAsPromised );

class _BaseTestSession extends Session {

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

it( 'will be removed once real functionality exists', async () => {
	expect( 2 + 2 ).to.equal( 4 );
} );
