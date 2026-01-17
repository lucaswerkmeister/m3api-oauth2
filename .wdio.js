import { mkdir } from 'node:fs/promises';
import process from 'node:process';

export const config = {
	specs: [ 'test/integration/*.js' ],
	capabilities: [ {
		browserName: 'chromium',
		'goog:chromeOptions': {
			args: process.env.CI ? [
				'--disable-dev-shm-usage',
				'--disable-gpu',
				'--headless=new',
				'--no-sandbox',
			] : [],
		},
	} ],
	logLevel: 'info',
	waitforTimeout: 10000,
	services: [ 'chromedriver' ],
	framework: 'mocha',
	reporters: [ 'spec' ],
	mochaOpts: {
		ui: 'bdd',
		timeout: 60000,
	},
	async afterTest( test, context, result ) {
		if ( result.passed || result.error?.message === 'sync skip; aborting execution' ) {
			return;
		}
		const dirname = 'test-artifacts';
		try {
			await mkdir( dirname );
		} catch ( e ) {
			if ( e.code !== 'EEXIST' ) {
				throw e;
			}
		}
		let filename = `${ test.title }.png`;
		if ( test.parent ) {
			filename = `${ test.parent } ${ filename }`;
		}
		await browser.saveScreenshot( `${ dirname }/${ filename }` );
	},
};
