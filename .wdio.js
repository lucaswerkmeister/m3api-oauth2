import process from 'process';

export const config = {
	specs: [ 'test/integration/*.js' ],
	capabilities: [ {
		browserName: 'chrome',
		'goog:chromeOptions': {
			args: process.env.CI ? [ 'headless', 'disable-gpu' ] : [],
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
