const got = require('got');
const semver = require('semver');

const db = require('../db');
const log = require('../log');

module.exports = resolveVersion;
module.exports.isStrictSemver = isStrictSemver;

function resolveVersion(packageName, version){

	// if no version was provided go on and query npm for latest
	if (!version) return queryNpmForVersion(packageName);

	// otherwise use it as-is if it's strict
	if (isStrictSemver(version)) return { version };

	// but if it's a non-strict version check if db has a version that satisfies it
	return db.versions.get(packageName).then(savedVersions => {
		if (!savedVersions || !savedVersions.length) return queryNpmForVersion(packageName, version);
		const satisfactory = savedVersions.filter(savedVersion => semver.satisfies(savedVersion, version));

		// use latest available saved version that satisfies, query npm for exact version if none
		return satisfactory.length ? { version: satisfactory.sort(semver.lt)[0] } : queryNpmForVersion(packageName, version);
	});

}

function queryNpmForVersion(packageName, version){

	log.debug(`VersionResolver: Querying npm for exact version of ${packageName}`);

	// otherwise, query npm for non-strict version or 'latest' if not versionString was provided at all
	return got(`https://registry.npmjs.org/${packageName}/${version || 'latest'}?json=true`, { json: true }).then(resp => {
		return { version: resp.body.version, queried: true };
	});
}

// https://github.com/bahmutov/to-exact-semver/blob/master/src/is-strict-semver.js
function isStrictSemver(version){
	return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version);
}