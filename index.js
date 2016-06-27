const db = require('./db');
const log = require('./log');

const getDeps = require('./lib/get-dependencies');
const resolveVersion = require('./lib/resolve-version');
const chain = require('./lib/packages-chain');
const scheduler = require('./lib/scheduler');

module.exports = getDependenciesTree;

function getDependenciesTree(packageObject){

	const flatTree = chain();

	return iteratePackage(packageObject);

	function iteratePackage(packageObject){

		return Promise.resolve(resolveVersion(packageObject.name, packageObject.version))
			.then(strictVersion => {

				packageObject.version = strictVersion;

				if (!flatTree.unique(packageObject)) return { name: packageObject.name, version: packageObject.version, skip: true };
				flatTree.append(packageObject);

				return getDeps(packageObject, handleNewDependencies)
					.then(iterateEachDependency)
					.then(resolveTree);
			});

		function handleNewDependencies(dependencies){

			// strategy one - schedule putOpt for after the current chain and continue
			scheduler.add(db.dependencies.set.bind(null, packageObject.name, packageObject.version, dependencies));
			return dependencies;

			// // strategy two - save now but don't wait for it to resolve, continue chain immediately
			// db.dependencies.set(packageObject.name, packageObject.version, dependencies);
			// return dependencies;

			// // strategy three - save now and continue when putOpt is confirmed
			// return db.dependencies.set(packageObject.name, packageObject.version, dependencies).then(() => {
			// 	return dependencies;
			// });

		}

		function iterateEachDependency(dependencies){
			log.debug(`TreeIterator: Next iterating [${dependencies.map(dep => dep.name).join(' ') || 'none'}]`);
			return Promise.all(dependencies.map(iteratePackage));
		}

		function resolveTree(populatedDeps){
			return { name: packageObject.name, version: packageObject.version, deps: populatedDeps };
		}

	}

}

