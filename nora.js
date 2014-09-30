var console = require('better-console');
var fs = require('fs-extra');
var path = require('path');
var program = require('commander');
var moment = require('moment');
var table = require('easy-table');
var shelljs = require('shelljs');
var pd = require('pretty-data').pd;
var jsonxml = require('jsontoxml');
var slugify = require('slugify');
var util = require('util');

var runner = require('./lib/runner');
var printResult = require("./lib/status-printer");

program
    .version('0.0.1')
    .option('-d, --debug', 'debug mode')
    .option('-t, --testcase [filename]', 'set the testcase', 'tests/getWeatherTest/getWeatherTestCase.json')
    .option('-r, --rundir [directory]', 'set the run directory', undefined)
    .option('-x, --xreport', 'export report in the run directory')
    .parse(process.argv);

var dir = path.resolve(path.dirname(program.testcase));

var testcase = JSON.parse(fs.readFileSync(program.testcase, 'utf8'));
var className = testcase.package + "." + testcase.name
var properties = [];
var executionReport = [];
var runDir
if (!program.rundir)
    runDir = path.join(dir, "runs" + path.sep + testcase.package + path.sep + testcase.name  + path.sep + moment().format("YYYYMMDD-HHmmss"));
else
    runDir = program.rundir;
fs.mkdirsSync(runDir);

console.info("# Loading %s.%s", testcase.package, testcase.name);
console.info("# Running in %s", runDir);



testcase.teststeps.forEach(doTestStep);

var t = new table();

executionReport.forEach(function (res) {
    t.cell('Id', res.index);
    t.cell('Description', res.teststep.stepName);
    t.cell('Time', res.time);
    t.cell('Result', res.status, printResult);
    t.newRow();
});

if (program.xreport) reportMaker(executionReport,program.testcase);
console.info("# TestCase %s.%s Report", testcase.package, testcase.name);
console.log(t.toString());



/**
 Traitement principal itératif sur le flux JSON du cas de test
 */
function doTestStep(teststep, index, testcase) {

    var runningTestStep = {
        index: index,
        debug: program.debug,
        dir: dir,
        runDir: runDir,
        teststep: teststep,
        properties: properties,
        status: "No Run",
        time: null,
        getJsonReport: function() {
            if (this.status == "Passed") {
                var report = [{
                    name:'testcase',
                    attrs:'name="' + this.teststep.stepName + '" classname="' + slugify(className  + '.' + this.teststep.stepName) + '" time= "' + this.time + '"'
                }];
                return report;
            } else if (this.status == "Failed") {
                 var report = [
                    {
                        name:'testcase',
                        attrs:'name="' + this.teststep.stepName + '" classname="' + slugify(className  + '.' + this.teststep.stepName) + '" time= "' + this.time + '"',
                        children:[
                            {name:'failure',text:"<![CDATA["+this.console.stdout+"]]>",attrs:{message:(this.console.failureMessage).replace('<','#').replace('>','#')}}
                        ]
                    }
                ];
                return report;
            }
        },
        console:{
            failureMessage: null,
            stdout: null,
            log:function() {
                if (!this.stdout) this.stdout = "";
                if (arguments.length > 1) {
                    this.stdout += util.format(arguments) + "\n";
                    console.log(util.format(arguments));
                } else {
                    this.stdout += util.format(arguments[0]) + "\n";
                    console.log(util.format(arguments[0]));
                }
            },
            dir: function() {
                if (!this.stdout) this.stdout = "";
                this.stdout += util.inspect(arguments) + "\n";
                console.dir(arguments);
            },
            info:function() {
                if (!this.stdout) this.stdout = "";
                 if (arguments.length > 1) {
                    this.stdout += util.format(arguments) + "\n";
                    console.info(util.format(arguments));
                } else {
                    this.stdout += util.format(arguments[0]) + "\n";
                    console.info(util.format(arguments[0]));
                }
            },
            error:function() {
                if (!this.stdout) this.stdout = "";
                 if (arguments.length > 1) {
                    this.stdout += util.format(arguments) + "\n";
                    console.error(util.format(arguments));
                } else {
                    this.stdout += util.format(arguments[0]) + "\n";
                    console.error(util.format(arguments[0]));
                }
                this.failureMessage = util.format(arguments[0]);
            }
        }
    };

   runner(runningTestStep, program.debug);

    if (program.debug) console.log(runningTestStep.getJsonReport(className));
    executionReport.push(runningTestStep);
}
