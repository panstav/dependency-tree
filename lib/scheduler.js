const log = require('../log');

var scheduled = [];

module.exports = { add, flush };

function add(fn){
	scheduled.push(fn);
}

function flush(){
	'use strict';

	if (!scheduled.length) return log.debug(`Scheduler: No jobs waiting`);

	log.debug(`Scheduler: Starting flush with ${scheduled.length} jobs`);

	var promises = scheduled[0]();
	for (let i = 1, len = scheduled.length; i < len; i++){
		promises = promises.then(scheduled[i]);

		if (i === len-1){
			log.debug('Scheduler: Finished. Reseting flush');
			scheduled = [];
		}
	}
}