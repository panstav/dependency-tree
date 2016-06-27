const got = require('got');

const db = require('../db');
const log = require('../log');

module.exports = getDeps;
module.exports.queryNpm = queryNpm;

function getDeps(packageObject, handleQueriedDependencies){

	handleQueriedDependencies = handleQueriedDependencies || (dependencies => dependencies);

	return checkDBForCached(packageObject).then(savedDependencies => {

		if (savedDependencies) return savedDependencies;

		return queryNpm(packageObject).then(handleQueriedDependencies)

	});

}

function checkDBForCached(packageObject){
	return db.dependencies.get(packageObject.name, packageObject.version);
}

function queryNpm(packageObject){

	log.debug(`GetDeps: No cache of ${packageObject.name}@${packageObject.version}, querying npm.`);

	return got(`https://registry.npmjs.org/${packageObject.name}/${packageObject.version || 'latest'}?json=true`, { json: true }).then(resp => {

		const dependencies = resp.body.dependencies;

		// if there are no dependencies for this package - return an empty string for use with Array methods
		if (!dependencies) return [];

		// otherwise parse dependencies object into an array of { name, version } and return it
		return Object.keys(dependencies).map(key => ({ name: key, version: dependencies[key] }));

	});
}