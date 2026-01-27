import process from 'process';

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
};
