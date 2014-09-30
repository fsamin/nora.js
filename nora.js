var console = require('better-console');
var program = require('commander');

var table = require('easy-table');

var noraRunner = require('./lib/nora-runner');
var printResult = require("./lib/status-printer");
var reportMaker = require("./lib/report-generator");

program
    .version('0.0.1')
    .option('-d, --debug', 'debug mode')
    .option('-t, --testcase [filename]', 'set the testcase', 'tests/getWeatherTest/getWeatherTestCase.json')
    .option('-r, --rundir [directory]', 'set the run directory', undefined)
    .option('-x, --xreport', 'export report in the run directory')
    .parse(process.argv);

var executionReport = [];

noraRunner(program.testcase, program.rundir, program.debug, executionReport);

var t = new table();
executionReport.forEach(function (res) {
    t.cell('Id', res.index);
    t.cell('Description', res.teststep.stepName);
    t.cell('Time', res.time);
    t.cell('Result', res.status, printResult);
    t.newRow();
});

if (program.xreport) reportMaker(executionReport,program.testcase);
console.info("# TestCase Report");
console.log(t.toString());
