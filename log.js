const consoleObj = {
	info: console.log,
	debug: process.env.DEBUG ? console.log : () => {},
	error: console.error
};

module.exports = consoleObj;