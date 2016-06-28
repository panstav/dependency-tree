const db = require('./db');
const log = require('./log');

const getDeps = require('./lib/get-dependencies');
const resolveVersion = require('./lib/resolve-version');
const chain = require('./lib/packages-chain');
const scheduler = require('./lib/scheduler');

module.exports = getDependenciesTree;
module.exports.strategies = ['cache_after_iteration', 'cache_and_iterate', 'cache_then_iterate'];

function getDependenciesTree(packageObject, options){

	options = options || {};

	const flatTree = chain();
	var queryCount = 0;

	return iteratePackage(packageObject).then(result => {
		if (!options.strategy || options.strategy === 'cache_after_iteration'){
			scheduler.flush();
		}

		return {
			name: result.name,
			version: result.version,
			deps: result.deps,
			stats: {
				uniquePackages: flatTree.length,
				requestsOverNetwork: queryCount
			},
			flatTree
		};

	});

	function iteratePackage(packageObject){

		return Promise.resolve(resolveVersion(packageObject.name, packageObject.version))
			.then(versionObject => {

				packageObject.version = versionObject.version;

				if (versionObject.queried) queryCount++;

				if (!flatTree.unique(packageObject)) return { name: packageObject.name, version: packageObject.version, skip: true };
				flatTree.append(packageObject);

				return getDeps(packageObject, handleNewDependencies)
					.then(iterateEachDependency)
					.then(resolveTree);
			});

		function handleNewDependencies(dependencies){

			queryCount++;

			// default - schedule putOpt for after the current chain and continue
			if (!options.strategy || options.strategy === 'cache_after_iteration'){
				scheduler.add(db.dependencies.set.bind(null, packageObject.name, packageObject.version, dependencies));
				return dependencies;
			};

			// save now but don't wait for it to resolve, continue chain immediately
			if (options.strategy === 'cache_and_iterate'){
				db.dependencies.set(packageObject.name, packageObject.version, dependencies);
				return dependencies;
			};

			// save now and continue when putOpt is confirmed
			if (options.strategy === 'cache_then_iterate'){
				return db.dependencies.set(packageObject.name, packageObject.version, dependencies).then(() => {
					return dependencies;
				});
			}

			throw new Error(`Unknown strategy ${options.strategy}`);

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

