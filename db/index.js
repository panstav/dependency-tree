const level = require('levelup');
const database = require('leveldown');

const log = require('../log');

const dirs = {
	dependencies: `${__dirname}/dependencies`,
	versions: `${__dirname}/versions`
};

const dependenciesDB = level(dirs.dependencies, { valueEncoding: 'json' });
const versionsDB = level(dirs.versions, { valueEncoding: 'json' });

module.exports = {

	dependencies: {
		get: getDependencies,
		set: setDependencies
	},

	versions: {
		get: getVersions,
		add: addVersion
	},

	clean: cleanDatabases

};

function getDependencies(packageName, version){
	return new Promise((resolve, reject) => {

		const key = pkgKey(packageName, version);

		log.debug(`DB: Retrieving dependencies of '${key}'`);

		dependenciesDB.get(key, (err, data) => {
			if (err){

				// this is expected, if no cache is present, continue with no data
				if ('notFound' in err) return resolve();

				// but reject on other kinds of error
				return reject(err);
			}

			// great, data is present - continue with it
			resolve(data);
		});
	});
}

function setDependencies(packageName, version, data){
	return new Promise((resolve, reject) => {

		// first check if we saved this data before
		getDependencies(packageName, version).then(saveOrSkip, reject);

		function saveOrSkip(savedData){

			// if data is already there, skip
			// suppose data for the same package and version will never change
			if (savedData) return resolve(savedData);

			const key = pkgKey(packageName, version);

			log.debug(`DB: Saving dependencies of '${key}'`);

			dependenciesDB.put(key, data, err => {
				if (err) return reject(err);

				// resolve after indexing the version, with saved data for .then chain
				addVersion(packageName, version)
					.then(() => resolve(data), reject);

			});
		}

	});
}

function getVersions(packageName){
	return new Promise((resolve, reject) => {

		log.debug(`DB: Retrieving versions of '${packageName}'`);

		versionsDB.get(packageName, (err, data) => {
			if (err){

				// this is expected, if no cache is present, continue with no data
				if ('notFound' in err) return resolve();

				// but reject on other kinds of error
				return reject(err);
			}

			// great, data is present - continue with it
			resolve(data);
		});
	});
}

function addVersion(packageName, version){
	return new Promise((resolve, reject) => {

		log.debug(`DB: Saving version of '${packageName}'`);

		versionsDB.get(packageName, (err, data) => {

			// reject on error of any kind except the 'notFound' kind
			if (err && !'notFound' in err) return reject(err);

			// save us from type bondage, data is either falsy or array
			data = data || [];

			// if data contains a the version we wish to cache - move on with the entire array
			if (data.indexOf(version) > -1) return resolve(data);

			// otherwise append this version to the array, save it, and continue
			data.push(version);
			versionsDB.put(packageName, data, err => {
				if (err) return reject(err);

				resolve(data);
			});
		});
	});
}

function cleanDatabases(){
	return new Promise((resolve, reject) => {

		// leveldb wants to be closed before it can be safely deleted
		// reopen it after so that we can move on immediately
		return closeDatabases().then(destroyDatabases).then(reopenDatabases);

		function closeDatabases(){
			return new Promise(resolve => {
				// close both databases and continue
				dependenciesDB.close(() => versionsDB.close(() => resolve() ));
			});
		}

		function destroyDatabases(){

			// delete the entire file tree of both databases, rejecting on any error

			database.destroy(dirs.dependencies, err =>{
				if (err) return reject(err);

				database.destroy(dirs.versions, err => {
					if (err) return reject(err);

					resolve();
				});
			});

		}

		function reopenDatabases(){
			return new Promise(resolve => {
				dependenciesDB.open(() => versionsDB.open(() => resolve() ));
			});
		}

	});

}

function pkgKey(packageName, version){
	// generate a string to be used as a hashKey that's unique to every package
	return `${packageName}@${version}`;
}