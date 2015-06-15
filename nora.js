var console = require('better-console');
var program = require('commander');
var fs = require('fs');
var table = require('easy-table');
var path = require('path');

var noraRunner = require('./lib/nora-runner');
var printResult = require("./lib/status-printer");
var reportMaker = require("./lib/report-generator");
var parserProperties = require("./lib/parser-properties");

program
    .version('0.0.1')
    .option('-d, --debug', 'debug mode')
    .option('-t, --testcase [filename]', 'set the testcase', 'tests/getWeatherTest/getWeatherTestCase.json')
    .option('-r, --rundir [directory]', 'set the run directory', undefined)
    .option('-x, --xreport', 'export report in the run directory')
	.option('-c, --csv [csvfile]', 'use csv files to use multiple tests', undefined)
    .parse(process.argv);

// Used for the csv file, by row.
var callback = function(res) {
    if (res) {
        for (var i=0; i < res.length; i++){
            runTest(res[i]);
        }
    }
};

// Launch a test.
var runTest = function(lineRes) {
    var executionReport = [];
    noraRunner(program.testcase, program.rundir, program.debug, executionReport, lineRes);

    var t = new table();
    executionReport.forEach(function (res, i) {
          t.cell('Id', i);
          t.cell('Description', "[" + res.index + "] " + res.teststep.stepName);
          t.cell('Time', res.time);
          t.cell('Result', res.status, printResult);
          t.newRow();
    });
    if (program.xreport) reportMaker(executionReport,program.testcase);
    console.info("# TestCase Report");
    console.log(t.toString());
};

// If a csv file has been used, iteration on each row is needed.
if (program.csv) {
    fs.createReadStream(program.csv).pipe(parserProperties(callback));
} else {
    runTest(null);
}