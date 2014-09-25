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

var setXMLProperties = require(__dirname + path.sep + "request-valuer.js", "utf8");
var printResult = require(__dirname + path.sep + "status-printer.js", "utf8");
var loader = require(__dirname + path.sep + "loader.js", "utf8");
var requestMaker = require(__dirname + path.sep + "request-generator.js", "utf8");
var requestSender = require(__dirname + path.sep + "request-sender.js", "utf8");
var restSender = require(__dirname + path.sep + "rest-sender.js", "utf8");
var xmlChecker = require(__dirname + path.sep + "payload-checker.js", "utf8");
var jsonChecker = require(__dirname + path.sep + "json-checker.js", "utf8");
var waitNext = require(__dirname + path.sep + "wait-next.js", "utf8");

testcase.teststeps.forEach(doTestStep);

var t = new table();

executionReport.forEach(function (res) {
    t.cell('Id', res.index);
    t.cell('Description', res.teststep.stepName);
    t.cell('Time', res.time);
    t.cell('Result', res.status, printResult);
    t.newRow();
});

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
        getXReport: function() {
            if (this.status == "Passed") {
                var report = [{
                    name:'testcase',
                    attrs:'name="' + this.teststep.stepName + '" classname="' + slugify(className  + '.' + this.teststep.stepName) + '", time= "' + this.time + '"'
                }];
                return jsonxml(report);
            } else if (this.status == "Failed") {
                 var report = [
                    {
                        name:'testcase',
                        attrs:'name="' + this.teststep.stepName + '" classname="' + slugify(className  + '.' + this.teststep.stepName) + '", time= "' + this.time + '"',
                        children:[
                            {name:'failure',text:this.console.stdout,attrs:{message:this.console.failureMessage}}
                        ]
                    }
                ];
                return jsonxml(report);
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

    var status;
    var nbAttempt = 1;
    var retry = true;
    var startChrono = new moment();
    while (status != "passed" && retry) {
        switch (teststep.stepAction) {
            case "loadProperties" :
                status = loader(runningTestStep);
                if (program.debug) console.dir(properties);
                break;
            case "makeRequest" :
                status = requestMaker(runningTestStep);
                break;
            case "sendRequest" :
                status = requestSender(runningTestStep);
                break;
            case "sendRest" :
                status = restSender(runningTestStep);
                break;
            case "checkXML" :
                status = xmlChecker(runningTestStep);
                break;
            case "checkJSON" :
                status = jsonChecker(runningTestStep);
                break;
            case "waitNext" :
                status = waitNext(runningTestStep);
                break;
            default:
                console.error("* Unrecognize stepAction %j", teststep.stepAction);
                console.dir(teststep);
                status = "Failed";
        }
        runningTestStep.status = status;
        if (status != "Passed" && teststep.stepReplayOnFailure) {
            nbAttempt++;
            if (nbAttempt <= teststep.stepReplayOnFailure) {
                console.warn(" * Last step is failed. Retry");
                if (teststep.stepWaitBeforeReplay) {
                    shelljs.exec("python " + __dirname + path.sep + "lib" + path.sep + "sleep.py " + teststep.stepWaitBeforeReplay);
                }
                retry = true;
            } else {
                retry = false;
            }
        } else {
            retry = false;
        }
    }
    var endChrono = new moment();

    runningTestStep.result = status;
    runningTestStep.time = endChrono.subtract(startChrono).millisecond();
    if (program.debug) console.log(runningTestStep.getXReport(className));
    executionReport.push(runningTestStep);
}



