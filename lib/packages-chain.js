const log = require('../log');

module.exports = packagesChain;

function packagesChain(){

	const chainArray = [];

	return {
		append,
		unique,
		get length(){ return chainArray.length; },
		get chain(){ return chainArray; }
	};

	function unique(packageObject){
		const exactMatches = chainArray.filter(item => {
			return item.name === packageObject.name && item.version === packageObject.version;
		});

		return exactMatches.length === 0;
	}

	function append(packageObject){
		chainArray.push({ name: packageObject.name, version: packageObject.version });
		log.debug('chain:\n', chainArray);
	}

}